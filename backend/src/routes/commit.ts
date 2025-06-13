import { Router } from 'express'
import pool from '../db'

const router = Router()

// 最新コミット取得
router.get('/commits/latest', async (_, res) => {
  const result = await pool.query('SELECT * FROM org_commit ORDER BY created_at DESC LIMIT 1')
  res.json(result.rows[0])
})

export default router 