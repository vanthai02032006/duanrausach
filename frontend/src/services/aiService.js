import { api } from "./api";

export const aiService = {
  getMeta: () => api.get("/ai/meta/").then((r) => r.data),
  generateAdvice: (payload) => api.post("/ai/generate/", payload).then((r) => r.data),
  submitFeedback: (id, feedback) => api.post(`/ai/${id}/feedback/`, { feedback }).then((r) => r.data),
};
