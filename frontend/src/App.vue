<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useStore } from 'vuex'
import OrganizationTree from './components/OrganizationTree.vue'
import DraftStateBar from './components/DraftStateBar.vue'
import ToastMessage from './components/ToastMessage.vue'
import CommitHistoryModal from './components/CommitHistoryModal.vue'
import ShareModal from './components/ShareModal.vue'
import type { CSSProperties } from 'vue'

const store = useStore()
const treeId = ref('')
const treeNodes = ref([])
const loading = ref(true)
const error = ref('')
const showDiff = ref(false)
const diffResult = ref<{ added: any[]; updated: any[]; deleted: any[] }>({ added: [], updated: [], deleted: [] })
const baseFlat = computed(() => flatten(treeNodes.value))
const toast = ref<{ message: string; type: 'success' | 'error' } | null>(null)
const commitMessage = ref('')
const isCommitting = ref(false)
const commitId = ref('')
const showTagModal = ref(false)
const tagName = ref<string | undefined>(undefined)
const tagInput = ref('')
const isTagSubmitting = ref(false)
const commitList = ref<{ id: string, message: string, author: string, created_at: string, tree_id: string, parent_commit_id: string | null }[]>([])
const showHistoryModal = ref(false)
const appliedCommitId = ref('')
const isShared = ref(false)
const showShareModal = ref(false)
const sharedCommits = ref<any[]>([])
const shareLoading = ref(false)
const showSyncTooltip = ref(false)

const hasDraft = computed(() => {
  const diff = calcDiff(treeNodes.value, store.state.draftNodes)
  if (diff.added.length > 0 || diff.updated.length > 0 || diff.deleted.length > 0) {
    console.log('未コミットの差分:', diff)
  }
  return diff.added.length > 0 || diff.updated.length > 0 || diff.deleted.length > 0
})

function unflatten(nodes: any[]): any[] {
  const nodeMap: Record<string, any> = {}
  nodes.forEach(n => {
    nodeMap[n.id] = { ...n, children: [] }
  })
  nodes.forEach(n => {
    if (n.parentId && nodeMap[n.parentId]) {
      nodeMap[n.parentId].children.push(nodeMap[n.id])
    }
  })
  // 各childrenをname昇順+id昇順で安定ソート
  Object.values(nodeMap).forEach((n: any) => {
    if (n.children && n.children.length > 0) {
      n.children.sort((a: any, b: any) => {
        const nameCmp = a.name.localeCompare(b.name, 'ja')
        if (nameCmp !== 0) return nameCmp
        return a.id.localeCompare(b.id)
      })
    }
  })
  // parentIdがnull、またはdraftNodes内に親がいないものだけをルートに
  const roots = nodes.filter(n => !n.parentId || !nodeMap[n.parentId]).map(n => nodeMap[n.id])
  // ルートもname昇順+id昇順で安定ソート
  roots.sort((a: any, b: any) => {
    const nameCmp = a.name.localeCompare(b.name, 'ja')
    if (nameCmp !== 0) return nameCmp
    return a.id.localeCompare(b.id)
  })
  return roots
}

const displayNodes = computed(() => {
  // 常にunflattenでchildren/rootsをソートして表示
  return hasDraft.value
    ? unflatten(store.state.draftNodes)
    : unflatten(flatten(treeNodes.value))
})

async function fetchLatestTree() {
  loading.value = true
  try {
    const commitRes = await fetch('http://localhost:3001/api/commits/latest')
    if (!commitRes.ok) throw new Error('最新コミット取得失敗')
    const commit = await commitRes.json()
    commitId.value = commit.id
    treeId.value = commit.tree_id
    const treeRes = await fetch(`http://localhost:3001/api/trees/${treeId.value}`)
    if (!treeRes.ok) throw new Error('ツリー構造取得失敗')
    const treeData = await treeRes.json()
    treeNodes.value = treeData.nodes
    store.commit('setDraftNodes', flatten(treeData.nodes))
  } catch (e: any) {
    error.value = e.message || '不明なエラー'
  } finally {
    loading.value = false
  }
}

async function fetchCommitList() {
  try {
    const res = await fetch('http://localhost:3001/api/commits')
    commitList.value = await res.json()
  } catch (e) {
    // 必要ならエラー処理
  }
}

watch(commitId, (v) => { appliedCommitId.value = v })

// parent_commit_idを辿って現在のappliedCommitIdから到達可能な履歴のみをリストアップ
const filteredCommitList = computed(() => {
  const map = new Map(commitList.value.map(c => [c.id, c]))
  const result = []
  let cur = map.get(appliedCommitId.value)
  while (cur) {
    result.push(cur)
    cur = cur.parent_commit_id ? map.get(cur.parent_commit_id) : undefined
  }
  return result
})

async function applyCommitToDraftById(commitId: string) {
  const commit = commitList.value.find(c => c.id === commitId)
  if (!commit) return
  const treeRes = await fetch(`http://localhost:3001/api/trees/${commit.tree_id}`)
  const treeData = await treeRes.json()
  store.commit('setDraftNodes', flatten(treeData.nodes))
  showToast('選択したコミット内容をドラフトに適用しました', 'success')
  appliedCommitId.value = commitId
  showHistoryModal.value = false
}

async function checkIsShared() {
  try {
    const res = await fetch('http://localhost:3001/api/commit_share')
    if (!res.ok) throw new Error('共有一覧取得失敗')
    const shares = await res.json()
    isShared.value = shares.some((s: any) => s.commit_id === commitId.value)
  } catch {
    isShared.value = false
  }
}

watch(commitId, () => { checkIsShared() })

onMounted(() => {
  fetchLatestTree()
  fetchCommitList()
  checkIsShared()
})

function flatten(nodes: any[], parentId: string | null = null): any[] {
  const res: any[] = []
  function dfs(n: any, parentId: string | null) {
    res.push({ ...n, parentId })
    if (n.children) (n.children as any[]).forEach((child: any) => dfs(child, n.id))
  }
  nodes.forEach((n: any) => dfs(n, parentId))
  return res
}

function calcDiff(baseNodes: any[], draftNodes: any[]): { added: any[]; updated: any[]; deleted: any[] } {
  // baseNodes: ネスト構造 → フラット化
  const baseFlat = flatten(baseNodes)
  const draftFlat = draftNodes // こちらは既にフラット
  const baseMap = baseFlat.reduce((acc: Record<string, any>, n: any) => { acc[n.id] = n; return acc }, {} as Record<string, any>)
  const draftMap = draftFlat.reduce((acc: Record<string, any>, n: any) => { acc[n.id] = n; return acc }, {} as Record<string, any>)
  const added = draftFlat.filter((n: any) => !baseMap[n.id])
  const deleted = baseFlat.filter((n: any) => !draftMap[n.id])
  const updated = draftFlat.filter((n: any) => {
    const b = baseMap[n.id]
    return b && (b.name !== n.name || b.parentId !== n.parentId || b.depth !== n.depth)
  })
  return { added, updated, deleted }
}

function onDiff() {
  diffResult.value = calcDiff(treeNodes.value, store.state.draftNodes)
  showDiff.value = true
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { message, type }
}

function onCommitFromDiff() {
  const message = commitMessage.value.trim()
  if (!message) {
    showToast('コミットメッセージを入力してください', 'error')
    return
  }
  isCommitting.value = true
  // 楽観的UI: 先にUIを更新
  showDiff.value = false
  commitMessage.value = ''
  const prevDraftNodes = [...store.state.draftNodes]
  store.dispatch('commitDraft', { treeId: treeId.value, author: 'admin_user', message, parent_commit_id: appliedCommitId.value })
    .then(async (data: any) => {
      showToast('コミット完了: ' + data.commit_id, 'success')
      await fetchLatestTree()
    })
    .catch((e: any) => {
      // ロールバック
      store.commit('setDraftNodes', prevDraftNodes)
      showToast('コミット失敗: ' + (e.message || e), 'error')
      isCommitting.value = false
    })
}

function getNodePath(node: any, baseFlatArr: any[]): string {
  const path: string[] = []
  let current = node
  const map = baseFlatArr.reduce((acc: Record<string, any>, n: any) => { acc[n.id] = n; return acc }, {} as Record<string, any>)
  while (current) {
    path.unshift(current.name)
    current = current.parentId ? map[current.parentId] : null
  }
  return path.join(' / ')
}

function getOldNode(newNode: any) {
  // baseNodesはflatten済み
  const baseFlat = flatten(treeNodes.value)
  return baseFlat.find((n: any) => n.id === newNode.id) || {}
}

function openTagModal() {
  showTagModal.value = true
}

function closeTagModal() {
  showTagModal.value = false
}

async function fetchTagName(commitId: string) {
  try {
    const res = await fetch(`http://localhost:3001/api/tags/${commitId}`)
    if (!res.ok) {
      tagName.value = undefined
      return
    }
    const tag = await res.json()
    tagName.value = tag?.name || undefined
  } catch {
    tagName.value = undefined
  }
}

watch(
  [() => hasDraft.value, () => commitId.value],
  ([draft, cid]) => {
    if (!draft && cid) {
      fetchTagName(cid)
    } else {
      tagName.value = undefined
    }
  },
  { immediate: true }
)

async function submitTag() {
  const name = tagInput.value.trim()
  if (!name) {
    showToast('タグ名を入力してください', 'error')
    return
  }
  if (name.length > 50) {
    showToast('タグ名は50文字以内で入力してください', 'error')
    return
  }
  isTagSubmitting.value = true
  try {
    const res = await fetch('http://localhost:3001/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commit_id: commitId.value, name })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      if (res.status === 409) {
        if (err?.error && err.error.includes('タグ名')) {
          showToast('このタグ名は既に使われています', 'error')
        } else {
          showToast('このコミットには既にタグが付与されています', 'error')
        }
      } else if (err?.error) {
        showToast('タグ付与失敗: ' + err.error, 'error')
      } else {
        showToast('タグ付与に失敗しました', 'error')
      }
      return
    }
    const data = await res.json()
    tagName.value = data.name
    showToast('タグを付与しました', 'success')
    await fetchCommitList()
    closeTagModal()
  } catch (e: any) {
    showToast('タグ付与に失敗しました', 'error')
  } finally {
    isTagSubmitting.value = false
  }
}

watch(showTagModal, (v) => {
  if (v) {
    tagInput.value = tagName.value || ''
  }
})

function onClearDraft() {
  store.commit('setDraftNodes', [])
  fetchLatestTree()
  fetchCommitList()
  appliedCommitId.value = commitId.value
  showToast('ドラフトをクリアしました', 'success')
}

async function openShareModal() {
  showShareModal.value = true
  shareLoading.value = true
  try {
    const res = await fetch('http://localhost:3001/api/commit_share')
    sharedCommits.value = await res.json()
  } catch {
    sharedCommits.value = []
  } finally {
    shareLoading.value = false
  }
}

function closeShareModal() {
  showShareModal.value = false
}

async function handlePushShare() {
  shareLoading.value = true
  try {
    const res = await fetch('http://localhost:3001/api/commit_share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commit_id: commitId.value })
    })
    if (!res.ok) {
      if (res.status === 409) {
        showToast('このコミットは既に共有されています', 'error')
        isShared.value = true
        return
      }
      throw new Error('共有に失敗しました')
    }
    showToast('コミットを共有しました', 'success')
    isShared.value = true
    closeShareModal()
  } catch (e: any) {
    showToast('共有に失敗しました', 'error')
  } finally {
    shareLoading.value = false
  }
}

function handleFetchShare() {
  // fetch案内時のfetchボタン押下時の処理（必要に応じて実装）
  showToast('fetch機能は未実装です', 'error')
}

const iconButtonStyle = computed<CSSProperties>(() => ({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1.25em',
  color: '#347474',
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  margin: 0,
  padding: '10px',
  minWidth: 'unset',
  minHeight: 'unset',
}))
</script>

<template>
  <div>
    <ToastMessage
      v-if="toast"
      :message="toast.message"
      :type="toast.type"
      @close="toast = null"
    />
    <h1>組織構造ツリー</h1>
    <div style="display: flex; align-items: center; margin-bottom: 0.7em;">
      <DraftStateBar
        :hasDraft="!isCommitting && hasDraft"
        :tagName="tagName"
        :commitId="commitId"
        @diff="onDiff"
        @edit-tag="openTagModal"
        @clear="onClearDraft"
      />
      <div style="margin-left: auto; display: flex; gap: 0;">
        <button
          @click="showHistoryModal = true"
          title="コミット履歴を表示"
          :style="iconButtonStyle"
        >
          <span style="font-size:1.2em; margin:0; padding:0 12px;">🗂️</span>
          <span class="icon-label">履歴</span>
        </button>
        <button
          @click="openShareModal"
          title="このコミットを共有"
          :disabled="isShared"
          :style="{...iconButtonStyle, position: 'relative', opacity: isShared ? 0.4 : 1}"
          @mouseenter="showSyncTooltip = isShared"
          @mouseleave="showSyncTooltip = false"
        >
          <span style="font-size:1.2em; margin:0; padding:0 12px;">🌐</span>
          <span class="icon-label">同期</span>
          <div v-if="showSyncTooltip" class="sync-tooltip">最新に同期されています</div>
        </button>
      </div>
    </div>
    <div v-if="showHistoryModal">
      <CommitHistoryModal
        :show="showHistoryModal"
        :commitList="filteredCommitList"
        @apply="applyCommitToDraftById"
        @close="showHistoryModal = false"
      />
    </div>
    <div v-if="showTagModal" class="modal-overlay" @click.self="closeTagModal">
      <div class="modal-content">
        <h2>タグ付与</h2>
        <div style="margin-bottom: 1.2em;">
          <label style="font-weight: bold;">タグ名</label>
          <input v-model="tagInput" maxlength="50" style="width: 100%; margin-top: 0.5em; padding: 0.5em; border-radius: 6px; border: 1px solid #d0d6e1; font-size: 1em;" placeholder="タグ名を入力" :disabled="isTagSubmitting" />
        </div>
        <button @click="submitTag" :disabled="isTagSubmitting">
          <span v-if="isTagSubmitting" class="spinner" style="margin-right:0.7em;"></span>
          保存
        </button>
        <button @click="closeTagModal" :disabled="isTagSubmitting">閉じる</button>
        <div v-if="isTagSubmitting" class="modal-committing-overlay">
          <span class="spinner"></span>
        </div>
      </div>
    </div>
    <div v-if="loading">読み込み中...</div>
    <div v-else-if="error">エラー: {{ error }}</div>
    <OrganizationTree :nodes="displayNodes" :maxDepth="5" />
    <div v-if="showDiff" class="modal-overlay" @click.self="isCommitting ? null : showDiff = false">
      <div class="modal-content" style="position:relative;">
        <h2>差分</h2>
        <div class="modal-scroll-area">
          <div v-if="diffResult.added.length">
            <h3>追加</h3>
            <ul>
              <li v-for="n in diffResult.added" :key="'a'+n.id" class="diff-added">
                <span class="diff-sign">＋</span>{{ getNodePath(n, baseFlat) }}
              </li>
            </ul>
          </div>
          <div v-if="diffResult.deleted.length">
            <h3>削除</h3>
            <ul>
              <li v-for="n in diffResult.deleted" :key="'d'+n.id" class="diff-deleted">
                <span class="diff-sign">ー</span>{{ getNodePath(n, baseFlat) }}
              </li>
            </ul>
          </div>
          <div v-if="diffResult.updated.length">
            <h3>変更</h3>
            <ul>
              <li v-for="n in diffResult.updated" :key="'u'+n.id">
                <div class="diff-deleted">
                  <span class="diff-sign">ー</span>{{ getNodePath(getOldNode(n), baseFlat) }}
                </div>
                <div class="diff-added">
                  <span class="diff-sign">＋</span>{{ getNodePath(n, baseFlat) }}
                </div>
              </li>
            </ul>
          </div>
        </div>
        <div style="margin-bottom: 1.2em;">
          <label style="font-weight: bold;">コミットメッセージ</label>
          <input v-model="commitMessage" maxlength="100" style="width: 100%; margin-top: 0.5em; padding: 0.5em; border-radius: 6px; border: 1px solid #d0d6e1; font-size: 1em;" placeholder="コミット内容を入力" :disabled="isCommitting" />
        </div>
        <button @click="onCommitFromDiff" :disabled="isCommitting">
          <span v-if="isCommitting" class="spinner" style="margin-right:0.7em;"></span>
          コミット
        </button>
        <button @click="showDiff = false" :disabled="isCommitting">閉じる</button>
        <div v-if="isCommitting" class="modal-committing-overlay">
          <span class="spinner"></span>
        </div>
      </div>
    </div>
    <ShareModal
      :show="showShareModal"
      :onClose="closeShareModal"
      :currentCommit="{ id: commitId, created_at: commitList.find(c => c.id === commitId)?.created_at || '' }"
      :sharedCommits="sharedCommits"
      :loading="shareLoading"
      :onPush="handlePushShare"
      :onFetch="handleFetchShare"
    />
  </div>
</template>

<style scoped>
h1 {
  font-size: 1.5em;
  margin-bottom: 1em;
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
.diff-added,
.diff-deleted {
  background: #e6ffed !important;
  color: #237804 !important;
  border-radius: 4px;
  margin-bottom: 0.3em;
  padding: 0.2em 0.7em;
  font-family: monospace;
  text-align: left;
}
.diff-deleted {
  background: #fff1f0 !important;
  color: #c41d7f !important;
}
.diff-sign {
  font-weight: bold;
  margin-right: 0.5em;
  font-size: 1.1em;
}
.modal-content ul {
  list-style: none;
  padding-left: 0;
}
.modal-content ul li {
  margin-bottom: 1.2em;
}
.modal-content ul li:last-child {
  margin-bottom: 0;
}
.modal-content ul li > .diff-deleted + .diff-added {
  margin-top: 0.4em;
}
.diff-btn, .modal-content button {
  background: #347474;
  color: #fff !important;
  border: none;
  border-radius: 6px;
  padding: 0.5em 1.5em;
  font-weight: 600;
  font-size: 1em;
  margin: 0.5em 0.5em 0.5em 0;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(52,116,116,0.07);
}
.diff-btn:hover, .modal-content button:hover {
  background: #255a5a;
  color: #fff !important;
}
.modal-content button:last-child {
  background: #e0e4ea;
  color: #2d3a4a !important;
}
.modal-content button:last-child:hover {
  background: #cfd4de;
  color: #2d3a4a !important;
}
.modal-content > div[v-if] {
  margin-bottom: 1.5em;
}
.modal-committing-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 12px;
}
.spinner {
  width: 1.3em;
  height: 1.3em;
  border: 3px solid #347474;
  border-top: 3px solid #e0e4ea;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.modal-content .apply-btn {
  background: #347474;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 0.4em 1.2em;
  font-weight: bold;
  cursor: pointer;
}
.modal-scroll-area {
  min-height: 200px;
  max-height: 60vh;
  overflow-y: auto;
}
.sync-tooltip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  background: #222;
  color: #fff;
  padding: 0.4em 1.1em;
  border-radius: 7px;
  font-size: 0.98em;
  white-space: nowrap;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0,0,0,0.13);
  pointer-events: none;
}
.icon-label {
  font-size: 0.78em;
  color: #888;
  display: block;
  margin-top: 2px;
  text-align: center;
  letter-spacing: 0.05em;
}
</style>

<style>
body {
  background: #f6f7fa !important;
  color: #2d3a4a !important;
}

#app, html {
  background: #f6f7fa !important;
  color: #2d3a4a !important;
}

/* 強制的にlight themeを維持 */
* {
  background-color: inherit;
  color: inherit;
  box-shadow: none;
}

.tree-table, .modal-content, .edit-panel, .draft-bar {
  background: #fcfdff !important;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(60,60,60,0.06);
}

.tree-table th {
  color: #347474;
}

.tree-table td {
  background: #fafdff !important;
  color: #2d3a4a !important;
}

.leaf-cell {
  background: #e6f7ff !important;
  color: #1a3a6b !important;
}

.parent-cell {
  background: #fafdff !important;
  color: #6b7685 !important;
}

.selected-cell {
  background: #ffe6b3 !important;
  border: 2px solid #ffb300;
}

.modal-overlay {
  background: rgba(0,0,0,0.18) !important;
}
</style>
