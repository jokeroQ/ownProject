import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";

import homeRoutes from "./modules/home";

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

router.beforeEach((to) => {
  const isLoggedIn =
    localStorage.getItem("isLoggedIn") === "true";

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