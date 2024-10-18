module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',  // Vue 3 推荐规则
    'plugin:@typescript-eslint/recommended',  // TypeScript 推荐规则
    'prettier',  // 解决 ESLint 和 Prettier 的冲突
  ],
  parserOptions: {
    ecmaVersion: 12,
    parser: '@typescript-eslint/parser',
    sourceType: 'module',
  },
  plugins: [
    'vue',
    '@typescript-eslint',
  ],
  rules: {
    'no-console': 'warn', // 控制台警告
    'no-debugger': 'warn', // 调试器警告
    '@typescript-eslint/no-unused-vars': 'warn', // 未使用变量警告
    'no-unused-vars': 0, // 存在声明但未使用的变量
    'no-useless-escape': 0, // 禁止不必要的转义字符
  },
};
