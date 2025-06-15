<script setup lang="ts">
import { ref, computed, defineProps, defineEmits } from 'vue'

const props = defineProps<{
  show: boolean
  baseNodes: any[]
  myNodes: any[]
  fetchedNodes: any[]
}>()
const emit = defineEmits(['close', 'resolve'])

function mapById(nodes: any[]) {
  const map: Record<string, any> = {}
  nodes.forEach(n => { map[n.id] = n })
  return map
}

// 3方向マージ判定＋親競合集約
const mergeResult = computed(() => {
  const baseMap = mapById(props.baseNodes)
  const myMap = mapById(props.myNodes)
  const fetchedMap = mapById(props.fetchedNodes)
  const allIds = Array.from(new Set([
    ...props.baseNodes.map(n => n.id),
    ...props.myNodes.map(n => n.id),
    ...props.fetchedNodes.map(n => n.id)
  ]))

  const autoMerged: any[] = []
  const conflicts: any[] = []

  for (const id of allIds) {
    const base = baseMap[id]
    const local = myMap[id]
    const remote = fetchedMap[id]

    // すべて存在しない場合は無視
    if (!base && !local && !remote) continue

    // base, local, remoteすべて同じなら何も表示しない
    if (
      base && local && remote &&
      base.hash === local.hash && base.hash === remote.hash &&
      base.name === local.name && base.name === remote.name &&
      base.parentId === local.parentId && base.parentId === remote.parentId &&
      base.depth === local.depth && base.depth === remote.depth
    ) {
      continue
    }

    // 追加ノード
    if (!base && local && !remote) {
      autoMerged.push(local)
      continue
    }
    if (!base && !local && remote) {
      autoMerged.push(remote)
      continue
    }
    // 追加だが両方で異なる内容
    if (!base && local && remote) {
      if (local.hash !== remote.hash || local.name !== remote.name || local.parentId !== remote.parentId || local.depth !== remote.depth) {
        conflicts.push({ id, base, local, remote })
      } else {
        autoMerged.push(local)
      }
      continue
    }

    // 削除
    if (base && !local && !remote) {
      continue
    }
    if (base && !local && remote) {
      if (base.hash !== remote.hash || base.name !== remote.name || base.parentId !== remote.parentId || base.depth !== remote.depth) {
        conflicts.push({ id, base, local, remote })
      }
      continue
    }
    if (base && local && !remote) {
      if (base.hash !== local.hash || base.name !== local.name || base.parentId !== local.parentId || base.depth !== local.depth) {
        conflicts.push({ id, base, local, remote })
      }
      continue
    }

    // 変更
    if (base && local && remote) {
      const localChanged = base.hash !== local.hash || base.name !== local.name || base.parentId !== local.parentId || base.depth !== local.depth
      const remoteChanged = base.hash !== remote.hash || base.name !== remote.name || base.parentId !== remote.parentId || base.depth !== remote.depth
      if (localChanged && remoteChanged && (
        local.hash !== remote.hash || local.name !== remote.name || local.parentId !== remote.parentId || local.depth !== remote.depth
      )) {
        conflicts.push({ id, base, local, remote })
      } else if (localChanged && !remoteChanged) {
        autoMerged.push(local)
      } else if (!localChanged && remoteChanged) {
        autoMerged.push(remote)
      } else if (!localChanged && !remoteChanged) {
        // 何もしない
      } else {
        autoMerged.push(local)
      }
      continue
    }
  }

  // --- 親競合集約ロジック ---
  // 1. 競合ノードを深さ（depth）で降順ソート（子→親の順）
  conflicts.sort((a, b) => (b.local?.depth || b.remote?.depth || 0) - (a.local?.depth || a.remote?.depth || 0))
  const parentConflictIds = new Set()
  const filteredConflicts = []
  for (const c of conflicts) {
    // 親が競合リストに含まれている場合は除外（ただし自身に内容差分があれば個別競合）
    const localParent = c.local?.parentId
    const remoteParent = c.remote?.parentId
    let skip = false
    if ((localParent && parentConflictIds.has(localParent)) || (remoteParent && parentConflictIds.has(remoteParent))) {
      // ノード自身に名称変更や内容差分があれば個別競合
      const local = c.local
      const remote = c.remote
      const base = c.base
      const isNodeConflict =
        (base && local && (base.name !== local.name || base.hash !== local.hash)) ||
        (base && remote && (base.name !== remote.name || base.hash !== remote.hash)) ||
        (local && remote && (local.name !== remote.name || local.hash !== remote.hash))
      if (!isNodeConflict) {
        skip = true
      }
    }
    if (skip) continue
    filteredConflicts.push(c)
    if (c.local) parentConflictIds.add(c.local.id)
    if (c.remote) parentConflictIds.add(c.remote.id)
  }

  return { autoMerged, conflicts: filteredConflicts }
})

const conflictChoices = ref<Record<string, 'local'|'remote'>>({})

function onResolve() {
  const merged = [...mergeResult.value.autoMerged]
  for (const c of mergeResult.value.conflicts) {
    const choice = conflictChoices.value[c.id]
    if (choice === 'local' && c.local) merged.push(c.local)
    else if (choice === 'remote' && c.remote) merged.push(c.remote)
  }
  emit('resolve', merged)
}

function getNodePath(node: any, nodeArr: any[]): string {
  if (!node) return ''
  const path: string[] = []
  let current = node
  const map = nodeArr.reduce((acc: Record<string, any>, n: any) => { acc[n.id] = n; return acc }, {} as Record<string, any>)
  while (current) {
    path.unshift(current.name)
    current = current.parentId ? map[current.parentId] : null
  }
  return path.join(' / ')
}
function getNodeArrayForNode(node: any): any[] {
  if (!node) return []
  if (props.myNodes.find((n: any) => n.id === node.id)) return props.myNodes
  if (props.fetchedNodes.find((n: any) => n.id === node.id)) return props.fetchedNodes
  if (props.baseNodes.find((n: any) => n.id === node.id)) return props.baseNodes
  return []
}
</script>
<template>
  <div v-if="props.show" class="modal-overlay">
    <div class="modal-content" style="position:relative; height: 70vh; display: flex; flex-direction: column;">
      <h2>3方向マージ差分</h2>
      <div class="modal-merge-area">
        <div class="merge-col">
          <h3>自動マージ</h3>
          <ul>
            <li v-for="n in mergeResult.autoMerged" :key="n.id" class="diff-added">
              <span class="diff-sign">＋</span>{{ getNodePath(n, getNodeArrayForNode(n)) }}
            </li>
          </ul>
        </div>
        <div class="merge-col">
          <h3>競合</h3>
          <ul>
            <li v-for="c in mergeResult.conflicts" :key="c.id" style="margin-bottom:0.7em;">
              <div class="diff-deleted">
                <span class="diff-sign">ー</span>{{ getNodePath(c.base, props.baseNodes) }}
              </div>
              <div class="diff-added" style="display:flex; align-items:center; gap:1em;">
                <span class="diff-sign">＋</span>{{ getNodePath(c.local, props.myNodes) || '削除' }}
                <input type="radio" :name="'conflict-'+c.id" value="local" v-model="conflictChoices[c.id]">
                <span style="font-size:0.95em; color:#347474;">自分</span>
              </div>
              <div class="diff-added" style="margin-top:0.2em; display:flex; align-items:center; gap:1em;">
                <span class="diff-sign">＋</span>{{ getNodePath(c.remote, props.fetchedNodes) || '削除' }}
                <input type="radio" :name="'conflict-'+c.id" value="remote" v-model="conflictChoices[c.id]">
                <span style="font-size:0.95em; color:#c41d7f;">fetch</span>
              </div>
              <div v-if="!conflictChoices[c.id]" style="color:#c41d7f; font-size:0.93em; margin-top:0.2em;">どちらかを選択してください</div>
            </li>
          </ul>
        </div>
      </div>
      <div class="modal-btn-row">
        <button class="modal-btn" @click="emit('close')">閉じる</button>
        <button class="modal-btn primary" :disabled="!!(mergeResult.conflicts.length && Object.keys(conflictChoices).length < mergeResult.conflicts.length)" @click="onResolve">解決</button>
      </div>
    </div>
  </div>
</template>

<style>
.diff-added {
  background: #e6ffed;
  color: #22863a;
  border-radius: 4px;
  margin-bottom: 0.3em;
  padding: 0.2em 0.7em;
  font-family: monospace;
  text-align: left;
}
.diff-deleted {
  background: #fff1f0;
  color: #c41d7f;
  border-radius: 4px;
  margin-bottom: 0.3em;
  padding: 0.2em 0.7em;
  font-family: monospace;
  text-align: left;
}
.diff-sign {
  font-weight: bold;
  margin-right: 0.5em;
  font-size: 1.1em;
}
.modal-btn-row {
  display: flex;
  gap: 1em;
  justify-content: center;
  margin-top: 1.5em;
}
.modal-btn {
  min-width: 100px;
  padding: 0.6em 1.8em;
  border-radius: 8px;
  border: none;
  background: #e0e4ea;
  color: #2d3a4a;
  font-weight: bold;
  font-size: 1em;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.modal-btn.primary {
  background: #347474;
  color: #fff;
}
.modal-btn:disabled {
  background: #b0b8c9;
  color: #fff;
  cursor: not-allowed;
}
.modal-content {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.18);
  padding: 2em 2.5em 2em 2.5em;
  min-width: 540px;
  max-width: 90vw;
  position: relative;
  height: 70vh;
  display: flex;
  flex-direction: column;
}
.modal-merge-area {
  display: flex;
  flex: 1 1 0;
  gap: 2em;
  overflow: hidden;
  min-height: 0;
}
.merge-col {
  flex: 1 1 0;
  min-width: 0;
  overflow-y: auto;
  max-height: 100%;
  padding-right: 0.5em;
}
ul {
  list-style: none;
  padding-left: 0;
  margin: 0 0 0.5em 0;
}
</style> 