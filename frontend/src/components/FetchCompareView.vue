<script setup lang="ts">
import { defineProps, defineEmits, ref, computed, onMounted, onBeforeUnmount } from 'vue'
import OrganizationTree from './OrganizationTree.vue'

const props = defineProps<{
  show: boolean
  loadingMerge: boolean
  draftNodes: any[]
  fetchedDraftNodes: any[]
  baseNodes: any[]
  hasConflict: boolean
}>()
const emit = defineEmits(['merge', 'diff', 'cancel'])

const showDiffModal = ref(false)
const mergedDraft = ref<any[]>([])
const hasConflict = ref(false)
const showTooltip = ref(false)
const btnRef = ref<HTMLElement | null>(null)
const tooltipStyle = computed(() => {
  if (!btnRef.value) return {}
  const rect = btnRef.value.getBoundingClientRect()
  return {
    position: 'fixed',
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.top - 40}px`, // ボタンの上40px
    transform: 'translateX(-50%)',
    zIndex: 99999,
    background: '#222',
    color: '#fff',
    padding: '0.7em 1.5em',
    borderRadius: '8px',
    fontSize: '1.05em',
    whiteSpace: 'nowrap',
    boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
    fontWeight: 'bold',
    letterSpacing: '0.03em',
    pointerEvents: 'none',
    opacity: '0.97',
  } as any
})

function unflatten(nodes: any[]): any[] {
  const nodeMap: Record<string, any> = {}
  nodes.forEach(n => {
    nodeMap[String(n.id)] = { ...n, children: [] }
  })
  nodes.forEach(n => {
    const parentKey = n.parentId == null ? null : String(n.parentId)
    if (parentKey && nodeMap[parentKey]) {
      nodeMap[parentKey].children.push(nodeMap[String(n.id)])
    }
  })
  const roots = nodes.filter(n => n.parentId === null || n.parentId === '' || n.parentId === undefined || !nodeMap[String(n.parentId)]).map(n => nodeMap[String(n.id)])
  roots.sort((a: any, b: any) => {
    const nameCmp = a.name.localeCompare(b.name, 'ja')
    if (nameCmp !== 0) return nameCmp
    return a.id.localeCompare(b.id)
  })
  return roots
}

function onDiff() {
  emit('diff')
}
function onCloseDiffModal() {
  showDiffModal.value = false
}
function onResolveMerge(nodes: any[], conflictCount?: number) {
  // 解決後、ドラフトを更新する処理をここに
  mergedDraft.value = nodes
  showDiffModal.value = false
  // 競合が残っていればhasConflictをtrue、なければfalse
  hasConflict.value = !!conflictCount
}
function onOpenDiffModal(conflictCount?: number) {
  showDiffModal.value = true
  hasConflict.value = !!conflictCount
}
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
          <div style="display:flex; gap:0.7em; align-items:center; position:relative; overflow:visible;">
            <button @click="emit('cancel')" style="display:flex; align-items:center; justify-content:center; background: #e0e4ea; color: #2d3a4a; border: none; border-radius: 6px; padding: 0.5em 1.2em; font-weight: 600; font-size: 1em;">中止</button>
            <div class="merge-btn-wrapper" style="position:relative; display:block;"
                 @mouseenter="showTooltip = props.hasConflict"
                 @mouseleave="showTooltip = false">
              <button ref="btnRef" class="modal-btn primary" @click="emit('merge')" :disabled="props.hasConflict"
                style="display:flex; align-items:center; justify-content:center; background: #222; color: #fff; border: none; border-radius: 6px; padding: 0.5em 1.2em; font-weight: 600; font-size: 1em;">
                <span style="font-size:1em; margin-right:0.5em;">←</span>merge
              </button>
              <teleport to="body">
                <div v-if="props.hasConflict && showTooltip" :style="tooltipStyle">競合があるためマージできません</div>
              </teleport>
            </div>
            <button @click="onDiff" style="display:flex; align-items:center; justify-content:center; background: #347474; color: #fff; border: none; border-radius: 6px; padding: 0.5em 1.2em; font-weight: 600; font-size: 1em;">差分</button>
          </div>
        </div>
        <div style="flex: 1; min-width:0; text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <h2 style="margin:0;">fetchした共有コミット</h2>
        </div>
      </div>
      <div style="display: flex; gap: 2em; width:100%;">
        <div style="flex: 1; min-width:0;">
          <OrganizationTree :nodes="unflatten(props.draftNodes)" :maxDepth="5" />
        </div>
        <div style="flex: 1; min-width:0;">
          <OrganizationTree :nodes="unflatten(props.fetchedDraftNodes)" :maxDepth="5" />
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
button:disabled {
  pointer-events: none;
  opacity: 0.5;
  background: #b0b8c9;
  color: #fff;
  cursor: not-allowed;
}
.merge-btn-wrapper {
  position: relative;
  display: block;
}
.merge-tooltip {
  z-index: 99999;
}
</style>

<script lang="ts">
export default {}
</script> 