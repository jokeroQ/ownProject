export default [
  {
    path: '/reports',
    name: 'workReports',
    component: () => import('@views/reports/index.vue'),
    meta: { title: '工作日报', requiresAuth: true },
  },
  {
    path: '/todos',
    name: 'todoList',
    component: () => import('@views/todos/index.vue'),
    meta: { title: '待办清单', requiresAuth: true },
  },
  {
    path: '/series',
    name: 'seriesSearch',
    component: () => import('@views/series/index.vue'),
    meta: { title: '最新剧集检索', requiresAuth: true },
  },
  {
    path: '/dinner',
    name: 'dinnerWheel',
    component: () => import('@views/dinner/index.vue'),
    meta: { title: '今晚吃什么', requiresAuth: true },
  },
  {
    path: '/map',
    name: 'visualMap',
    component: () => import('@views/map/index.vue'),
    meta: { title: '可视化地图', requiresAuth: true },
  },
  {
    path: '/admin/users',
    name: 'userManagement',
    component: () => import('@views/admin/users.vue'),
    meta: { title: '用户管理', requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/flowchart',
    name: 'flowchart',
    component: () => import('@views/flowchart/index.vue'),
    meta: { title: '流程图', requiresAuth: true },
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('@views/home/index.vue'),
    meta: {
      title: '首页',
      requiresAuth: true,
    },
  },
  {
    path: '/test',
    name: 'test',
    component: () => import('@views/test/index.vue'),
    meta: {
      title: '颜色变量测试',
      requiresAuth: true,
    },
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@views/chat/index.vue'),
    meta: {
      title: '聊天页面',
      requiresAuth: true,
    },
  },
  {
    path: '/signPad',
    name: 'signPad',
    component: () => import('@views/signPad/index.vue'),
    meta: {
      title: '签名板页面',
      requiresAuth: true,
    },
  },
];
