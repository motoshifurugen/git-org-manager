// backend/src/index.ts
import express from 'express'
import cors from 'cors'
import pool from './db'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/trees', async (_, res) => {
  const result = await pool.query('SELECT * FROM org_tree ORDER BY created_at DESC')
  res.json(result.rows)
})

app.get('/api/trees/:id', async (req, res) => {
  const treeId = req.params.id
  try {
    // org_tree_nodeとorg_nodeをJOINして、指定tree_idのノード情報を全て取得
    const result = await pool.query(`
      SELECT n.id, n.name, n.depth, tn.parent_id
      FROM org_tree_node tn
      JOIN org_node n ON tn.node_id = n.id
      WHERE tn.tree_id = $1
    `, [treeId])

    // ノードをidでマップ
    const nodesById: Record<string, any> = Object.create(null)
    result.rows.forEach((row: any) => {
      nodesById[row.id] = { id: row.id, name: row.name, depth: row.depth, children: [] }
    })

    // 親子関係を構築
    const roots: any[] = []
    result.rows.forEach((row: any) => {
      if (row.parent_id && nodesById[row.parent_id]) {
        nodesById[row.parent_id].children.push(nodesById[row.id])
      } else {
        roots.push(nodesById[row.id])
      }
    })

    res.json({ id: treeId, nodes: roots })
  } catch (e: any) {
    res.status(500).json({ error: 'failed to fetch tree structure', detail: e.message })
  }
})

app.get('/api/commits/latest', async (_, res) => {
  const result = await pool.query('SELECT * FROM org_commit ORDER BY created_at DESC LIMIT 1')
  res.json(result.rows[0])
})

app.get('/api/tags/:id', async (req, res) => {
  const commitId = req.params.id
  try {
    const result = await pool.query('SELECT * FROM org_tag WHERE commit_id = $1', [commitId])
    res.json(result.rows[0])
  } catch (e: any) {
    res.status(500).json({ error: 'failed to fetch tag', detail: e.message })
  }
})

app.listen(3001, () => {
  console.log('Server is running at http://localhost:3001')
})
