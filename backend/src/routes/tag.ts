import { Router } from 'express'
import pool from '../db'

const router = Router()

// タグ取得
router.get('/tags/:id', async (req, res) => {
  const commitId = req.params.id
  try {
    const result = await pool.query('SELECT * FROM org_tag WHERE commit_id = $1', [commitId])
    res.json(result.rows[0])
  } catch (e: any) {
    res.status(500).json({ error: 'failed to fetch tag', detail: e.message })
  }
})

// タグ作成・紐付け
router.post('/tags', async (req, res) => {
  const { commit_id, name } = req.body;
  // バリデーション
  if (!commit_id || !name) {
    return res.status(400).json({ error: 'commit_id, nameは必須です' });
  }
  if (typeof name !== 'string' || name.length < 1 || name.length > 50) {
    return res.status(400).json({ error: 'nameは1〜50文字で指定してください' });
  }
  try {
    // commit_idがorg_commitに存在するか
    const commitResult = await pool.query('SELECT id FROM org_commit WHERE id = $1', [commit_id]);
    if (commitResult.rows.length === 0) {
      return res.status(400).json({ error: 'commit_idが存在しません' });
    }
    // 既にタグが付与されていないか
    const tagResult = await pool.query('SELECT id FROM org_tag WHERE commit_id = $1', [commit_id]);
    if (tagResult.rows.length > 0) {
      return res.status(409).json({ error: 'このコミットには既にタグが付与されています' });
    }
    // 新規タグ作成
    const insertResult = await pool.query(
      'INSERT INTO org_tag (name, commit_id) VALUES ($1, $2) RETURNING id, name, commit_id',
      [name, commit_id]
    );
    const tag = insertResult.rows[0];
    res.json({ success: true, tag_id: tag.id, name: tag.name, commit_id: tag.commit_id });
  } catch (e: any) {
    res.status(500).json({ error: 'タグ作成に失敗しました', detail: e.message });
  }
});

export default router 