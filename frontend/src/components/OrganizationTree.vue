<script setup lang="ts">
import { defineProps, defineExpose, computed, ref } from 'vue'
import { useStore } from 'vuex'
import NodeEditPanel from './NodeEditPanel.vue'
import type { OrgNode } from '../store'

const props = defineProps<{ nodes: OrgNode[]; maxDepth?: number }>()
const maxDepth = props.maxDepth ?? 5

const store = useStore()

// ノード選択状態
const selectedNodeId = computed(() => store.state.selectedNodeId)
const draftNodes = computed(() => store.state.draftNodes)

// ノードリストをフラット化
function flatten(nodes: OrgNode[], parentId: string | null = null): OrgNode[] {
  const res: OrgNode[] = []
  function dfs(n: OrgNode, parentId: string | null) {
    res.push({ ...n, parentId })
    if (n.children) n.children.forEach(child => dfs(child, n.id))
  }
  nodes.forEach(n => dfs(n, parentId))
  return res
}
const flatNodes = computed(() => flatten(draftNodes.value.length ? draftNodes.value : props.nodes))

// 選択中ノード
const selectedNode = computed(() => flatNodes.value.find(n => n.id === selectedNodeId.value) || null)

const modalNode = ref<OrgNode | null>(null)
const isEdit = ref(true)

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
function getAllRows(nodes: OrgNode[], maxDepth: number): { row: (string | null)[], leafNodeId: string }[] {
  const rows: { row: (string | null)[], leafNodeId: string }[] = []
  function dfs(node: OrgNode, path: (string | null)[]) {
    const newPath = [...path]
    newPath[node.depth - 1] = node.name
    if (!node.children || node.children.length === 0) {
      rows.push({ row: newPath, leafNodeId: node.id })
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

const tableRows = computed(() => getAllRows(flatNodes.value.filter(n => !n.parentId), maxDepth))

// 末端組織（リーフノード）かどうかを判定する配列を作成
const isLeafRow = computed(() => {
  return tableRows.value.map(({ row }) => {
    for (let i = maxDepth - 1; i >= 0; i--) {
      if (row[i] !== null) {
        return i
      }
    }
    return -1
  })
})

// ノード選択
function onSelectNode(nodeId: string) {
  const node = flatNodes.value.find(n => n.id === nodeId)
  if (node) {
    modalNode.value = { ...node }
    isEdit.value = true
  }
  store.commit('selectNode', nodeId)
}
// ノード追加
function onAddChild(parentId: string, parentDepth: number) {
  const tmpId = 'tmp-' + Math.random().toString(36).slice(2, 9)
  modalNode.value = {
    id: tmpId,
    name: '',
    parentId: parentId,
    depth: parentDepth + 1,
    children: []
  }
  isEdit.value = false
  store.commit('selectNode', tmpId)
}
// ノード編集
function onUpdateNode(payload: { id: string, name: string, parentId: string | null, depth: number }) {
  if (!isEdit.value) {
    store.dispatch('addNode', payload)
  } else {
    store.dispatch('updateNode', payload)
  }
  onCloseModal()
}
// ノード削除
function onDeleteNode(nodeId: string) {
  store.dispatch('deleteNode', nodeId)
}
// モーダルを閉じる
function onCloseModal() {
  modalNode.value = null
  store.commit('selectNode', null)
}
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
        <tr v-for="({ row, leafNodeId }, idx) in tableRows" :key="idx" class="tree-table-row">
          <td
            v-for="(cell, d) in row"
            :key="d"
            :class="[
              { 'leaf-cell': isLeafRow[idx] === d },
              { 'parent-cell': cell && isLeafRow[idx] !== d },
              { 'selected-cell': leafNodeId === selectedNodeId }
            ]"
            @click="onSelectNode(leafNodeId)"
          >
            {{ cell || '-' }}
            <template v-if="isLeafRow[idx] === d && leafNodeId">
              <button class="add-btn" @click.stop="onAddChild(leafNodeId, d + 1 - 1)">＋</button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>
    <!-- モーダル表示部分 -->
    <div v-if="modalNode" class="modal-overlay" @click.self="onCloseModal">
      <div class="modal-content">
        <button class="modal-close" @click="onCloseModal">×</button>
        <NodeEditPanel
          :node="modalNode"
          :allNodes="flatNodes"
          :maxDepth="maxDepth"
          :isEdit="isEdit"
          @update="onUpdateNode"
          @delete="onDeleteNode"
        />
      </div>
    </div>
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
.selected-cell {
  background: #ffe6b3 !important;
  border: 2px solid #ffb300;
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.18);
  padding: 2em 2.5em 1.5em 2.5em;
  min-width: 340px;
  max-width: 90vw;
  position: relative;
}
.modal-close {
  position: absolute;
  top: 0.7em;
  right: 1em;
  background: none;
  border: none;
  font-size: 1.7em;
  color: #888;
  cursor: pointer;
  z-index: 10;
}
.add-btn-cell {
  width: 1%;
  padding-left: 0.2em;
  padding-right: 0.2em;
  text-align: left;
}
.add-btn {
  font-size: 0.9em;
  padding: 0.2em 0.5em;
  background: #f0f0f0;
  color: #555;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 0.2em;
  box-shadow: none;
}
.add-btn:hover {
  background: #e0e0e0;
  color: #222;
  border-color: #bbb;
}
</style> 