export default [
    {
        path: "/home",
        name: "home",
        component: () => import("@views/home/index.vue"),
        meta: {
            title: '首页',
            requiresAuth: true,
        }
    },
    {
        path: "/test",
        name: "test",
        component: () => import("@views/test/index.vue"),
        meta: {
            title: '测试页面',
            requiresAuth: true,
        }
    },
    {
        path: "/chat",
        name: "chat",
        component: () => import("@views/chat/index.vue"),
        meta: {
            title: '聊天页面',
            requiresAuth: true,
        }
    },
    {
        path: "/signPad",
        name: "signPad",
        component: () => import("@views/signPad/index.vue"),
        meta: {
            title: '签名板页面',
            requiresAuth: true,
        }
    }
]