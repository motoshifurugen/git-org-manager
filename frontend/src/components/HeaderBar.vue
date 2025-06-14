<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
const props = defineProps<{ user: string, userId: string }>()
const emit = defineEmits(['logout'])
</script>
<template>
  <header class="app-header">
    <div class="header-title">git-org-manager</div>
    <div class="header-user" v-if="props.userId">
      <span class="header-username">👤 {{ props.user }}</span>
      <button @click="emit('logout')" class="header-logout">ログアウト</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 56px;
  background: #2d333b;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 1200;
  padding: 0 24px;
  box-sizing: border-box;
  min-width: 0;
  box-shadow: 0 2px 8px rgba(60,60,60,0.07);
}
.header-title {
  font-size: 1.35em;
  font-weight: bold;
  letter-spacing: 0.04em;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-user {
  display: flex;
  align-items: center;
  gap: 1.2em;
  min-width: 0;
  max-width: 60vw;
  overflow: hidden;
}
.header-username {
  font-weight: bold;
  color: #fff;
  margin-right: 0.5em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.header-logout {
  background: #e0e4ea;
  color: #24292f;
  border-radius: 6px;
  border: none;
  padding: 0.3em 1.2em;
  cursor: pointer;
  font-weight: 600;
  font-size: 1em;
  transition: background 0.2s, color 0.2s;
}
.header-logout:hover {
  background: #cfd4de;
  color: #24292f;
}
</style>

<script lang="ts">
export default {}
</script> 