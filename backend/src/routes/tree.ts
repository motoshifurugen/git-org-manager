import { Router } from 'express'
import pool from '../db'

const router = Router()

// ツリー一覧取得
router.get('/trees', async (_, res) => {
  const result = await pool.query('SELECT * FROM org_tree ORDER BY created_at DESC')
  res.json(result.rows)
})

// ツリー構造取得
router.get('/trees/:id', async (req, res) => {
  const treeId = req.params.id
  try {
    const result = await pool.query(`
      SELECT n.id, n.name, n.depth, tn.parent_id
      FROM org_tree_node tn
      JOIN org_node n ON tn.node_id = n.id
      WHERE tn.tree_id = $1
    `, [treeId])
    const nodesById: Record<string, any> = Object.create(null)
    result.rows.forEach((row: any) => {
      nodesById[row.id] = { id: row.id, name: row.name, depth: row.depth, children: [] }
    })
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

export default router 