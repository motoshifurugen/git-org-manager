<script setup lang="ts">
import { ref, onMounted } from 'vue'
import OrganizationTree from './components/OrganizationTree.vue'

const treeId = '84c50d54-8113-42a6-b40c-3e02f9f7e53c' // 仮のID
const treeNodes = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  loading.value = true
  try {
    const res = await fetch(`http://localhost:3001/api/trees/${treeId}`)
    if (!res.ok) throw new Error('API取得失敗')
    const data = await res.json()
    treeNodes.value = data.nodes
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
    <OrganizationTree v-else :nodes="treeNodes" :maxDepth="5" />
  </div>
</template>

<style scoped>
h1 {
  font-size: 1.5em;
  margin-bottom: 1em;
}
</style>
