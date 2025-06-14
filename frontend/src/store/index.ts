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
}

const state: State = {
  count: 0,
  draftNodes: [],
  selectedNodeId: null,
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
      // 子ノードも再帰的に削除（フラット配列版）
      function collectDescendants(nodes: OrgNode[], id: string): Set<string> {
        const ids = new Set<string>([id])
        let changed = true
        while (changed) {
          changed = false
          for (const n of nodes) {
            if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
              ids.add(n.id)
              changed = true
            }
          }
        }
        return ids
      }
      const idsToRemove = collectDescendants(state.draftNodes, nodeId)
      const nodes = state.draftNodes.filter((n: any) => !idsToRemove.has(n.id))
      commit('setDraftNodes', nodes)
      if (state.selectedNodeId === nodeId) commit('selectNode', null)
    },
    commitDraft({ commit, state }: any, { treeId, author, message, parent_commit_id, created_at }: { treeId: string, author: string, message?: string, parent_commit_id?: string, created_at?: string }) {
      // API保存処理
      const token = localStorage.getItem('token') || ''
      return fetch('http://localhost:3001/api/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ tree_id: treeId, message, nodes: state.draftNodes, parent_commit_id, created_at })
      })
        .then(res => {
          if (!res.ok) throw new Error('コミットAPI失敗')
          return res.json()
        })
        .then(data => {
          commit('clearDraft')
          return data
        })
    },
    fetchMyCommits({ commit }: any) {
      const userId = localStorage.getItem('userId') || ''
      return fetch(`http://localhost:3001/api/commits?author=${encodeURIComponent(userId)}`)
        .then(res => {
          if (!res.ok) throw new Error('コミット一覧取得失敗')
          return res.json()
        })
        .then(async (myCommits) => {
          // 親コミットID一覧を抽出
          const parentIds = Array.from(new Set(myCommits.map((c: any) => c.parent_commit_id).filter((id: string | null) => !!id)))
          if (parentIds.length === 0) return myCommits
          // 親コミットを一括取得
          const parentRes = await fetch(`http://localhost:3001/api/commits?ids=${parentIds.join(',')}`)
          let parentCommits: any[] = []
          if (parentRes.ok) {
            parentCommits = await parentRes.json()
          }
          // 重複を除いてマージ
          const allCommits = [...myCommits]
          for (const p of parentCommits) {
            if (!allCommits.some((c: any) => c.id === p.id)) {
              allCommits.push(p)
            }
          }
          return allCommits
        })
    }
  },
  modules: {}
})
