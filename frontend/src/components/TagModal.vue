<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

const props = defineProps<{
  show: boolean
  tagInput: string
  isTagSubmitting: boolean
}>()
const emit = defineEmits(['submit', 'close', 'update:tagInput'])

function onInputTag(e: Event) {
  const target = e.target as HTMLInputElement | null
  if (target) emit('update:tagInput', target.value)
}
</script>
<template>
  <div v-if="props.show" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <h2>タグ付与</h2>
      <div style="margin-bottom: 1.2em;">
        <label style="font-weight: bold;">タグ名</label>
        <input :value="props.tagInput" maxlength="50"
          style="width: 100%; margin-top: 0.5em; padding: 0.5em; border-radius: 6px; border: 1px solid #d0d6e1; font-size: 1em;"
          placeholder="タグ名を入力"
          :disabled="props.isTagSubmitting"
          @input="onInputTag"
        />
      </div>
      <div class="modal-btn-row">
        <button @click="emit('close')" :disabled="props.isTagSubmitting" class="modal-btn">閉じる</button>
        <button @click="emit('submit')" :disabled="props.isTagSubmitting" class="modal-btn primary">
          <span v-if="props.isTagSubmitting" class="spinner" style="margin-right:0.7em;"></span>
          保存
        </button>
      </div>
      <div v-if="props.isTagSubmitting" class="modal-committing-overlay">
        <span class="spinner"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-content {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.18);
  padding: 2em 2.5em 2em 2.5em;
  min-width: 340px;
  max-width: 90vw;
  position: relative;
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
</style>

<script lang="ts">
export default {}
</script> 