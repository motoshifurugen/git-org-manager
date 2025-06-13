<script setup lang="ts">
const props = defineProps<{ hasDraft: boolean }>()
const emit = defineEmits(['commit'])
</script>

<template>
  <div v-if="hasDraft" class="draft-bar">
    <span class="dot">●</span> 未コミットの変更があります
    <button @click="$emit('commit')">コミット</button>
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
.dot {
  color: #faad14;
  font-size: 1.2em;
  margin-right: 0.5em;
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
</style>

<script lang="ts">
export default {}
</script> 