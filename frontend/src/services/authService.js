import { api } from "./api";

export const authService = {
  checkAuth: async () => {
    const res = await api.get("/auth/csrf/");
    return res.data;
  },

  login: async (username, password) => {
    // Call CSRF first to ensure cookie is present
    await api.get("/auth/csrf/");
    const res = await api.post("/auth/login/", { username, password });
    return res.data;
  },

  logout: async () => {
    const res = await api.post("/auth/logout/", {});
    return res;
  },

  getProfile: async () => {
    const res = await api.get("/auth/me/");
    return res.data;
  },
};
