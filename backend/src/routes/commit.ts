import { Router, Request, Response, NextFunction } from 'express'
import pool from '../db'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key'

// JWT認証ミドルウェア
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: '認証が必要です' })
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET)
    ;(req as any).userId = (payload as any).userId
    next()
  } catch {
    res.status(401).json({ error: '認証エラー' })
  }
}

// 最新コミット取得
router.get('/commits/latest', async (_, res) => {
  const result = await pool.query('SELECT * FROM org_commit ORDER BY created_at DESC LIMIT 1')
  res.json(result.rows[0])
})

// スナップショット（コミット）作成API
router.post('/commit', authMiddleware, async (req, res) => {
  const { message, nodes, parent_commit_id, created_at } = req.body;
  const author = (req as any).userId;
  if (!author || !nodes) {
    return res.status(400).json({ error: 'author, nodesは必須です' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1. org_tree 新規作成
    const treeResult = await client.query(
      'INSERT INTO org_tree (created_at, created_by) VALUES ($1, $2) RETURNING id',
      [created_at ? new Date(created_at) : new Date(), author]
    );
    const tree_id = treeResult.rows[0].id;
    // 2. org_node の再利用 or 新規作成
    const nodeIdMap: Record<string, number> = {};
    for (const node of nodes) {
      // 親ノードのハッシュを取得
      let parent_hash = null;
      if (node.parentId) {
        const parentNode = nodes.find((n: any) => n.id === node.parentId);
        if (parentNode) {
          parent_hash = crypto.createHash('sha256').update(`${parentNode.name}-${parentNode.depth}-${parentNode.parentId ?? ''}`).digest('hex');
        }
      }
      const hash = crypto.createHash('sha256').update(`${node.name}-${node.depth}-${parent_hash ?? ''}`).digest('hex');
      // 既存ノード検索
      const exist = await client.query('SELECT id FROM org_node WHERE hash = $1', [hash]);
      let org_node_id;
      if (exist.rows.length > 0) {
        org_node_id = exist.rows[0].id;
      } else {
        const insert = await client.query(
          'INSERT INTO org_node (name, depth, parent_hash, hash) VALUES ($1, $2, $3, $4) RETURNING id',
          [node.name, node.depth, parent_hash, hash]
        );
        org_node_id = insert.rows[0].id;
      }
      nodeIdMap[node.id] = org_node_id;
    }
    // 3. org_tree_node の構築
    for (const node of nodes) {
      await client.query(
        'INSERT INTO org_tree_node (tree_id, node_id, parent_id) VALUES ($1, $2, $3)',
        [
          tree_id,
          nodeIdMap[node.id],
          node.parentId ? nodeIdMap[node.parentId] : null
        ]
      );
    }
    // 4. org_commit の作成
    const commitResult = await client.query(
      'INSERT INTO org_commit (tree_id, message, author, parent_commit_id, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
      [tree_id, message || null, author, parent_commit_id || null, created_at ? new Date(created_at) : new Date()]
    );
    await client.query('COMMIT');
    res.json({ success: true, commit_id: commitResult.rows[0].id, tree_id, created_at: commitResult.rows[0].created_at });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'commit作成に失敗しました', detail: e.message });
  } finally {
    client.release();
  }
});

// コミット一覧取得API（authorで絞り込み対応）
router.get('/commits', async (req, res) => {
  const { author, ids } = req.query;
  try {
    let result;
    if (ids) {
      // カンマ区切りのIDリストで取得
      const idArr = String(ids).split(',').map(s => s.trim()).filter(Boolean)
      if (idArr.length === 0) return res.json([])
      result = await pool.query(
        `SELECT c.id, c.message, u.username as author, c.created_at, c.tree_id, c.parent_commit_id, t.name as tag_name
         FROM org_commit c
         LEFT JOIN org_tag t ON c.id = t.commit_id
         LEFT JOIN org_user u ON c.author = u.id
         WHERE c.id = ANY($1)
         ORDER BY c.created_at DESC`,
        [idArr]
      );
      return res.json(result.rows)
    }
    if (author) {
      result = await pool.query(
        `SELECT c.id, c.message, u.username as author, c.created_at, c.tree_id, c.parent_commit_id, t.name as tag_name
         FROM org_commit c
         LEFT JOIN org_tag t ON c.id = t.commit_id
         LEFT JOIN org_user u ON c.author = u.id
         WHERE c.author::uuid = $1::uuid
         ORDER BY c.created_at DESC`,
        [author]
      );
    } else {
      result = await pool.query(
        `SELECT c.id, c.message, u.username as author, c.created_at, c.tree_id, c.parent_commit_id, t.name as tag_name
         FROM org_commit c
         LEFT JOIN org_tag t ON c.id = t.commit_id
         LEFT JOIN org_user u ON c.author = u.id
         ORDER BY c.created_at DESC`
      );
    }
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: 'コミット一覧取得に失敗しました', detail: e.message });
  }
});

// 共有コミットを作成（push）
router.post('/commit_share', async (req, res) => {
  const { commit_id, note } = req.body;
  if (!commit_id) return res.status(400).json({ error: 'commit_idは必須です' });
  try {
    // 既に共有済みかチェック
    const exist = await pool.query('SELECT id FROM org_commit_share WHERE commit_id = $1', [commit_id]);
    if (exist.rows.length > 0) {
      return res.status(409).json({ error: 'このコミットは既に共有されています' });
    }
    // 最新のorg_commit_shareのshared_atを取得
    const latestShare = await pool.query('SELECT shared_at FROM org_commit_share ORDER BY shared_at DESC LIMIT 1');
    let latestSharedAt = null;
    if (latestShare.rows.length > 0) {
      latestSharedAt = latestShare.rows[0].shared_at;
    }
    // 対象コミットのcreated_atを取得
    const commitRes = await pool.query('SELECT created_at FROM org_commit WHERE id = $1', [commit_id]);
    if (commitRes.rows.length === 0) {
      return res.status(400).json({ error: 'commit_idが存在しません' });
    }
    const commitCreatedAt = commitRes.rows[0].created_at;
    // 最新shared_atより新しいcreated_atのみpush許可
    if (latestSharedAt && commitCreatedAt.getTime() <= new Date(latestSharedAt).getTime()) {
      return res.status(409).json({ error: '最新の共有コミットと同じかそれ以前の日付のコミットはpushできません' });
    }
    const result = await pool.query(
      'INSERT INTO org_commit_share (commit_id, note) VALUES ($1, $2) RETURNING *',
      [commit_id, note || null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: '共有に失敗しました', detail: (e as any).message });
  }
});

// 共有コミット一覧を取得（fetch）
router.get('/commit_share', async (_, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id as share_id, s.commit_id, s.shared_at, s.note,
             c.message, u.username as author, c.created_at, c.tree_id, t.name as tag_name
      FROM org_commit_share s
      JOIN org_commit c ON s.commit_id = c.id
      LEFT JOIN org_tag t ON c.id = t.commit_id
      LEFT JOIN org_user u ON c.author = u.id
      ORDER BY s.shared_at DESC
    `);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: '共有コミット一覧取得に失敗しました', detail: (e as any).message });
  }
});

// 共有コミットをドラフトにマージ（merge）
router.post('/merge_commit_share', async (req, res) => {
  const { share_id } = req.body;
  if (!share_id) return res.status(400).json({ error: 'share_idは必須です' });
  try {
    const result = await pool.query(`
      SELECT c.tree_id FROM org_commit_share s
      JOIN org_commit c ON s.commit_id = c.id
      WHERE s.id = $1
    `, [share_id]);
    if (result.rows.length === 0) return res.status(404).json({ error: '共有コミットが見つかりません' });
    const tree_id = result.rows[0].tree_id;
    // ツリー内容を返す
    const treeRes = await pool.query('SELECT * FROM org_tree WHERE id = $1', [tree_id]);
    res.json(treeRes.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'マージに失敗しました', detail: (e as any).message });
  }
});

export default router 