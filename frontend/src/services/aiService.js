import { api } from "./api";

export const aiService = {
  getMeta: () => api.get("/ai/meta/").then((r) => r.data),
  generateAdvice: (payload) => api.post("/ai/generate/", payload).then((r) => r.data),
  submitFeedback: (id, feedback) => api.post(`/ai/${id}/feedback/`, { feedback }).then((r) => r.data),

  // Chatbot Endpoints
  getConversations: () => api.get("/ai/chat/conversations/").then((r) => r.data),
  createConversation: (payload = {}) => api.post("/ai/chat/conversations/", payload).then((r) => r.data),
  getConversation: (id) => api.get(`/ai/chat/conversations/${id}/`).then((r) => r.data),
  updateConversation: (id, payload) => api.patch(`/ai/chat/conversations/${id}/`, payload).then((r) => r.data),
  deleteConversation: (id) => api.delete(`/ai/chat/conversations/${id}/`).then((r) => r.data),
  sendMessage: (convId, payload) => api.post(`/ai/chat/conversations/${convId}/messages/`, payload).then((r) => r.data),
  submitMessageFeedback: (msgId, payload) => api.post(`/ai/chat/messages/${msgId}/feedback/`, payload).then((r) => r.data),
};
