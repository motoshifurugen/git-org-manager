// backend/src/index.ts
import express from 'express'
import cors from 'cors'
import pool from './db'
import crypto from 'crypto'

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

// ノード追加API
app.post('/api/org-nodes', async (req, res) => {
  const { tree_id, name, level, parent_node_id } = req.body
  if (!tree_id || !name || typeof level !== 'number') {
    return res.status(400).json({ error: 'tree_id, name, levelは必須です' })
  }
  try {
    // hash生成
    const parentHashResult = parent_node_id
      ? await pool.query('SELECT hash FROM org_node WHERE id = $1', [parent_node_id])
      : { rows: [{ hash: null }] }
    const parent_hash = parentHashResult.rows[0]?.hash || null
    const hash = crypto.createHash('sha256').update(`${name}-${level}-${parent_hash ?? ''}`).digest('hex')

    // org_node存在チェック
    let nodeResult = await pool.query('SELECT * FROM org_node WHERE hash = $1', [hash])
    let node
    if (nodeResult.rows.length > 0) {
      node = nodeResult.rows[0]
    } else {
      // 新規作成
      nodeResult = await pool.query(
        'INSERT INTO org_node (name, depth, parent_hash, hash) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, level, parent_hash, hash]
      )
      node = nodeResult.rows[0]
    }

    // org_tree_node登録（重複は無視）
    let linkResult
    try {
      linkResult = await pool.query(
        'INSERT INTO org_tree_node (tree_id, node_id, parent_id) VALUES ($1, $2, $3) RETURNING *',
        [tree_id, node.id, parent_node_id]
      )
    } catch (e: any) {
      // 既に存在する場合は取得
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
app.patch('/api/org-nodes/edit', async (req, res) => {
  const { tree_id, node_id, new_name, new_parent_node_id, new_level } = req.body
  if (!tree_id || !node_id || !new_name) {
    return res.status(400).json({ error: 'tree_id, node_id, new_nameは必須です' })
  }
  try {
    // 1. parent_hash取得
    let parent_hash = null
    if (new_parent_node_id) {
      const parentHashResult = await pool.query('SELECT hash FROM org_node WHERE id = $1', [new_parent_node_id])
      parent_hash = parentHashResult.rows[0]?.hash || null
    }
    // 2. level決定
    let level = new_level
    if (typeof level !== 'number') {
      // 現在のノードのdepthを流用
      const nodeResult = await pool.query('SELECT depth FROM org_node WHERE id = $1', [node_id])
      level = nodeResult.rows[0]?.depth
    }
    // 3. hash生成
    const hash = crypto.createHash('sha256').update(`${new_name}-${level}-${parent_hash ?? ''}`).digest('hex')
    // 4. org_node存在チェック
    let nodeResult = await pool.query('SELECT * FROM org_node WHERE hash = $1', [hash])
    let newNode
    let updated = true
    if (nodeResult.rows.length > 0) {
      newNode = nodeResult.rows[0]
      // 変更なし判定
      if (newNode.id === node_id) {
        updated = false
      }
    } else {
      // 新規作成
      nodeResult = await pool.query(
        'INSERT INTO org_node (name, depth, parent_hash, hash) VALUES ($1, $2, $3, $4) RETURNING *',
        [new_name, level, parent_hash, hash]
      )
      newNode = nodeResult.rows[0]
    }
    // 5. org_tree_nodeの置換（node_id, parent_id更新）
    if (updated) {
      // 既存リンクを新ノードに置換
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
app.delete('/api/org-nodes/:tree_node_id', async (req, res) => {
  const { tree_node_id } = req.params
  if (!tree_node_id) {
    return res.status(400).json({ error: 'tree_node_idは必須です' })
  }
  try {
    // 削除対象のorg_tree_node情報を取得
    const linkResult = await pool.query('SELECT * FROM org_tree_node WHERE ctid = $1', [tree_node_id])
    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'tree_node_idが見つかりません' })
    }
    const treeNode = linkResult.rows[0]
    // ノード情報取得
    const nodeResult = await pool.query('SELECT id, name, depth FROM org_node WHERE id = $1', [treeNode.node_id])
    const node = nodeResult.rows[0]
    // org_tree_node削除
    await pool.query('DELETE FROM org_tree_node WHERE ctid = $1', [tree_node_id])
    // org_tree.updated_at更新
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

app.listen(3001, () => {
  console.log('Server is running at http://localhost:3001')
})
