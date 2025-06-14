<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import OrganizationTree from './OrganizationTree.vue'

const props = defineProps<{
  show: boolean
  loadingMerge: boolean
  draftNodes: any[]
  fetchedDraftNodes: any[]
}>()
const emit = defineEmits(['merge', 'cancel'])
</script>
<template>
  <div v-if="props.show">
    <div style="max-width:100vw; box-sizing:border-box; padding:0 2vw; margin:0 auto; width:100%; overflow-x:auto; position:relative;">
      <div v-if="props.loadingMerge" style="position:absolute; left:0; top:0; width:100%; height:100%; background:rgba(255,255,255,0.7); z-index:20; display:flex; align-items:center; justify-content:center;">
        <span class="spinner" style="width:3em; height:3em; border-width:6px;"></span>
      </div>
      <div style="display: flex; gap: 2em; width:100%; align-items: center;">
        <div style="flex: 1; min-width:0; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <h2 style="margin:0;">自分の最新コミット</h2>
        </div>
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-width:60px;">
          <div style="display:flex; gap:0.7em; align-items:center;">
            <button @click="emit('merge')" style="display:flex; align-items:center; justify-content:center; background: #222; color: #fff; border: none; border-radius: 6px; padding: 0.5em 1.2em; font-weight: 600; font-size: 1em;">
              <span style="font-size:1em; margin-right:0.5em;">←</span>merge
            </button>
            <button @click="emit('cancel')" style="display:flex; align-items:center; justify-content:center; background: #e0e4ea; color: #2d3a4a; border: none; border-radius: 6px; padding: 0.5em 1.2em; font-weight: 600; font-size: 1em;">中止</button>
          </div>
        </div>
        <div style="flex: 1; min-width:0; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <h2 style="margin:0;">fetchした共有コミット</h2>
        </div>
      </div>
      <div style="display: flex; gap: 2em; width:100%;">
        <div style="flex: 1; min-width:0;">
          <OrganizationTree :nodes="props.draftNodes" :maxDepth="5" />
        </div>
        <div style="flex: 1; min-width:0;">
          <OrganizationTree :nodes="props.fetchedDraftNodes" :maxDepth="5" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spinner {
  width: 1.3em;
  height: 1.3em;
  border: 3px solid #444c56;
  border-top: 3px solid #d1d5da;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>

<script lang="ts">
export default {}
</script> 