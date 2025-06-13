<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useStore } from 'vuex'
import OrganizationTree from './components/OrganizationTree.vue'
import DraftStateBar from './components/DraftStateBar.vue'

const store = useStore()
const treeId = ref('')
const treeNodes = ref([])
const loading = ref(true)
const error = ref('')
const showDiff = ref(false)
const diffResult = ref<{ added: any[]; updated: any[]; deleted: any[] }>({ added: [], updated: [], deleted: [] })

const hasDraft = computed(() => {
  const diff = calcDiff(treeNodes.value, store.state.draftNodes)
  if (diff.added.length > 0 || diff.updated.length > 0 || diff.deleted.length > 0) {
    console.log('未コミットの差分:', diff)
  }
  return diff.added.length > 0 || diff.updated.length > 0 || diff.deleted.length > 0
})

onMounted(async () => {
  loading.value = true
  try {
    // 最新コミット取得
    const commitRes = await fetch('http://localhost:3001/api/commits/latest')
    if (!commitRes.ok) throw new Error('最新コミット取得失敗')
    const commit = await commitRes.json()
    treeId.value = commit.tree_id
    const treeRes = await fetch(`http://localhost:3001/api/trees/${treeId.value}`)
    if (!treeRes.ok) throw new Error('ツリー構造取得失敗')
    const treeData = await treeRes.json()
    treeNodes.value = treeData.nodes
    // 初期ノードをdraftにセット
    store.commit('setDraftNodes', flatten(treeData.nodes))
  } catch (e: any) {
    error.value = e.message || '不明なエラー'
  } finally {
    loading.value = false
  }
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

function onCommitFromDiff() {
  const message = window.prompt('コミットメッセージを入力してください', '') || ''
  store.dispatch('commitDraft', { treeId: treeId.value, author: 'admin_user', message })
    .then((data: any) => {
      alert('コミット完了: ' + data.commit_id)
      showDiff.value = false
    })
    .catch((e: any) => {
      alert('コミット失敗: ' + (e.message || e))
    })
}
</script>

<template>
  <div>
    <h1>組織構造ツリー</h1>
    <div style="display: flex; align-items: center; gap: 1em;">
      <DraftStateBar :hasDraft="hasDraft" />
      <button v-if="hasDraft" @click="onDiff">diff</button>
    </div>
    <div v-if="loading">読み込み中...</div>
    <div v-else-if="error">エラー: {{ error }}</div>
    <OrganizationTree v-else :nodes="treeNodes" :maxDepth="5" />
    <div v-if="showDiff" class="modal-overlay" @click.self="showDiff = false">
      <div class="modal-content">
        <h2>差分（draft vs 最新コミット）</h2>
        <div v-if="diffResult.added.length">
          <h3>追加</h3>
          <ul>
            <li v-for="n in diffResult.added" :key="'a'+n.id">{{ n.name }}（階層:{{ n.depth }}）</li>
          </ul>
        </div>
        <div v-if="diffResult.updated.length">
          <h3>変更</h3>
          <ul>
            <li v-for="n in diffResult.updated" :key="'u'+n.id">{{ n.name }}（階層:{{ n.depth }}）</li>
          </ul>
        </div>
        <div v-if="diffResult.deleted.length">
          <h3>削除</h3>
          <ul>
            <li v-for="n in diffResult.deleted" :key="'d'+n.id">{{ n.name }}（階層:{{ n.depth }}）</li>
          </ul>
        </div>
        <button @click="onCommitFromDiff">コミット</button>
        <button @click="showDiff = false">閉じる</button>
      </div>
    </div>
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
</style>
