import { createStore } from 'vuex'

export interface State {
  count: number
}

const state: State = {
  count: 0
}

export default createStore({
  state,
  mutations: {
    increment(state: State) {
      state.count++
    }
  },
  actions: {},
  modules: {}
})
