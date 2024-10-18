import { createStore } from 'vuex';

export default createStore({
  state: {
    theme: 'default' // 默认主题
  },
  mutations: {
    SET_THEME(state, theme: string) {
      state.theme = theme;
      document.documentElement.setAttribute('data-theme', theme);
    }
  },
  actions: {
    setTheme({ commit }, theme: string) {
      commit('SET_THEME', theme);
    }
  },
  getters: {
    currentTheme: state => state.theme
  }
});