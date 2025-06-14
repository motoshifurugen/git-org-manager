<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

const props = defineProps<{
  show: boolean
  diffResult: { added: any[]; updated: any[]; deleted: any[] }
  baseFlat: any[]
  commitMessage: string
  isCommitting: boolean
}>()
const emit = defineEmits(['commit', 'close', 'update:commitMessage'])

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
  const baseFlat = props.baseFlat
  return baseFlat.find((n: any) => n.id === newNode.id) || {}
}
function onInputCommitMessage(e: Event) {
  const target = e.target as HTMLInputElement | null
  if (target) emit('update:commitMessage', target.value)
}
</script>
<template>
  <div v-if="props.show" class="modal-overlay" @click.self="props.isCommitting ? null : emit('close')">
    <div class="modal-content" style="position:relative;">
      <h2>差分</h2>
      <div class="modal-scroll-area">
        <div v-if="props.diffResult.added.length">
          <h3>追加</h3>
          <ul>
            <li v-for="n in props.diffResult.added" :key="'a'+n.id" class="diff-added">
              <span class="diff-sign">＋</span>{{ getNodePath(n, props.baseFlat) }}
            </li>
          </ul>
        </div>
        <div v-if="props.diffResult.deleted.length">
          <h3>削除</h3>
          <ul>
            <li v-for="n in props.diffResult.deleted" :key="'d'+n.id" class="diff-deleted">
              <span class="diff-sign">ー</span>{{ getNodePath(n, props.baseFlat) }}
            </li>
          </ul>
        </div>
        <div v-if="props.diffResult.updated.length">
          <h3>変更</h3>
          <ul>
            <li v-for="n in props.diffResult.updated" :key="'u'+n.id">
              <div class="diff-deleted">
                <span class="diff-sign">ー</span>{{ getNodePath(getOldNode(n), props.baseFlat) }}
              </div>
              <div class="diff-added">
                <span class="diff-sign">＋</span>{{ getNodePath(n, props.baseFlat) }}
              </div>
            </li>
          </ul>
        </div>
      </div>
      <div style="margin-bottom: 1.2em;">
        <label style="font-weight: bold;">コミットメッセージ</label>
        <input :value="props.commitMessage" maxlength="100"
          style="width: 100%; margin-top: 0.5em; padding: 0.5em; border-radius: 6px; border: 1px solid #d0d6e1; font-size: 1em;"
          placeholder="コミット内容を入力"
          :disabled="props.isCommitting"
          @input="onInputCommitMessage"
        />
      </div>
      <div class="modal-btn-row">
        <button class="modal-btn" @click="emit('close')" :disabled="props.isCommitting">閉じる</button>
        <button class="modal-btn primary" @click="emit('commit')" :disabled="props.isCommitting">
          <span v-if="props.isCommitting" class="spinner" style="margin-right:0.7em;"></span>
          コミット
        </button>
      </div>
      <div v-if="props.isCommitting" class="modal-committing-overlay">
        <span class="spinner"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  min-width: 340px;
  max-width: 90vw;
  position: relative;
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