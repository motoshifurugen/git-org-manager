<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { OrgNode } from '../store'

const props = defineProps<{
  node: OrgNode
  allNodes: OrgNode[]
  maxDepth: number
  isEdit: boolean
}>()
const emit = defineEmits(['update', 'delete'])

const editName = ref(props.node.name)
const editParentId = ref(props.node.parentId ? String(props.node.parentId) : '')
const editLevel = ref(1)

// 親ノードのdepthを取得し、階層を自動計算
const calcDepth = () => {
  if (!editParentId.value) return 1
  const parent = props.allNodes.find(n => n.id === editParentId.value)
  return parent ? parent.depth + 1 : 1
}

// props.nodeが変わったときは全初期化
watch(() => props.node, (n) => {
  editName.value = n.name
  editParentId.value = n.parentId ? String(n.parentId) : ''
  editLevel.value = calcDepth()
}, { immediate: true })

// 親ノード選択時は階層のみ再計算
watch(editParentId, () => {
  editLevel.value = calcDepth()
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
  if (!Number.isInteger(editLevel.value) || editLevel.value < 1 || editLevel.value > props.maxDepth) return `階層は1〜${props.maxDepth}の整数で入力してください`
  return ''
})

function onSubmit() {
  if (nameError.value || levelError.value) return
  emit('update', {
    id: props.node.id,
    name: editName.value,
    parentId: editParentId.value === '' ? null : editParentId.value,
    depth: editLevel.value
  })
}
function onDelete() {
  emit('delete', props.node.id)
}
</script>

<template>
  <div class="edit-panel">
    <h3>{{ props.isEdit ? 'ノード編集' : 'ノード追加' }}</h3>
    <form @submit.prevent="onSubmit">
      <label>名称
        <input v-model="editName" required maxlength="50" />
        <span v-if="nameError" class="error">{{ nameError }}</span>
      </label>
      <label>親ノード
        <select v-model="editParentId">
          <option :value="''">(ルート)</option>
          <option v-for="n in parentCandidates" :key="n.id" :value="String(n.id)">{{ n.name }}</option>
        </select>
      </label>
      <label>階層
        <div class="parent-name">第{{ editLevel }}階層</div>
      </label>
      <div class="btns">
        <button type="submit" :disabled="!!nameError || !!levelError">保存</button>
        <button v-if="isEdit" type="button" @click="onDelete">削除</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.edit-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  background: none;
  border: none;
  border-radius: 0;
  box-shadow: none;
  margin: 0;
}
.edit-panel h3 {
  color: #222;
  font-size: 1.25em;
  font-weight: 700;
  margin-bottom: 1.5em;
  letter-spacing: 0.02em;
  text-align: center;
}
label {
  display: block;
  margin-bottom: 1.1em;
  font-size: 0.97em;
  color: #444;
  font-weight: 500;
}
input, select {
  width: 100%;
  margin-top: 0.3em;
  padding: 0.55em 0.9em;
  border-radius: 6px;
  border: 1.2px solid #d0d6e1;
  font-size: 1em;
  background: #f8fafc;
  color: #222;
  transition: border 0.2s;
  box-sizing: border-box;
}
input:focus, select:focus {
  outline: none;
  border-color: #347474;
  background: #fff;
}
.btns {
  display: flex;
  gap: 1em;
  justify-content: center;
  margin-top: 1.5em;
}
button {
  padding: 0.6em 2.2em;
  border-radius: 8px;
  border: none;
  background: #347474;
  color: #fff;
  font-weight: bold;
  font-size: 1em;
  cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s;
  box-shadow: 0 2px 8px rgba(52,116,116,0.07);
}
button:disabled {
  background: #b0b8c9;
  cursor: not-allowed;
  box-shadow: none;
}
.error {
  color: #d00;
  font-size: 0.92em;
  margin-left: 0.5em;
}
.parent-name {
  padding: 0.5em 0.7em;
  background: #f4f4f4;
  border-radius: 6px;
  color: #555;
  margin-top: 0.2em;
  margin-bottom: 0.5em;
  font-size: 1em;
  text-align: center;
}
</style>

<script lang="ts">
export default {}
</script> 