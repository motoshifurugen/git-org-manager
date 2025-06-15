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

// 末尾名でグルーピング用のパス表示関数をトップレベルに移動
function getNodePathForMap(node: any, nodeMap: Record<string, any>): string {
  if (!node) return ''
  const path: string[] = []
  let current = node
  while (current) {
    path.unshift(current.name)
    current = current.parentId ? nodeMap[current.parentId] : null
  }
  return path.join(' / ')
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

  // まず競合候補をすべてリストアップ
  const allConflictsMap: Record<string, { id: string, base: any, local: any, remote: any }> = {}
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

    // idごとに1つだけにする
    if (!allConflictsMap[id]) {
      allConflictsMap[id] = { id, base, local, remote }
    } else {
      if (base) allConflictsMap[id].base = base
      if (local) allConflictsMap[id].local = local
      if (remote) allConflictsMap[id].remote = remote
    }
  }
  // まずID単位の競合リストを作る
  const allConflicts: any[] = Object.values(allConflictsMap)

  // 1. ID単位で親が競合ノードID集合に含まれているかを判定して除外
  const allConflictIds = new Set(allConflicts.map(c => c.base?.id || c.local?.id || c.remote?.id))
  function hasAncestorConflictById(node: any, nodeMap: Record<string, any>): boolean {
    let current = node
    while (current && current.parentId) {
      if (allConflictIds.has(current.parentId)) return true
      current = nodeMap[current.parentId]
    }
    return false
  }
  const allConflictsFiltered = allConflicts.filter(c => {
    const node = c.base || c.local || c.remote
    if (!node) return false
    if (hasAncestorConflictById(node, baseMap)) {
      // 内容差分がある場合は残す
      if (c.base && c.local && (c.base.name !== c.local.name || c.base.hash !== c.local.hash)) return true
      if (c.base && c.remote && (c.base.name !== c.remote.name || c.base.hash !== c.remote.hash)) return true
      if (c.local && c.remote && (c.local.name !== c.remote.name || c.local.hash !== c.remote.hash)) return true
      return false
    }
    return true
  })

  // 2. 名前単位でグルーピング
  function getNodeNameKey(node: any): string {
    return node?.name || ''
  }
  const nameKeyMap: Record<string, { base: any, local: any, remote: any, key: string }> = {}
  for (const c of allConflictsFiltered) {
    const baseKey = c.base ? getNodeNameKey(c.base) : ''
    const localKey = c.local ? getNodeNameKey(c.local) : ''
    const remoteKey = c.remote ? getNodeNameKey(c.remote) : ''
    const key = baseKey || localKey || remoteKey
    if (!nameKeyMap[key]) {
      nameKeyMap[key] = { base: c.base, local: c.local, remote: c.remote, key }
    } else {
      if (!nameKeyMap[key].base && c.base) nameKeyMap[key].base = c.base
      if (!nameKeyMap[key].local && c.local) nameKeyMap[key].local = c.local
      if (!nameKeyMap[key].remote && c.remote) nameKeyMap[key].remote = c.remote
    }
  }
  const mergedConflicts = Object.values(nameKeyMap)
  // localまたはremoteが存在するものだけに絞り込む
  const filteredConflictsFinal = mergedConflicts.filter(c => c.local || c.remote)

  // 祖先探索用ノードマップ
  const allNodeMap = { ...baseMap, ...myMap, ...fetchedMap }
  // 競合ノードIDリスト（仮で空、後でセット）
  let conflictIds = new Set<string>()
  function hasConflictAncestor(nodeId: string): boolean {
    let current = allNodeMap[nodeId]
    while (current && current.parentId) {
      if (conflictIds.has(current.parentId)) return true
      current = allNodeMap[current.parentId]
    }
    return false
  }
  // filteredConflicts生成
  const parentConflictIds = new Set<string>()
  const filteredConflicts: any[] = []
  for (const c of allConflictsFiltered) {
    const node = c.local || c.remote
    // 親が競合ノードかどうかを再帰的に判定
    let skip = false
    let current = node
    while (current && current.parentId) {
      if (parentConflictIds.has(current.parentId)) {
        skip = true
        break
      }
      current = allNodeMap[current.parentId]
    }
    if (skip) continue
    filteredConflicts.push(c)
    if (c.local) parentConflictIds.add(c.local.id)
    if (c.remote) parentConflictIds.add(c.remote.id)
  }
  // 競合ノードIDリストを再セット
  conflictIds = new Set(filteredConflicts.map(c => c.id))
  // autoMerged生成: 競合ノード自身・親が競合ノードのものは除外
  const autoMerged: any[] = []
  for (const id of allIds) {
    if (conflictIds.has(id)) continue
    if (hasConflictAncestor(id)) continue
    const base = baseMap[id]
    const local = myMap[id]
    const remote = fetchedMap[id]
    // 追加ノード
    if (!base && local && !remote) {
      autoMerged.push(local)
      continue
    }
    if (!base && !local && remote) {
      autoMerged.push(remote)
      continue
    }
    // 追加だが両方で同じ内容
    if (!base && local && remote) {
      if (local.hash === remote.hash && local.name === remote.name && local.parentId === remote.parentId && local.depth === remote.depth) {
        autoMerged.push(local)
        continue
      }
    }
    // 変更
    if (base && local && remote) {
      const localChanged = base.hash !== local.hash || base.name !== local.name || base.parentId !== local.parentId || base.depth !== local.depth
      const remoteChanged = base.hash !== remote.hash || base.name !== remote.name || base.parentId !== remote.parentId || base.depth !== remote.depth
      if (localChanged && !remoteChanged) {
        autoMerged.push(local)
        continue
      } else if (!localChanged && remoteChanged) {
        autoMerged.push(remote)
        continue
      } else if (!localChanged && !remoteChanged) {
        // 何もしない
        continue
      } else if (localChanged && remoteChanged && (
        local.hash === remote.hash && local.name === remote.name && local.parentId === remote.parentId && local.depth === remote.depth
      )) {
        autoMerged.push(local)
        continue
      }
    }
  }

  console.log('allConflicts', allConflicts);
  console.log('filteredConflicts', filteredConflicts);
  console.log('autoMerged', autoMerged);

  return { autoMerged, conflicts: filteredConflictsFinal, allNodeMap, getNodePathForMap }
})

const conflictChoices = ref<Record<string, 'local'|'remote'>>({})

function collectDescendantIds(node: any, nodeMap: Record<string, any>): Set<string> {
  const ids = new Set<string>();
  function dfs(n: any) {
    if (!n) return;
    ids.add(n.id);
    for (const child of Object.values(nodeMap)) {
      if (child.parentId === n.id) dfs(child);
    }
  }
  dfs(node);
  return ids;
}

function onResolve() {
  // 1. baseNodesをベースに
  const baseMap: Record<string, any> = mapById(props.baseNodes);
  const myMap: Record<string, any> = mapById(props.myNodes);
  const fetchedMap: Record<string, any> = mapById(props.fetchedNodes);

  // 2. 競合で「選択しなかった側」の差分を消す
  let excludeIds = new Set<string>();

  for (const c of mergeResult.value.conflicts) {
    const choice = conflictChoices.value[c.key];
    let notChosen = null;
    if (choice === 'local') {
      notChosen = c.remote;
    } else if (choice === 'remote') {
      notChosen = c.local;
    }
    if (notChosen) {
      // notChosenノード＋子孫IDを取得
      const allNodeMap = { ...baseMap, ...myMap, ...fetchedMap };
      const ids = collectDescendantIds(notChosen, allNodeMap);
      for (const id of ids) excludeIds.add(id);
    }
  }

  // 3. baseNodesからexcludeIdsを除外したものが新しいドラフト
  const merged = props.baseNodes.filter(n => !excludeIds.has(n.id));

  emit('resolve', merged, mergeResult.value.conflicts.length);
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
            <li v-for="c in mergeResult.conflicts" :key="c.key" style="margin-bottom:0.7em;">
              <div class="diff-deleted">
                <span class="diff-sign">ー</span>{{ c.base ? mergeResult.getNodePathForMap(c.base, mergeResult.allNodeMap) : '削除' }}
              </div>
              <div class="diff-added" style="display:flex; align-items:center; gap:1em;">
                <span class="diff-sign">＋</span>{{ c.local ? mergeResult.getNodePathForMap(c.local, mergeResult.allNodeMap) : '削除' }}
                <input type="radio" :name="'conflict-'+c.key" value="local" v-model="conflictChoices[c.key]">
                <span style="font-size:0.95em; color:#347474;">自分</span>
              </div>
              <div class="diff-added" style="margin-top:0.2em; display:flex; align-items:center; gap:1em;">
                <span class="diff-sign">＋</span>{{ c.remote ? mergeResult.getNodePathForMap(c.remote, mergeResult.allNodeMap) : '削除' }}
                <input type="radio" :name="'conflict-'+c.key" value="remote" v-model="conflictChoices[c.key]">
                <span style="font-size:0.95em; color:#c41d7f;">fetch</span>
              </div>
              <div v-if="!conflictChoices[c.key]" style="color:#c41d7f; font-size:0.93em; margin-top:0.2em;">どちらかを選択してください</div>
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

<script lang="ts">
export default {}
</script>