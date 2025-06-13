<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'

const props = defineProps<{
  message: string
  type?: 'success' | 'error'
  duration?: number
}>()
const emit = defineEmits(['close'])
const visible = ref(true)

onMounted(() => {
  setTimeout(() => {
    visible.value = false
    emit('close')
  }, props.duration ?? 3000)
})

watch(() => props.message, () => {
  visible.value = true
  setTimeout(() => {
    visible.value = false
    emit('close')
  }, props.duration ?? 3000)
})
</script>

<template>
  <transition name="toast-fade">
    <div v-if="visible" class="toast-message" :class="type">
      {{ message }}
    </div>
  </transition>
</template>

<style scoped>
.toast-message {
  position: fixed;
  top: 1.5em;
  right: 1.5em;
  z-index: 2000;
  min-width: 180px;
  max-width: 320px;
  background: #fff;
  color: #222;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.13);
  padding: 1em 1.5em;
  font-size: 1.05em;
  font-weight: 600;
  border-left: 6px solid #347474;
  margin-bottom: 0.7em;
  opacity: 0.97;
  pointer-events: none;
}
.toast-message.success {
  border-left-color: #52c41a;
  color: #237804;
}
.toast-message.error {
  border-left-color: #ff4d4f;
  color: #c41d7f;
}
.toast-fade-enter-active, .toast-fade-leave-active {
  transition: opacity 0.4s;
}
.toast-fade-enter-from, .toast-fade-leave-to {
  opacity: 0;
}
</style>

<script lang="ts">
export default {}
</script> 