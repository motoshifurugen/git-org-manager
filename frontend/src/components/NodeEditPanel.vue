<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { OrgNode } from '../store'

const props = defineProps<{
  node: OrgNode
  allNodes: OrgNode[]
}>()
const emit = defineEmits(['update', 'delete'])

const editName = ref(props.node.name)
const editParentId = ref(props.node.parentId)
const editLevel = ref(props.node.depth)

watch(() => props.node, (n) => {
  editName.value = n.name
  editParentId.value = n.parentId
  editLevel.value = n.depth
})

const parentCandidates = computed(() =>
  props.allNodes.filter(n => n.id !== props.node.id)
)

const nameError = computed(() => {
  if (!editName.value) return '名称は必須です'
  if (editName.value.length > 50) return '50文字以内で入力してください'
  return ''
})
const levelError = computed(() => {
  if (!Number.isInteger(editLevel.value) || editLevel.value < 1 || editLevel.value > 10) return '階層は1〜10の整数で入力してください'
  return ''
})

function onSubmit() {
  if (nameError.value || levelError.value) return
  emit('update', {
    id: props.node.id,
    name: editName.value,
    parentId: editParentId.value,
    depth: editLevel.value
  })
}
function onDelete() {
  emit('delete', props.node.id)
}
</script>

<template>
  <div class="edit-panel">
    <h3>ノード編集</h3>
    <form @submit.prevent="onSubmit">
      <label>名称
        <input v-model="editName" required maxlength="50" />
        <span v-if="nameError" class="error">{{ nameError }}</span>
      </label>
      <label>親ノード
        <select v-model="editParentId">
          <option :value="null">(ルート)</option>
          <option v-for="n in parentCandidates" :key="n.id" :value="n.id">{{ n.name }}</option>
        </select>
      </label>
      <label>階層
        <input type="number" v-model.number="editLevel" min="1" max="10" />
        <span v-if="levelError" class="error">{{ levelError }}</span>
      </label>
      <div class="btns">
        <button type="submit" :disabled="!!nameError || !!levelError">保存</button>
        <button type="button" @click="onDelete">削除</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.edit-panel {
  background: #f8fafc;
  border: 1px solid #e0e4ea;
  border-radius: 8px;
  padding: 1.5em 1em;
  margin-left: 2em;
  min-width: 300px;
  max-width: 350px;
  float: left;
}
label {
  display: block;
  margin-bottom: 1em;
  font-size: 0.95em;
}
input, select {
  width: 100%;
  margin-top: 0.2em;
  padding: 0.4em;
  border-radius: 4px;
  border: 1px solid #c0c6d1;
  font-size: 1em;
}
.btns {
  display: flex;
  gap: 1em;
}
button {
  padding: 0.5em 1.2em;
  border-radius: 6px;
  border: none;
  background: #347474;
  color: #fff;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}
button:disabled {
  background: #b0b8c9;
  cursor: not-allowed;
}
.error {
  color: #d00;
  font-size: 0.85em;
  margin-left: 0.5em;
}
</style>

<script lang="ts">
export default {}
</script> 