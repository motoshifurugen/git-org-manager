<script setup lang="ts">
import { ref, onMounted } from 'vue'
import OrganizationTree from './components/OrganizationTree.vue'

const treeNodes = ref([])
const tagName = ref('')
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  loading.value = true
  try {
    // 最新コミット取得
    const commitRes = await fetch('http://localhost:3001/api/commits/latest')
    if (!commitRes.ok) throw new Error('最新コミット取得失敗')
    const commit = await commitRes.json()
    const treeId = commit.tree_id
    const commitId = commit.id

    // ツリー構造取得
    const treeRes = await fetch(`http://localhost:3001/api/trees/${treeId}`)
    if (!treeRes.ok) throw new Error('ツリー構造取得失敗')
    const treeData = await treeRes.json()
    treeNodes.value = treeData.nodes

    // タグ名取得
    const tagRes = await fetch(`http://localhost:3001/api/tags/${commitId}`)
    if (tagRes.ok) {
      const tagData = await tagRes.json()
      tagName.value = tagData?.name || ''
    } else {
      tagName.value = ''
    }
  } catch (e: any) {
    error.value = e.message || '不明なエラー'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <h1>組織構造ツリー</h1>
    <div v-if="loading">読み込み中...</div>
    <div v-else-if="error">エラー: {{ error }}</div>
    <div v-else>
      <div v-if="tagName">タグ: <b>{{ tagName }}</b></div>
      <OrganizationTree :nodes="treeNodes" :maxDepth="5" />
    </div>
  </div>
</template>

<style scoped>
h1 {
  font-size: 1.5em;
  margin-bottom: 1em;
}
</style>
