<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick, onUnmounted } from 'vue'
import { useStore } from 'vuex'
import OrganizationTree from './components/OrganizationTree.vue'
import DraftStateBar from './components/DraftStateBar.vue'
import ToastMessage from './components/ToastMessage.vue'
import CommitHistoryModal from './components/CommitHistoryModal.vue'
import ShareModal from './components/ShareModal.vue'
import DiffModal from './components/DiffModal.vue'
import TagModal from './components/TagModal.vue'
import FetchCompareView from './components/FetchCompareView.vue'
import LoginForm from './components/LoginForm.vue'
import type { CSSProperties } from 'vue'
import HeaderBar from './components/HeaderBar.vue'
import FetchDiffMergeModal from './components/FetchDiffMergeModal.vue'
import { calcThreeWayMerge } from './utils/threeWayMerge'

const store = useStore()
const treeId = ref('')
const treeNodes = ref<any[]>([])
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
const isSharedCommitNewer = computed(() => {
  if (!latestSharedCommit.value || !commitList.value.length) return false
  const myLatestCommit = commitList.value.find(c => c.id === commitId.value)
  if (!myLatestCommit) return false
  return new Date(latestSharedCommit.value.shared_at) > new Date(myLatestCommit.created_at)
})
const syncTooltipText = computed(() => {
  if (hasDraft.value) return '未コミットの変更があります'
  if (isSharedCommitNewer.value) return '新しい共有コミットがあります'
  if (isShared.value) return '最新に同期されています'
  return ''
})
const user = ref<string>(localStorage.getItem('user') || '')
const userId = ref<string>(localStorage.getItem('userId') || '')
const token = ref<string>(localStorage.getItem('token') || '')
const loginName = ref('')
const loginPassword = ref('')
const loginError = ref('')
const isLoggingIn = ref(false)
const noCommit = ref(false)
const latestSharedCommit = ref<any>(null)
const showFetchCompare = ref(false)
const fetchedDraftNodes = ref<any[]>([])
const loadingMerge = ref(false)
const sharedCommitIds = ref<string[]>([])
const baseNodes = ref<any[]>([])
const baseLoading = ref(false)
const showFetchDiffMergeModal = ref(false)
const hasConflict = ref(false)

const hasDraft = computed(() => {
  const diff = calcDiff(flatten(treeNodes.value), store.state.draftNodes)
  if (diff.added.length > 0 || diff.updated.length > 0 || diff.deleted.length > 0) {
    console.log('未コミットの差分:', diff)
  }
  return diff.added.length > 0 || diff.updated.length > 0 || diff.deleted.length > 0
})

// 未fetch共有コミットがあるか判定
const hasUnfetchedSharedCommit = computed(() => {
  if (!sharedCommits.value.length || !commitList.value.length) return false
  // 共有コミットのうち、自分のコミットのparent_commit_idに含まれていないもの
  const myParentIds = new Set(commitList.value.map(c => c.parent_commit_id).filter(Boolean))
  return sharedCommits.value.some((s: any) => !myParentIds.has(s.commit_id))
})

function flatten(nodes: any[], parentId: string | null = null): any[] {
  const res: any[] = []
  const visited = new Set()
  function dfs(n: any, parentId: string | null) {
    if (visited.has(String(n.id))) return
    visited.add(String(n.id))
    // childrenを除外
    const { children, ...rest } = n
    res.push({ ...rest, id: String(n.id), parentId: parentId === undefined || parentId === '' ? null : parentId })
    if (Array.isArray(n.children)) n.children.forEach((child: any) => dfs(child, n.id))
  }
  nodes.forEach((n: any) => dfs(n, parentId))
  return res
}

function unflatten(nodes: any[]): any[] {
  const nodeMap: Record<string, any> = {}
  nodes.forEach(n => { nodeMap[n.id] = { ...n, children: [] } })
  nodes.forEach(n => {
    const parentKey = n.parentId == null ? null : String(n.parentId)
    if (parentKey && nodeMap[parentKey]) {
      nodeMap[parentKey].children.push(nodeMap[n.id])
    }
  })
  const roots = nodes.filter(n => n.parentId === null || n.parentId === '' || n.parentId === undefined || !nodeMap[n.parentId]).map(n => nodeMap[n.id])
  roots.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'ja') || a.id.localeCompare(b.id))
  return roots
}

const displayNodes = computed(() => {
  // 常にunflattenでchildren/rootsをソートして表示
  return hasDraft.value
    ? unflatten(store.state.draftNodes)
    : unflatten(flatten(treeNodes.value))
})

async function fetchLatestTree() {
  console.log('[fetchLatestTree] called')
  loading.value = true
  noCommit.value = false
  try {
    // 自分の最新コミットのみ取得
    const userId = localStorage.getItem('userId') || ''
    const commitRes = await fetch(`http://localhost:3001/api/commits?author=${encodeURIComponent(userId)}`)
    if (!commitRes.ok) {
      console.log('[fetchLatestTree] commitRes not ok')
      throw new Error('最新コミット取得失敗')
    }
    const commits = await commitRes.json()
    if (!commits.length) {
      console.log('[fetchLatestTree] commits.length === 0')
      // コミットがない場合は最新の共有コミットを取得
      noCommit.value = true
      // 最新のorg_commit_shareを取得
      const shareRes = await fetch('http://localhost:3001/api/commit_share')
      if (shareRes.ok) {
        const shares = await shareRes.json()
        latestSharedCommit.value = shares.length ? shares[0] : null
      } else {
        latestSharedCommit.value = null
      }
      // ローカルドラフトも空にする（初回fetch時の左側を空表に）
      store.commit('setDraftNodes', [])
      console.log('noCommit', noCommit.value)
      return
    }
    const commit = commits[0] // 最新（created_at DESC）
    commitId.value = commit.id
    treeId.value = commit.tree_id
    // ここで常に最新共有コミットを取得
    try {
      const shareRes = await fetch('http://localhost:3001/api/commit_share')
      if (shareRes.ok) {
        const shares = await shareRes.json()
        latestSharedCommit.value = shares.length ? shares[0] : null
      } else {
        latestSharedCommit.value = null
      }
    } catch {
      latestSharedCommit.value = null
    }
    const treeRes = await fetch(`http://localhost:3001/api/trees/${treeId.value}`)
    if (!treeRes.ok) {
      console.log('[fetchLatestTree] treeRes not ok')
      throw new Error('ツリー構造取得失敗')
    }
    const treeData = await treeRes.json()
    console.log('[fetchLatestTree] treeData.nodes:', treeData.nodes)
    console.log('root:', treeData.nodes[0])
    console.log('child:', treeData.nodes[0].children[0])
    console.log('grandchild:', treeData.nodes[0].children[0]?.children?.[0])
    treeNodes.value = treeData.nodes
    store.commit('setDraftNodes', flatten(treeData.nodes))
    await fetchCommitList()
  } catch (e: any) {
    console.log('[fetchLatestTree] catch', e)
    error.value = e.message || '不明なエラー'
  } finally {
    loading.value = false
  }
}

async function fetchCommitList() {
  try {
    // 1. 自分のコミットのみ取得
    const myCommits = await store.dispatch('fetchMyCommits')
    // 2. 共有コミットも取得
    let sharedCommitsArr = []
    if (sharedCommitIds.value.length > 0) {
      const sharedRes = await fetch(`http://localhost:3001/api/commits?ids=${sharedCommitIds.value.join(',')}`)
      if (sharedRes.ok) {
        sharedCommitsArr = await sharedRes.json()
      }
    }
    // 3. 重複を除いてマージ
    const allCommits = [...myCommits]
    for (const s of sharedCommitsArr) {
      if (!allCommits.some((c: any) => c.id === s.id)) {
        allCommits.push(s)
      }
    }
    commitList.value = allCommits
  } catch (e) {
    // 必要ならエラー処理
  }
}

watch(commitId, (v) => { appliedCommitId.value = v })

// parent_commit_idを辿って現在のappliedCommitIdから到達可能な履歴のみをリストアップ
const filteredCommitList = computed(() => {
  const myUserName = user.value // ログインユーザー名
  const map = new Map(commitList.value.map(c => [c.id, c]))
  const result = []
  let cur = map.get(appliedCommitId.value)
  // 1つ目（現在のコミット）はスキップし、親から履歴をたどる
  if (cur) cur = cur.parent_commit_id ? map.get(cur.parent_commit_id) : undefined
  while (cur) {
    if (cur.author === myUserName) {
      result.push(cur)
    }
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
  console.log('isShared', isShared.value)
}

watch(commitId, () => { checkIsShared() })

onMounted(() => {
  fetchLatestTree()
  fetchCommitList()
  checkIsShared()
  fetchSharedCommitIds()
  // Draftがある場合にbeforeunloadで警告
  const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
    if (hasDraft.value) {
      e.preventDefault()
      e.returnValue = '未コミットのドラフトデータがあります。本当にページを離れますか？'
      return e.returnValue
    }
  }
  window.addEventListener('beforeunload', beforeUnloadHandler)
  onUnmounted(() => {
    window.removeEventListener('beforeunload', beforeUnloadHandler)
  })
})

function nodeForCompare(n: any) {
  return {
    id: String(n.id),
    name: String(n.name),
    parentId: n.parentId == null ? null : String(n.parentId),
    depth: n.depth == null ? null : Number(n.depth),
    hash: n.hash ?? null, // hashも比較対象に
  }
}

function calcDiff(baseNodes: any[], draftNodes: any[]): { added: any[]; updated: any[]; deleted: any[] } {
  // flatten不要
  const baseFlat = baseNodes.map(nodeForCompare)
  const draftFlat = draftNodes.map(nodeForCompare)
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
  diffResult.value = calcDiff(flatten(treeNodes.value), store.state.draftNodes)
  showDiff.value = true
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { message, type }
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
  [() => hasDraft.value, () => appliedCommitId.value],
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

async function handleFetchShare() {
  await fetchLatestSharedCommit()
}

async function fetchLatestSharedCommit() {
  if (!latestSharedCommit.value || !latestSharedCommit.value.tree_id) {
    showToast('共有コミットのtree_idが取得できません', 'error')
    return
  }
  try {
    const treeRes = await fetch(`http://localhost:3001/api/trees/${latestSharedCommit.value.tree_id}`)
    if (!treeRes.ok) throw new Error('ツリー構造取得失敗')
    const treeData = await treeRes.json()
    console.log('[fetchLatestSharedCommit] treeData.nodes:', treeData.nodes)
    console.log('[flatten result]', flatten(treeData.nodes))
    fetchedDraftNodes.value = flatten(treeData.nodes)
    showFetchCompare.value = true
  } catch (e: any) {
    showToast('共有コミットのfetchに失敗しました', 'error')
  }
}

function onSyncFetchClick() {
  if (hasDraft.value) {
    showToast('未コミットの変更があります', 'error')
    return
  }
  fetchLatestSharedCommit()
}

function onSyncButtonHover() {
  showSyncTooltip.value = !!(hasDraft.value || isShared.value)
}

const iconButtonStyle = computed<CSSProperties>(() => ({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1.25em',
  color: '#222',
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  margin: 0,
  padding: '10px',
  minWidth: 'unset',
  minHeight: 'unset',
}))

async function handleLogin(isRegister = false) {
  loginError.value = ''
  isLoggingIn.value = true
  try {
    const url = isRegister ? 'http://localhost:3001/api/register' : 'http://localhost:3001/api/login'
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loginName.value, password: loginPassword.value })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      loginError.value = err?.error || (isRegister ? '登録失敗' : 'ログイン失敗')
      return
    }
    const data = await res.json()
    user.value = loginName.value
    userId.value = data.userId
    token.value = data.token || ''
    localStorage.setItem('user', user.value)
    localStorage.setItem('userId', userId.value)
    localStorage.setItem('token', token.value)
    loginName.value = ''
    loginPassword.value = ''
  } catch (e) {
    loginError.value = '通信エラー'
  } finally {
    isLoggingIn.value = false
  }
}

function handleLogout() {
  user.value = ''
  userId.value = ''
  token.value = ''
  localStorage.removeItem('user')
  localStorage.removeItem('userId')
  localStorage.removeItem('token')
}

async function onMergeClick() {
  if (!fetchedDraftNodes.value.length) {
    showToast('マージ対象がありません', 'error')
    return
  }
  loadingMerge.value = true
  try {
    // 1. fetchした内容をローカルドラフトに上書き
    store.commit('setDraftNodes', [...fetchedDraftNodes.value])

    // 2. 差分判定（flatten不要！）
    const base = fetchedDraftNodes.value.map(nodeForCompare)
    const draft = store.state.draftNodes.map(nodeForCompare)
    // デバッグ: 差分の詳細出力
    for (let i = 0; i < base.length; i++) {
      const b = base[i]
      const d = draft.find((n: any) => n.id === b.id)
      if (!d) {
        console.log('draftに存在しない', b)
        continue
      }
      if (b.name !== d.name) console.log('name違い', b, d)
      if (b.parentId !== d.parentId) console.log('parentId違い', b, d)
      if (b.depth !== d.depth) console.log('depth違い', b, d)
    }
    const diff = calcDiff(base, draft)
    console.log('updated diff', diff.updated)
    const isNoDiff = diff.added.length === 0 && diff.updated.length === 0 && diff.deleted.length === 0

    // 3. ツリー表示用にも反映
    treeNodes.value = [...fetchedDraftNodes.value]

    if (isNoDiff) {
      if (latestSharedCommit.value && latestSharedCommit.value.commit_id) {
        try {
          // 親コミットのcreated_atを取得
          const commitRes = await fetch(`http://localhost:3001/api/commits?id=${latestSharedCommit.value.commit_id}`)
          const commits = await commitRes.json()
          const parentCommit = Array.isArray(commits) ? commits[0] : commits
          const parentCreatedAt = parentCommit?.created_at

          const autoMessage = latestSharedCommit.value.message || 'fetch取り込み自動コミット'
          const res = await store.dispatch('commitDraft', {
            treeId: latestSharedCommit.value.tree_id,
            author: user.value || 'auto',
            message: autoMessage,
            parent_commit_id: latestSharedCommit.value.commit_id,
            created_at: latestSharedCommit.value.shared_at // org_commit_shareのshared_atをコピー
          })
          store.commit('clearDraft')
          // 親コミットのタグを新コミットにも付与
          if (latestSharedCommit.value && latestSharedCommit.value.tag_name) {
            try {
              const token = localStorage.getItem('token') || ''
              await fetch('http://localhost:3001/api/tags', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ commit_id: res.commit_id, name: latestSharedCommit.value.tag_name })
              })
            } catch (e) {
              // タグ付与失敗時は無視
            }
          }
          showToast('差分がないため、自動コミットを作成しました', 'success')
          await fetchLatestTree()
          await fetchCommitList()
          appliedCommitId.value = res.commit_id
          noCommit.value = false
        } catch (e) {
          showToast('自動コミット作成に失敗しました', 'error')
        }
      } else {
        showToast('共有コミットIDが取得できません', 'error')
      }
      showFetchCompare.value = false
      fetchedDraftNodes.value = []
      return
    }
    appliedCommitId.value = ''
    showToast('fetchした内容をドラフトに反映しました', 'success')
    showFetchCompare.value = false
    fetchedDraftNodes.value = []
    console.log('appliedCommitId', appliedCommitId.value)
  } finally {
    loadingMerge.value = false
  }
}

function onCancelFetchCompare() {
  fetchedDraftNodes.value = []
  showFetchCompare.value = false
}

async function fetchSharedCommitIds() {
  try {
    const res = await fetch('http://localhost:3001/api/commit_share')
    if (res.ok) {
      const shares = await res.json()
      sharedCommitIds.value = shares.map((s: any) => s.commit_id)
    } else {
      sharedCommitIds.value = []
    }
  } catch {
    sharedCommitIds.value = []
  }
}

const displayTagName = computed(() => {
  // 現在のappliedCommitIdのコミットを取得
  const currentCommit = commitList.value.find(c => c.id === (appliedCommitId.value || commitId.value))
  if (!currentCommit) return tagName.value
  // 親コミットが存在する場合
  if (currentCommit.parent_commit_id) {
    const parentCommit = commitList.value.find(c => c.id === currentCommit.parent_commit_id)
    // 親コミットが他ユーザー作成ならタグを取得して表示
    if (parentCommit && parentCommit.author !== user.value) {
      return parentTagName.value
    }
  }
  // それ以外は自身のコミットIDを表示
  return currentCommit.id
})

const parentTagName = ref<string | undefined>(undefined)
watch([
  () => appliedCommitId.value,
  () => commitList.value.length,
  () => sharedCommitIds.value.length
], async ([cid]) => {
  const currentCommit = commitList.value.find(c => c.id === (cid || commitId.value))
  if (currentCommit && currentCommit.parent_commit_id && sharedCommitIds.value.includes(currentCommit.parent_commit_id)) {
    // 親コミットのタグ名を取得
    try {
      const res = await fetch(`http://localhost:3001/api/tags/${currentCommit.parent_commit_id}`)
      if (res.ok) {
        const tag = await res.json()
        parentTagName.value = tag?.name || undefined
      } else {
        parentTagName.value = undefined
      }
    } catch {
      parentTagName.value = undefined
    }
  } else {
    parentTagName.value = undefined
  }
}, { immediate: true })

// タグ編集可否のcomputedを追加
const canEditTag = computed(() => {
  // 現在のappliedCommitIdのコミットを取得
  const currentCommit = commitList.value.find(c => c.id === (appliedCommitId.value || commitId.value))
  // 親コミットが存在し、かつ他ユーザー作成なら編集不可
  if (currentCommit && currentCommit.parent_commit_id) {
    const parentCommit = commitList.value.find(c => c.id === currentCommit.parent_commit_id)
    if (parentCommit && parentCommit.author !== user.value) {
      return false
    }
  }
  return true
})

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

function onFetchCompareDiff() {
  showFetchDiffMergeModal.value = true
}

function onCloseFetchDiffMergeModal() {
  showFetchDiffMergeModal.value = false
}

function onResolveFetchDiffMergeModal(nodes: any[], conflictCount?: number) {
  // ドラフトを更新
  store.commit('setDraftNodes', nodes)
  showFetchDiffMergeModal.value = false
  // 競合が残っていればhasConflictをtrue、なければfalse
  hasConflict.value = !!conflictCount
}

// DiffModalのbaseFlatもfetch用に切り替える
const fetchBaseFlat = computed(() => flatten(treeNodes.value))

// baseコミットID探索ロジック
async function updateBaseNodes() {
  baseLoading.value = true
  try {
    // 1. local, remote両方のcommit_idを取得
    // local: 自分の最新コミット
    const localCommit = commitList.value.find(c => c.id === commitId.value)
    // remote: fetchした共有コミット
    const remoteCommitShare = latestSharedCommit.value
    const remoteCommitId = remoteCommitShare?.commit_id
    if (!localCommit || !remoteCommitId) {
      baseNodes.value = []
      console.log('baseNodes: 共通baseコミットなし')
      return
    }
    // 2. merge-base APIでbaseコミットIDとtree_idを取得
    const res = await fetch(`http://localhost:3001/api/merge-base?local_commit_id=${localCommit.id}&remote_commit_id=${remoteCommitId}`)
    if (!res.ok) {
      baseNodes.value = []
      console.log('baseNodes: merge-base API失敗')
      return
    }
    const data = await res.json()
    if (!data.base_commit_id || !data.tree_id) {
      baseNodes.value = []
      console.log('baseNodes: 共通baseコミットなし')
      return
    }
    // 3. tree_idからノードリスト取得
    const treeRes = await fetch(`http://localhost:3001/api/trees/${data.tree_id}`)
    if (!treeRes.ok) {
      baseNodes.value = []
      console.log('baseNodes: tree API失敗')
      return
    }
    const treeData = await treeRes.json()
    baseNodes.value = flatten(treeData.nodes)
    console.log('baseNodes(flattened)', baseNodes.value[0])
    console.log('myNodes(flattened)', store.state.draftNodes[0])
    console.log('fetchedNodes(flattened)', fetchedDraftNodes.value[0])

    if (
      baseNodes.value.length > 0 &&
      localCommit && remoteCommitShare &&
      baseNodes.value[0].name === localCommit.name &&
      baseNodes.value[0].name === remoteCommitShare.name
    ) {
      console.log('skip: all same');
      baseNodes.value = []
      return
    }
  } finally {
    baseLoading.value = false
  }
}

// fetch比較モーダルを開くたびにbaseNodesを更新
watch([showFetchCompare, commitList, latestSharedCommit, sharedCommitIds], ([show]) => {
  if (show) updateBaseNodes()
})

// 3方向マージ競合判定watch
watch(
  [baseNodes, () => store.state.draftNodes, fetchedDraftNodes],
  ([base, my, fetched]) => {
    if (!base?.length || !my?.length || !fetched?.length) {
      hasConflict.value = false
      console.log('[競合判定] 判定スキップ base/my/fetched:', base?.length, my?.length, fetched?.length, '→ hasConflict:', hasConflict.value)
      return
    }
    const { conflicts } = calcThreeWayMerge(base, my, fetched)
    hasConflict.value = conflicts.length > 0
    console.log('[競合判定] base:', base.length, 'my:', my.length, 'fetched:', fetched.length, 'conflicts:', conflicts.length, '→ hasConflict:', hasConflict.value)
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <div style="display:flex; flex-direction:column; align-items:flex-start; min-height:100vh;">
    <HeaderBar :user="user" :userId="userId" @logout="handleLogout" />
    <div class="app-content">
      <template v-if="!userId">
        <LoginForm
          :loginName="loginName"
          :loginPassword="loginPassword"
          :loginError="loginError"
          :isLoggingIn="isLoggingIn"
          @login="handleLogin(false)"
          @register="handleLogin(true)"
          @update:loginName="loginName = $event"
          @update:loginPassword="loginPassword = $event"
        />
      </template>
      <template v-else>
        <ToastMessage
          v-if="toast"
          :message="toast.message"
          :type="toast.type"
          @close="toast = null"
        />
        <template v-if="!!showFetchCompare && fetchedDraftNodes.length > 0">
          <FetchCompareView
            :show="true"
            :loadingMerge="loadingMerge"
            :draftNodes="store.state.draftNodes"
            :fetchedDraftNodes="fetchedDraftNodes"
            :baseNodes="baseNodes"
            :hasConflict="hasConflict"
            @merge="onMergeClick"
            @cancel="onCancelFetchCompare"
            @diff="onFetchCompareDiff"
          />
        </template>
        <div v-else-if="noCommit && !hasDraft && !appliedCommitId" style="width:100%; background:#fffbe6; color:#ad8b00; border-radius:8px; padding:1.2em 1.5em; margin-bottom:1.5em;">
          <div style="font-weight:bold; font-size:1.1em; margin-bottom:0.7em;">まだコミットがありません</div>
          <button
            v-if="latestSharedCommit"
            @click="onSyncFetchClick"
            :disabled="hasDraft"
            style="background:#222; color:#fff; border:none; border-radius:6px; padding:0.6em 1.5em; font-weight:600; font-size:1em;"
          >最新の共有コミットをfetch</button>
          <div v-else style="color:#c41d7f;">共有コミットが存在しません</div>
        </div>
        <div v-else style="width:100%">
          <div style="display: flex; align-items: center; margin-bottom: 0.7em;">
            <DraftStateBar
              :hasDraft="!isCommitting && hasDraft"
              :tagName="displayTagName"
              :commitId="appliedCommitId || commitId"
              :canEditTag="canEditTag"
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
                :disabled="hasDraft || (!isSharedCommitNewer && (isShared || noCommit))"
                :style="{...iconButtonStyle, position: 'relative', opacity: (hasDraft || (!isSharedCommitNewer && (isShared || noCommit))) ? 0.4 : 1}"
                @mouseenter="onSyncButtonHover"
                @mouseleave="showSyncTooltip = false"
              >
                <span style="font-size:1.2em; margin:0; padding:0 12px;">🌐</span>
                <span class="icon-label">同期</span>
                <div v-if="showSyncTooltip" class="sync-tooltip">{{ syncTooltipText }}</div>
              </button>
            </div>
          </div>
          <div v-if="showHistoryModal">
            <CommitHistoryModal
              :show="showHistoryModal"
              :commitList="filteredCommitList"
              :sharedCommitIds="sharedCommitIds"
              @apply="applyCommitToDraftById"
              @close="showHistoryModal = false"
            />
          </div>
          <TagModal
            :show="showTagModal"
            :tagInput="tagInput"
            :isTagSubmitting="isTagSubmitting"
            @submit="submitTag"
            @close="closeTagModal"
            @update:tagInput="tagInput = $event"
          />
          <div v-if="loading">読み込み中...</div>
          <div v-else-if="error">エラー: {{ error }}</div>
          <OrganizationTree :nodes="displayNodes" :maxDepth="5" />
          <DiffModal
            :show="showDiff"
            :diffResult="diffResult"
            :baseFlat="fetchBaseFlat"
            :commitMessage="commitMessage"
            :isCommitting="isCommitting"
            @commit="onCommitFromDiff"
            @close="showDiff = false"
            @update:commitMessage="commitMessage = $event"
          />
          <ShareModal
            :show="showShareModal"
            :onClose="closeShareModal"
            :currentCommit="{ id: commitId, created_at: commitList.find(c => c.id === commitId)?.created_at || '' }"
            :sharedCommits="sharedCommits"
            :loading="shareLoading"
            :onPush="handlePushShare"
            :onFetch="handleFetchShare"
            :hasUnfetchedSharedCommit="hasUnfetchedSharedCommit"
          />
        </div>
        <FetchDiffMergeModal
          :show="showFetchDiffMergeModal"
          :baseNodes="baseNodes"
          :myNodes="store.state.draftNodes"
          :fetchedNodes="fetchedDraftNodes"
          @close="onCloseFetchDiffMergeModal"
          @resolve="onResolveFetchDiffMergeModal"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  max-width: 340px;
  min-width: 240px;
  width: 100%;
  margin: 80px auto 0 auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.13);
  padding: 2.5em 3em 2em 3em;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.login-container input {
  margin-bottom: 1em;
  padding: 0.7em;
  border-radius: 6px;
  border: 1px solid #d0d6e1;
  font-size: 1em;
}
.login-container button {
  background: #222;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.6em 1.5em;
  font-weight: 600;
  font-size: 1em;
  margin-bottom: 0.7em;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.login-container button:last-child {
  background: #e0e4ea;
  color: #2d3a4a;
}
.login-container button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
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
  background: #f6f8fa !important;
  color: #22863a !important;
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
  background: #444c56;
  color: #fff !important;
  border: none;
  border-radius: 6px;
  padding: 0.5em 1.5em;
  font-weight: 600;
  font-size: 1em;
  margin: 0.5em 0.5em 0.5em 0;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(60,60,60,0.07);
}
.diff-btn:hover, .modal-content button:hover {
  background: #586069;
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
  border: 3px solid #444c56;
  border-top: 3px solid #d1d5da;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.modal-content .apply-btn {
  background: #222;
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
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 56px;
  background: #2d333b;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 1200;
  padding: 0 24px;
  box-sizing: border-box;
  min-width: 0;
  box-shadow: 0 2px 8px rgba(60,60,60,0.07);
}
.header-title {
  font-size: 1.35em;
  font-weight: bold;
  letter-spacing: 0.04em;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-user {
  display: flex;
  align-items: center;
  gap: 1.2em;
  min-width: 0;
  max-width: 60vw;
  overflow: hidden;
}
.header-username {
  font-weight: bold;
  color: #fff;
  margin-right: 0.5em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-logout {
  background: #e0e4ea;
  color: #24292f;
  border-radius: 6px;
  border: none;
  padding: 0.3em 1.2em;
  cursor: pointer;
  font-weight: 600;
  font-size: 1em;
  transition: background 0.2s, color 0.2s;
}
.header-logout:hover {
  background: #cfd4de;
  color: #24292f;
}
.app-content {
  width: 100%;
  margin-top: 56px;
  /* ヘッダー分下げる */
  display: flex;
  flex-direction: column;
  align-items: flex-start;
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
  color: #444c56;
}

.tree-table td {
  background: #fafdff !important;
  color: #444c56 !important;
}

.leaf-cell {
  background: #f6f8fa !important;
  color: #444c56 !important;
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

.draft-bar {
  background: #f6f8fa;
  border: 1px solid #d1d5da;
  color: #444c56;
  padding: 0.7em 1.2em;
  border-radius: 6px;
  margin: 1em 0;
  display: flex;
  align-items: center;
  gap: 1em;
}
.draft-bar.no-draft {
  background: #f6f8fa;
  border: 1px solid #d1d5da;
  color: #586069;
}
.dot {
  color: #444c56;
  font-size: 1.2em;
  margin-right: 0.5em;
}
.tag-icon {
  color: #444c56;
  margin-right: 0.3em;
}
.tag-label {
  color: #444c56;
}
button {
  background: #444c56;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 0.4em 1.2em;
  font-weight: bold;
  cursor: pointer;
}
.tag-display-btn {
  display: flex;
  align-items: center;
  gap: 0.3em;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.2em 0.7em;
  border-radius: 6px;
  transition: background 0.18s;
}
.tag-display-btn:hover, .tag-display-btn:focus {
  background: #d1d5da;
  outline: none;
}
.edit-panel button {
  background: #444c56;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  font-size: 1em;
  cursor: pointer;
  padding: 0.6em 2.2em;
  margin: 0 0.5em;
  transition: background 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(60,60,60,0.07);
}
.edit-panel button:hover {
  background: #586069;
}
.edit-panel button:disabled {
  background: #b0b8c9;
  cursor: not-allowed;
  box-shadow: none;
}
.edit-panel button.delete-btn {
  background: #c43d3d;
  color: #fff;
}
.edit-panel button.delete-btn:hover {
  background: #a83232;
}
</style>
