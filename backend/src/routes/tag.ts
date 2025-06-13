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

export default router 