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

const hasDraft = computed(() => store.state.hasDraft)

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
    store.commit('setDraftNodes', treeData.nodes)
  } catch (e: any) {
    error.value = e.message || '不明なエラー'
  } finally {
    loading.value = false
  }
})

function onCommit() {
  store.dispatch('commitDraft')
}
</script>

<template>
  <div>
    <h1>組織構造ツリー</h1>
    <DraftStateBar :hasDraft="hasDraft" @commit="onCommit" />
    <div v-if="loading">読み込み中...</div>
    <div v-else-if="error">エラー: {{ error }}</div>
    <OrganizationTree v-else :nodes="treeNodes" :maxDepth="5" />
  </div>
</template>

<style scoped>
h1 {
  font-size: 1.5em;
  margin-bottom: 1em;
}
</style>
