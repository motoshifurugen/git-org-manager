<script setup lang="ts">
import { defineProps, defineEmits, computed } from 'vue'

const props = defineProps<{
  show: boolean,
  onClose: () => void,
  currentCommit: { id: string, created_at: string },
  sharedCommits: { commit_id: string, shared_at: string, created_at: string, author: string, message: string, tag_name?: string|null }[],
  loading: boolean,
  onPush: () => void,
  onFetch: () => void
}>()
const emit = defineEmits(['close', 'push', 'fetch'])

// 現在のコミットより新しい共有コミットがあるか、または同じ日時の場合もpush不可
const hasNewerShared = computed(() => {
  if (!props.currentCommit?.created_at || !props.sharedCommits.length) return false
  // 最新のshared_at（string）を取得
  const maxSharedAt = props.sharedCommits.reduce((max: string, s) => {
    return (!max || s.shared_at > max) ? s.shared_at : max
  }, '')
  if (!maxSharedAt) return false
  // created_atがmaxSharedAtと同じかそれ以前ならpush不可
  return new Date(props.currentCommit.created_at).getTime() <= new Date(maxSharedAt).getTime()
})

// 日付が完全一致する場合
const hasSameDate = computed(() => {
  if (!props.currentCommit?.created_at || !props.sharedCommits.length) return false
  const maxSharedAt = props.sharedCommits.reduce((max: string, s) => {
    return (!max || s.shared_at > max) ? s.shared_at : max
  }, '')
  if (!maxSharedAt) return false
  return new Date(props.currentCommit.created_at).getTime() === new Date(maxSharedAt).getTime()
})
</script>

<template>
  <div v-if="props.show" class="modal-overlay" @click.self="props.onClose">
    <div class="modal-content" style="min-width:340px;max-width:90vw;">
      <h2 style="margin-bottom:1em;">コミット共有</h2>
      <div v-if="props.loading" style="text-align:center;">読み込み中...</div>
      <template v-else>
        <div v-if="hasNewerShared">
          <div style="margin-bottom:1.2em; color:#c41d7f; font-weight:bold;">
            <template v-if="hasSameDate">
              最新に同期済みです。
            </template>
            <template v-else>
              現在のコミットより新しい共有コミットが存在します。<br>
              最新の共有コミットをfetchして適用できます。
            </template>
          </div>
          <button v-if="!hasSameDate" @click="props.onFetch" style="background:#347474;color:#fff;">fetch（取得）</button>
        </div>
        <div v-else>
          <div style="margin-bottom:1.2em; color:#347474; font-weight:bold;">
            このコミットを共有（push）できます。
          </div>
          <button @click="props.onPush" style="background:#347474;color:#fff;">push（共有）</button>
        </div>
      </template>
      <button @click="props.onClose" style="margin-top:1.5em;background:#e0e4ea;color:#2d3a4a;">閉じる</button>
    </div>
  </div>
</template>

<style scoped>
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
button {
  background: #347474;
  color: #fff;
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
button:hover {
  background: #255a5a;
  color: #fff;
}
button:last-child {
  background: #e0e4ea;
  color: #2d3a4a;
}
button:last-child:hover {
  background: #cfd4de;
  color: #2d3a4a;
}
</style>

<script lang="ts">
export default {}
</script> 