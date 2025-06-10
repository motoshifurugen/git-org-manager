// backend/src/index.ts
import express from 'express'
import cors from 'cors'
import pool from './db'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/trees', async (_, res) => {
  const result = await pool.query('SELECT * FROM org_tree ORDER BY created_at DESC LIMIT 10')
  res.json(result.rows)
})

app.listen(3001, () => {
  console.log('Server is running at http://localhost:3001')
})
