import { Router } from 'express'
import pool from '../db'
import crypto from 'crypto'

const router = Router()

// ノード追加API
router.post('/org-nodes', async (req, res) => {
  const { tree_id, name, level, parent_node_id } = req.body
  if (!tree_id || !name || typeof level !== 'number') {
    return res.status(400).json({ error: 'tree_id, name, levelは必須です' })
  }
  try {
    const parentHashResult = parent_node_id
      ? await pool.query('SELECT hash FROM org_node WHERE id = $1', [parent_node_id])
      : { rows: [{ hash: null }] }
    const parent_hash = parentHashResult.rows[0]?.hash || null
    const hash = crypto.createHash('sha256').update(`${name}-${level}-${parent_hash ?? ''}`).digest('hex')
    let nodeResult = await pool.query('SELECT * FROM org_node WHERE hash = $1', [hash])
    let node
    if (nodeResult.rows.length > 0) {
      node = nodeResult.rows[0]
    } else {
      nodeResult = await pool.query(
        'INSERT INTO org_node (name, depth, parent_hash, hash) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, level, parent_hash, hash]
      )
      node = nodeResult.rows[0]
    }
    let linkResult
    try {
      linkResult = await pool.query(
        'INSERT INTO org_tree_node (tree_id, node_id, parent_id) VALUES ($1, $2, $3) RETURNING *',
        [tree_id, node.id, parent_node_id]
      )
    } catch (e: any) {
      linkResult = await pool.query(
        'SELECT * FROM org_tree_node WHERE tree_id = $1 AND node_id = $2',
        [tree_id, node.id]
      )
    }
    const link = linkResult.rows[0]
    res.json({ node, link })
  } catch (e: any) {
    res.status(500).json({ error: 'failed to add org node', detail: e.message })
  }
})

// ノード編集API
router.patch('/org-nodes/edit', async (req, res) => {
  const { tree_id, node_id, new_name, new_parent_node_id, new_level } = req.body
  if (!tree_id || !node_id || !new_name) {
    return res.status(400).json({ error: 'tree_id, node_id, new_nameは必須です' })
  }
  try {
    let parent_hash = null
    if (new_parent_node_id) {
      const parentHashResult = await pool.query('SELECT hash FROM org_node WHERE id = $1', [new_parent_node_id])
      parent_hash = parentHashResult.rows[0]?.hash || null
    }
    let level = new_level
    if (typeof level !== 'number') {
      const nodeResult = await pool.query('SELECT depth FROM org_node WHERE id = $1', [node_id])
      level = nodeResult.rows[0]?.depth
    }
    const hash = crypto.createHash('sha256').update(`${new_name}-${level}-${parent_hash ?? ''}`).digest('hex')
    let nodeResult = await pool.query('SELECT * FROM org_node WHERE hash = $1', [hash])
    let newNode
    let updated = true
    if (nodeResult.rows.length > 0) {
      newNode = nodeResult.rows[0]
      if (newNode.id === node_id) {
        updated = false
      }
    } else {
      nodeResult = await pool.query(
        'INSERT INTO org_node (name, depth, parent_hash, hash) VALUES ($1, $2, $3, $4) RETURNING *',
        [new_name, level, parent_hash, hash]
      )
      newNode = nodeResult.rows[0]
    }
    if (updated) {
      await pool.query(
        'UPDATE org_tree_node SET node_id = $1, parent_id = $2 WHERE tree_id = $3 AND node_id = $4',
        [newNode.id, new_parent_node_id, tree_id, node_id]
      )
    }
    res.json({ status: 'success', new_node_id: newNode.id, updated })
  } catch (e: any) {
    res.status(500).json({ error: 'failed to edit org node', detail: e.message })
  }
})

// ノード削除API
router.delete('/org-nodes/:tree_node_id', async (req, res) => {
  const { tree_node_id } = req.params
  if (!tree_node_id) {
    return res.status(400).json({ error: 'tree_node_idは必須です' })
  }
  try {
    const linkResult = await pool.query('SELECT * FROM org_tree_node WHERE id = $1', [tree_node_id])
    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'tree_node_idが見つかりません' })
    }
    const treeNode = linkResult.rows[0]
    const nodeResult = await pool.query('SELECT id, name, depth FROM org_node WHERE id = $1', [treeNode.node_id])
    const node = nodeResult.rows[0]
    await pool.query('DELETE FROM org_tree_node WHERE id = $1', [tree_node_id])
    await pool.query('UPDATE org_tree SET updated_at = NOW() WHERE id = $1', [treeNode.tree_id])
    res.json({
      node: {
        id: node.id,
        name: node.name,
        level: node.depth
      },
      tree_node: {
        id: tree_node_id,
        tree_id: treeNode.tree_id,
        parent_node_id: treeNode.parent_id
      }
    })
  } catch (e: any) {
    res.status(500).json({ error: 'failed to delete org node', detail: e.message })
  }
})

export default router 