<script setup lang="ts">
const props = defineProps<{ hasDraft: boolean; tagName?: string; commitId: string; canEditTag?: boolean }>()
const emit = defineEmits(['commit', 'diff', 'edit-tag', 'clear'])
</script>

<template>
  <div class="draft-bar" :class="{ 'no-draft': !props.hasDraft }">
    <template v-if="props.hasDraft">
      <span class="dot">●</span>
      未コミットの変更があります
      <div class="draft-btn-row">
        <button class="clear-btn" @click="$emit('clear')">クリア</button>
        <button class="diff-btn" @click="$emit('diff')">差分</button>
      </div>
    </template>
    <template v-else>
      <button class="tag-display-btn" @click="$emit('edit-tag')" title="タグを付与・編集" :disabled="props.canEditTag === false">
        <span class="tag-icon" style="font-size:1.2em;">
          {{ (props.tagName && props.tagName.length > 0) ? '🏷️' : '📝' }}
        </span>
        <span
          class="tag-label"
          :style="{
            fontFamily: 'monospace',
            fontSize: '1em',
            color: props.canEditTag === false ? '#bbb' : '#2d3a4a'
          }"
        >
          {{ (props.tagName && props.tagName.length > 0) ? props.tagName : props.commitId }}
        </span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.draft-bar {
  background: #fffbe6;
  border: 1px solid #ffe58f;
  color: #ad6800;
  padding: 0.7em 1.2em;
  border-radius: 6px;
  margin: 1em 0;
  display: flex;
  align-items: center;
  gap: 1em;
}
.draft-bar.no-draft {
  background: #f6f7fa;
  border: 1px solid #e0e4ea;
  color: #888;
}
.dot {
  color: #faad14;
  font-size: 1.2em;
  margin-right: 0.5em;
}
.tag-icon {
  color: #347474;
  margin-right: 0.3em;
}
.tag-label {
  color: #2d3a4a;
}
button {
  background: #347474;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 0.4em 1.2em;
  font-weight: bold;
  cursor: pointer;
}
.tag-display-btn {
  display: flex;
  align-items: center;
  gap: 0.3em;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.2em 0.7em;
  border-radius: 6px;
  transition: background 0.18s;
}
.tag-display-btn:hover, .tag-display-btn:focus {
  background: #e6f7ff;
  outline: none;
}
.draft-btn-row {
  display: flex;
  gap: 1em;
  margin-left: 1.5em;
}
.clear-btn,
.diff-btn {
  min-width: 90px;
}
.clear-btn {
  background: #e0e4ea;
  color: #2d3a4a;
  border: none;
  border-radius: 5px;
  padding: 0.4em 1.2em;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.clear-btn:hover {
  background: #cfd4de;
  color: #2d3a4a;
}
.diff-btn {
  background: #347474;
  color: #fff;
  border: none;
  border-radius: 5px;
  padding: 0.4em 1.2em;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}
.diff-btn:hover {
  background: #255a5a;
}
</style>

<script lang="ts">
export default {}
</script> 