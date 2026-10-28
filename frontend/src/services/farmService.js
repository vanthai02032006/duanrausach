import { api } from "./api";

export const farmService = {
  // Dashboard
  getDashboard: () => api.get("/dashboard/").then((r) => r.data),

  // Lots
  getLots: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/lots/${query ? `?${query}` : ""}`).then((r) => r.data);
  },
  createLot: (payload) => api.post("/lots/create/", payload).then((r) => r.data),
  updateLot: (id, payload) => api.post(`/lots/${id}/`, payload).then((r) => r.data),
  deleteLot: (id) => api.post(`/lots/${id}/delete/`, {}).then((r) => r.data),

  // Varieties
  getVarieties: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/varieties/${query ? `?${query}` : ""}`).then((r) => r.data);
  },
  createVariety: (payload) => api.post("/varieties/create/", payload).then((r) => r.data),
  updateVariety: (id, payload) => api.post(`/varieties/${id}/`, payload).then((r) => r.data),
  deleteVariety: (id) => api.post(`/varieties/${id}/delete/`, {}).then((r) => r.data),

  // Care Logs
  getCareLogs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/care/${query ? `?${query}` : ""}`).then((r) => r.data);
  },
  createCareLog: (payload) => api.post("/care/create/", payload).then((r) => r.data),
  updateCareLog: (id, payload) => api.post(`/care/${id}/`, payload).then((r) => r.data),
  deleteCareLog: (id) => api.post(`/care/${id}/delete/`, {}).then((r) => r.data),

  // Materials
  getMaterials: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/materials/${query ? `?${query}` : ""}`).then((r) => r.data);
  },
  createMaterial: (payload) => api.post("/materials/create/", payload).then((r) => r.data),
  updateMaterial: (id, payload) => api.post(`/materials/${id}/`, payload).then((r) => r.data),
  useMaterial: (payload) => api.post("/materials/use/", payload).then((r) => r.data),

  // Harvests
  getHarvests: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/harvests/${query ? `?${query}` : ""}`).then((r) => r.data);
  },
  createHarvest: (payload) => api.post("/harvests/create/", payload).then((r) => r.data),

  // Sales
  getSales: () => api.get("/sales/").then((r) => r.data),
  createSale: (payload) => api.post("/sales/create/", payload).then((r) => r.data),

  // Trace
  traceCode: (code) => api.get(`/trace/?code=${encodeURIComponent(code)}`).then((r) => r.data),

  // Knowledge
  getKnowledge: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/knowledge/${query ? `?${query}` : ""}`).then((r) => r.data);
  },
  createKnowledge: (payload) => api.post("/knowledge/create/", payload).then((r) => r.data),
  updateKnowledge: (id, payload) => api.post(`/knowledge/${id}/`, payload).then((r) => r.data),
  deleteKnowledge: (id) => api.post(`/knowledge/${id}/delete/`, {}).then((r) => r.data),

  // Reports
  getReports: () => api.get("/reports/").then((r) => r.data),
  getAiMonitor: () => api.get("/reports/ai-monitor/").then((r) => r.data),

  // Accounts
  getAccounts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/accounts/${query ? `?${query}` : ""}`).then((r) => r.data);
  },
  createAccount: (payload) => api.post("/accounts/create/", payload).then((r) => r.data),
  setRole: (id, role) => api.post(`/accounts/${id}/role/`, { role }).then((r) => r.data),
  toggleAccount: (id) => api.post(`/accounts/${id}/toggle/`, {}).then((r) => r.data),
};
