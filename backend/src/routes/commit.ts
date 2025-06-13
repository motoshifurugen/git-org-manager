import { Router } from 'express'
import pool from '../db'

const router = Router()

// 最新コミット取得
router.get('/commits/latest', async (_, res) => {
  const result = await pool.query('SELECT * FROM org_commit ORDER BY created_at DESC LIMIT 1')
  res.json(result.rows[0])
})

// スナップショット（コミット）作成API
router.post('/commit', async (req, res) => {
  const { tree_id, message, author } = req.body;
  if (!tree_id || !author) {
    return res.status(400).json({ error: 'tree_id, authorは必須です' });
  }
  try {
    // tree_idの存在チェック
    const treeResult = await pool.query('SELECT id FROM org_tree WHERE id = $1', [tree_id]);
    if (treeResult.rows.length === 0) {
      return res.status(404).json({ error: 'tree_idが存在しません' });
    }
    // org_commitへINSERT
    const insertResult = await pool.query(
      'INSERT INTO org_commit (tree_id, message, author) VALUES ($1, $2, $3) RETURNING id, created_at',
      [tree_id, message || null, author]
    );
    const { id: commit_id, created_at } = insertResult.rows[0];
    res.json({ success: true, commit_id, created_at });
  } catch (e: any) {
    res.status(500).json({ error: 'commit作成に失敗しました', detail: e.message });
  }
});

export default router 