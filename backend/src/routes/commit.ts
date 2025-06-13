import { Router } from 'express'
import pool from '../db'
import crypto from 'crypto'

const router = Router()

// 最新コミット取得
router.get('/commits/latest', async (_, res) => {
  const result = await pool.query('SELECT * FROM org_commit ORDER BY created_at DESC LIMIT 1')
  res.json(result.rows[0])
})

// スナップショット（コミット）作成API
router.post('/commit', async (req, res) => {
  const { author, message, nodes } = req.body;
  if (!author || !nodes) {
    return res.status(400).json({ error: 'author, nodesは必須です' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1. org_tree 新規作成
    const treeResult = await client.query(
      'INSERT INTO org_tree (created_at, created_by) VALUES (NOW(), $1) RETURNING id',
      [author]
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
      'INSERT INTO org_commit (tree_id, message, author) VALUES ($1, $2, $3) RETURNING id, created_at',
      [tree_id, message || null, author]
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

// コミット一覧取得API
router.get('/commits', async (_, res) => {
  try {
    const result = await pool.query(
      `SELECT id, message, author, created_at, tree_id
       FROM org_commit
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: 'コミット一覧取得に失敗しました', detail: e.message });
  }
});

export default router 