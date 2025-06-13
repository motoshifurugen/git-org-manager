<script setup lang="ts">
import { defineProps, defineEmits, ref, computed } from 'vue'

const props = defineProps<{
  show: boolean,
  commitList: { id: string, message: string, author: string, created_at: string, tree_id: string, tag_name?: string | null }[]
}>()
const emit = defineEmits(['apply', 'close'])

// タグあり/なしでグループ化（連続したタグなしをまとめる）
const groupedCommits = computed(() => {
  const groups = []
  let buffer = []
  for (const c of props.commitList) {
    if (c.tag_name) {
      if (buffer.length > 0) {
        groups.push({ type: 'untagged', commits: [...buffer] })
        buffer = []
      }
      groups.push({ type: 'tagged', commit: c })
    } else {
      buffer.push(c)
    }
  }
  if (buffer.length > 0) {
    groups.push({ type: 'untagged', commits: [...buffer] })
  }
  return groups
})
const showUntagged = ref<{ [key: number]: boolean }>({})
</script>

<template>
  <div v-if="props.show" class="modal-overlay" @click.self="() => emit('close')">
    <div class="modal-content" style="min-width: 480px; max-width: 90vw;">
      <h2 style="margin-bottom:1em;">コミット履歴</h2>
      <div class="modal-scroll-area">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:#f6f7fa;">
              <th style="padding:0.5em 0.7em; text-align:center;">日時</th>
              <th style="padding:0.5em 0.7em; text-align:center;">メッセージ</th>
              <th style="padding:0.5em 0.7em; text-align:center;">タグ</th>
              <th style="padding:0.5em 0.7em; text-align:center;">作成者</th>
              <th style="padding:0.5em 0.7em;"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(group, idx) in groupedCommits">
              <template v-if="group.type === 'tagged' && group.commit">
                <tr :key="'tagged-' + group.commit.id">
                  <td style="padding:0.5em 0.7em; font-family:monospace; text-align:center;">{{ group.commit.created_at }}</td>
                  <td style="padding:0.5em 0.7em; text-align:center;">{{ group.commit.message || '(メッセージなし)' }}</td>
                  <td style="padding:0.5em 0.7em; color:#347474; font-family:monospace; text-align:center;">{{ group.commit.tag_name || '' }}</td>
                  <td style="padding:0.5em 0.7em; text-align:center;">{{ group.commit.author }}</td>
                  <td style="padding:0.5em 0.7em; text-align:right;">
                    <button class="history-apply-btn" @click="$emit('apply', group.commit.id)">適用</button>
                  </td>
                </tr>
              </template>
              <template v-else-if="group.type === 'untagged' && group.commits">
                <tr :key="'untagged-header-' + idx">
                  <td :colspan="5" style="text-align:center; background:#f6f7fa; cursor:pointer; color:#347474; font-weight:bold;" @click="showUntagged[idx] = !showUntagged[idx]">
                    <span v-if="!showUntagged[idx]">▼ タグのない{{ group.commits.length }}件のコミットを表示</span>
                    <span v-else>▲ タグのない{{ group.commits.length }}件のコミットを非表示</span>
                  </td>
                </tr>
                <tr v-for="c in group.commits || []" v-show="showUntagged[idx]" :key="'untagged-' + c.id" style="border-bottom:1px solid #e0e4ea;">
                  <td style="padding:0.5em 0.7em; font-family:monospace; text-align:center;">{{ c.created_at }}</td>
                  <td style="padding:0.5em 0.7em; text-align:center;">{{ c.message || '(メッセージなし)' }}</td>
                  <td style="padding:0.5em 0.7em; color:#347474; font-family:monospace; text-align:center;">{{ c.tag_name || '' }}</td>
                  <td style="padding:0.5em 0.7em; text-align:center;">{{ c.author }}</td>
                  <td style="padding:0.5em 0.7em; text-align:right;">
                    <button class="history-apply-btn" @click="$emit('apply', c.id)">適用</button>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
      <button class="history-close-btn" @click="$emit('close')" style="margin-top:1.5em;">閉じる</button>
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
.history-apply-btn {
  background: #347474;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 0.4em 1.2em;
  font-weight: bold;
  cursor: pointer;
}
.history-apply-btn:hover, .history-apply-btn:focus {
  background: #255a5a;
  color: #fff;
}
.history-close-btn {
  background: #e0e4ea;
  color: #2d3a4a;
  border: none;
  border-radius: 6px;
  padding: 0.5em 1.5em;
  font-weight: 600;
  font-size: 1em;
  margin: 0.5em 0.5em 0.5em 0;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}
.history-close-btn:hover {
  background: #cfd4de;
  color: #2d3a4a;
}
.modal-scroll-area {
  min-height: 200px;
  max-height: 60vh;
  overflow-y: auto;
}
</style> 

<script lang="ts">
export default {}
</script> 