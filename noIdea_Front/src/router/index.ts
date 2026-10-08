import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";

import homeRoutes from "./modules/home";
import { getToken } from '@/utils/auth';
import { getRequest } from '@/api/request';

const routes: Array<RouteRecordRaw> = [
  ...homeRoutes,
  {
    path: "/",
    name: "login",
    component: () =>
      import("../components/login/login.vue"),
  },
  {
    path: "/register",
    name: "register",
    component: () =>
      import("../components/login/register.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const needsCheck = to.meta.requiresAuth || (to.name === 'login' && getToken());
  let isLoggedIn = false;
  if (needsCheck && getToken()) {
    try { await getRequest('/users/me'); isLoggedIn = true; }
    catch { isLoggedIn = false; }
  }

  if (to.meta.requiresAuth && !isLoggedIn) {
    return {
      name: "login",
      query: { redirect: to.fullPath },
    };
  }

  if (to.name === "login" && isLoggedIn) {
    return { name: "home" };
  }

  return true;
});

export default router;
