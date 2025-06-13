<script setup lang="ts">
import { defineProps, defineEmits, ref, computed } from 'vue'

const props = defineProps<{
  show: boolean,
  commitList: { id: string, message: string, author: string, created_at: string, tree_id: string, tag_name?: string | null }[]
}>()
const emit = defineEmits(['apply', 'close'])

// タグ付き・タグなしで分割
const taggedCommits = computed(() => props.commitList.filter(c => c.tag_name))
const untaggedCommits = computed(() => props.commitList.filter(c => !c.tag_name))
const showUntagged = ref(false)
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
            <!-- タグ付きコミットは常に表示 -->
            <tr v-for="c in taggedCommits" :key="c.id" style="border-bottom:1px solid #e0e4ea;">
              <td style="padding:0.5em 0.7em; font-family:monospace; text-align:center;">{{ c.created_at }}</td>
              <td style="padding:0.5em 0.7em; text-align:center;">{{ c.message || '(メッセージなし)' }}</td>
              <td style="padding:0.5em 0.7em; color:#347474; font-family:monospace; text-align:center;">{{ c.tag_name || '' }}</td>
              <td style="padding:0.5em 0.7em; text-align:center;">{{ c.author }}</td>
              <td style="padding:0.5em 0.7em; text-align:right;">
                <button class="history-apply-btn" @click="$emit('apply', c.id)">適用</button>
              </td>
            </tr>
            <!-- タグなしコミットは折りたたみ -->
            <tr v-if="untaggedCommits.length > 0">
              <td :colspan="5" style="text-align:center; background:#f6f7fa; cursor:pointer; color:#347474; font-weight:bold;" @click="showUntagged = !showUntagged">
                <span v-if="!showUntagged">▼ タグのない{{ untaggedCommits.length }}件のコミットを表示</span>
                <span v-else>▲ タグのない{{ untaggedCommits.length }}件のコミットを非表示</span>
              </td>
            </tr>
            <tr v-for="c in untaggedCommits" v-show="showUntagged" :key="c.id" style="border-bottom:1px solid #e0e4ea;">
              <td style="padding:0.5em 0.7em; font-family:monospace; text-align:center;">{{ c.created_at }}</td>
              <td style="padding:0.5em 0.7em; text-align:center;">{{ c.message || '(メッセージなし)' }}</td>
              <td style="padding:0.5em 0.7em; color:#347474; font-family:monospace; text-align:center;">{{ c.tag_name || '' }}</td>
              <td style="padding:0.5em 0.7em; text-align:center;">{{ c.author }}</td>
              <td style="padding:0.5em 0.7em; text-align:right;">
                <button class="history-apply-btn" @click="$emit('apply', c.id)">適用</button>
              </td>
            </tr>
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