import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router"
import homeRoutes from "./modules/home";
// import testRoutes from "./modules/home";

//路由类型 ：RouteRecordRaw
const routes: Array<RouteRecordRaw> = [
    // ...testRoutes,
    ...homeRoutes,
    {
        path: "/",
        component: () => import("../components/login/login.vue")
    },
    {
        path: "/register",
        component: () => import("../components/login/register.vue")
    },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

export default router;