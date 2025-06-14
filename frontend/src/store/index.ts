import { createStore } from 'vuex'

export interface OrgNode {
  id: string
  name: string
  depth: number
  parentId: string | null
  children?: OrgNode[]
}

export interface State {
  count: number
  draftNodes: OrgNode[]
  selectedNodeId: string | null
  hasDraft: boolean
}

const state: State = {
  count: 0,
  draftNodes: [],
  selectedNodeId: null,
  hasDraft: false
}

export default createStore({
  state,
  mutations: {
    increment(state: State) {
      state.count++
    },
    setDraftNodes(state: State, nodes: OrgNode[]) {
      state.draftNodes = nodes
    },
    selectNode(state: State, nodeId: string) {
      state.selectedNodeId = nodeId
    },
    clearDraft(state: State) {
      state.draftNodes = []
      state.hasDraft = false
    }
  },
  actions: {
    addNode({ commit, state }: any, { parentId, name, depth }: { parentId: string | null, name: string, depth: number }) {
      // 仮ID生成
      const id = 'draft-' + Math.random().toString(36).slice(2, 10)
      const newNode: OrgNode = { id, name, depth, parentId }
      const nodes = [...state.draftNodes, newNode]
      commit('setDraftNodes', nodes)
      commit('selectNode', id)
    },
    updateNode({ commit, state }: any, { id, name, parentId, depth }: { id: string, name: string, parentId: string | null, depth: number }) {
      const nodes = state.draftNodes.map((n: any) => n.id === id ? { ...n, name, parentId, depth } : n)
      commit('setDraftNodes', nodes)
    },
    deleteNode({ commit, state }: any, nodeId: string) {
      // 子ノードも再帰的に削除
      function removeRecursive(nodes: OrgNode[], id: string): OrgNode[] {
        return nodes.filter((n: any) => n.id !== id).map((n: any) => ({ ...n, children: n.children ? removeRecursive(n.children, id) : [] }))
      }
      const nodes = removeRecursive(state.draftNodes, nodeId)
      commit('setDraftNodes', nodes)
      if (state.selectedNodeId === nodeId) commit('selectNode', null)
    },
    commitDraft({ commit, state }: any, { treeId, author, message, parent_commit_id }: { treeId: string, author: string, message?: string, parent_commit_id?: string }) {
      // API保存処理
      return fetch('http://localhost:3001/api/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree_id: treeId, author, message, nodes: state.draftNodes, parent_commit_id })
      })
        .then(res => {
          if (!res.ok) throw new Error('コミットAPI失敗')
          return res.json()
        })
        .then(data => {
          commit('clearDraft')
          return data
        })
    }
  },
  modules: {}
})
