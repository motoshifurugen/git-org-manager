<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

const props = defineProps<{
  loginName: string
  loginPassword: string
  loginError: string
  isLoggingIn: boolean
}>()
const emit = defineEmits(['login', 'register', 'update:loginName', 'update:loginPassword'])

function onInputName(e: Event) {
  const target = e.target as HTMLInputElement | null
  if (target) emit('update:loginName', target.value)
}
function onInputPassword(e: Event) {
  const target = e.target as HTMLInputElement | null
  if (target) emit('update:loginPassword', target.value)
}
</script>
<template>
  <div class="login-container">
    <h2>ログイン</h2>
    <input :value="props.loginName" placeholder="ユーザー名" :disabled="props.isLoggingIn" @input="onInputName" />
    <input :value="props.loginPassword" type="password" placeholder="パスワード" :disabled="props.isLoggingIn" @input="onInputPassword" />
    <div style="margin: 0.7em 0; color: #c41d7f; min-height: 1.5em;">{{ props.loginError }}</div>
    <button @click="emit('login')" :disabled="props.isLoggingIn">ログイン</button>
    <button @click="emit('register')" :disabled="props.isLoggingIn">新規登録</button>
  </div>
</template>

<style scoped>
.login-container {
  max-width: 340px;
  min-width: 240px;
  width: 100%;
  margin: 80px auto 0 auto;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.13);
  padding: 2.5em 3em 2em 3em;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}
.login-container input {
  margin-bottom: 1em;
  padding: 0.7em;
  border-radius: 6px;
  border: 1px solid #d0d6e1;
  font-size: 1em;
}
.login-container button {
  background: #222;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.6em 1.5em;
  font-weight: 600;
  font-size: 1em;
  margin-bottom: 0.7em;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.login-container button:last-child {
  background: #e0e4ea;
  color: #2d3a4a;
}
.login-container button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

<script lang="ts">
export default {}
</script> 