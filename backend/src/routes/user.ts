import express from 'express'
import pool from '../db'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key'

// ユーザー登録
router.post('/register', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: '必須項目がありません' })
  try {
    // 既存ユーザー確認
    const { rows } = await pool.query('SELECT id FROM org_user WHERE username = $1', [username])
    if (rows.length > 0) return res.status(409).json({ error: '既に登録されています' })
    const password_hash = await bcrypt.hash(password, 10)
    const insert = await pool.query('INSERT INTO org_user (username, password_hash) VALUES ($1, $2) RETURNING id', [username, password_hash])
    const userId = insert.rows[0].id
    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, userId })
  } catch (e) {
    res.status(500).json({ error: '登録に失敗しました' })
  }
})

// ログイン
router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: '必須項目がありません' })
  try {
    const { rows } = await pool.query('SELECT id, username, password_hash FROM org_user WHERE username = $1', [username])
    if (rows.length === 0) return res.status(401).json({ error: 'ユーザー名またはパスワードが違います' })
    const user = rows[0]
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'ユーザー名またはパスワードが違います' })
    const userId = user.id
    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' })
    res.json({ token, userId })
  } catch (e) {
    res.status(500).json({ error: 'ログインに失敗しました' })
  }
})

export default router 