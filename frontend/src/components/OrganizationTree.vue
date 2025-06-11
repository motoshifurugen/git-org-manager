<script setup lang="ts">
import { defineProps, defineExpose, computed } from 'vue'

type OrgNode = {
  id: string
  name: string
  depth: number
  children: OrgNode[]
}

const props = defineProps<{ nodes: OrgNode[]; maxDepth?: number }>()
const maxDepth = props.maxDepth ?? 5

defineExpose({})

// 指定ノード配下で各階層のノードをリスト化
function getRowForNode(node: OrgNode, maxDepth: number): (string | null)[] {
  const row = Array(maxDepth).fill(null)
  let current: OrgNode | undefined = node
  while (current && current.depth <= maxDepth) {
    row[current.depth - 1] = current.name
    if (current.children && current.children.length > 0) {
      current = current.children[0]
    } else {
      break
    }
  }
  return row
}

// 全てのルートから、各パスごとに行を作る
function getAllRows(nodes: OrgNode[], maxDepth: number): (string | null)[][] {
  const rows: (string | null)[][] = []
  function dfs(node: OrgNode, path: (string | null)[]) {
    const newPath = [...path]
    newPath[node.depth - 1] = node.name
    if (!node.children || node.children.length === 0) {
      rows.push(newPath)
    } else {
      for (const child of node.children) {
        dfs(child, newPath)
      }
    }
  }
  for (const node of nodes) {
    const path = Array(maxDepth).fill(null)
    dfs(node, path)
  }
  return rows
}

const tableRows = getAllRows(props.nodes, maxDepth)

// 末端組織（リーフノード）かどうかを判定する配列を作成
const isLeafRow = computed(() => {
  return tableRows.map(row => {
    // 末端組織は一番右側（depth最大）の非nullセルがその組織名
    // もしくは、rowの中で一番右の非nullが末端
    for (let i = maxDepth - 1; i >= 0; i--) {
      if (row[i] !== null) {
        return i
      }
    }
    return -1
  })
})
</script>

<script lang="ts">
export default {
  name: 'OrganizationTree',
}
</script>

<template>
  <div class="tree-table-wrapper half-width">
    <table class="tree-table">
      <thead>
        <tr>
          <th v-for="d in maxDepth" :key="d">第{{ d }}階層</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, idx) in tableRows" :key="idx" class="tree-table-row">
          <td
            v-for="(cell, d) in row"
            :key="d"
            :class="[
              { 'leaf-cell': isLeafRow[idx] === d },
              { 'parent-cell': cell && isLeafRow[idx] !== d }
            ]"
          >
            {{ cell || '-' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.tree-table-wrapper {
  overflow-x: auto;
  margin-top: 1em;
}
.half-width {
  width: 50vw;
  min-width: 400px;
  max-width: 50vw;
  float: left;
  box-sizing: border-box;
  margin-left: 0;
}
.tree-table {
  border-collapse: collapse;
  border-spacing: 0;
  width: 100%;
  min-width: 600px;
  background: #fff;
  /* box-shadow: 0 2px 8px rgba(60,60,60,0.07); */
}
.tree-table th, .tree-table td {
  border: none;
  padding: 0.7em 1em;
  text-align: center;
  width: 1%;
  border-radius: 0 !important;
}
.tree-table th {
  font-weight: 700;
  color: #347474;
  font-size: 0.85em;
}
.tree-table td {
  font-size: 0.8em;
  color: #2d3a4a;
  background: #fafdff;
  transition: background 0.2s;
  border-bottom: 1.2px solid #e0e4ea;
}
.tree-table-row {
  /* box-shadow: 0 1px 4px rgba(60,60,60,0.04);
  background: #fafdff;
  margin-bottom: 0.5em;
  overflow: hidden;
  border-radius: 8px;
  display: table-row;
  border-bottom: 2.5px solid #222; */
}
.tree-table-row td:first-child {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
  border-left: none;
}
.tree-table-row td:last-child {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
  border-right: none;
}
.leaf-cell {
  font-weight: bold;
  color: #1a3a6b;
  background: #e6f7ff;
  letter-spacing: 0.02em;
}
.parent-cell {
  color: #6b7685 !important;
  font-weight: 400;
  background: #fafdff;
}
</style> 