import React, { useState, useEffect, useRef } from "react";
import { aiService } from "../services/aiService";
import "../styles/chatbot-widget.css";

export function ChatbotWidget({ currentView, setCurrentView }) {
  const [isOpen, setIsOpen] = useState(() => {
    return sessionStorage.getItem("greenfarm_widget_open") === "1";
  });
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [aiStatus, setAiStatus] = useState("ready"); // "ready" | "busy" | "offline"
  const [aiConfigured, setAiConfigured] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");

  const chatBodyRef = useRef(null);
  const textareaRef = useRef(null);

  // Check AI metadata status on mount
  useEffect(() => {
    aiService.getMeta()
      .then((res) => {
        if (res.data) {
          const configured = res.data.configured !== false;
          setAiConfigured(configured);
          if (!configured) {
            setAiStatus("offline");
          }
        }
      })
      .catch(() => {
        // Fallback default
      });
  }, []);

  // When widget opens, load recent conversation or welcome
  useEffect(() => {
    sessionStorage.setItem("greenfarm_widget_open", isOpen ? "1" : "0");
    if (isOpen) {
      if (!activeConvId) {
        fetchConversations();
      }
      setTimeout(() => {
        if (textareaRef.current) textareaRef.current.focus();
      }, 200);
    }
  }, [isOpen]);

  // Auto-scroll chat body
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isSending, errorText]);

  const fetchConversations = async () => {
    try {
      const res = await aiService.getConversations();
      const list = res.data || [];
      setConversations(list);
      if (list.length > 0) {
        loadConversation(list[0].id);
      }
    } catch (err) {
      console.error("Lỗi tải hội thoại", err);
    }
  };

  const loadConversation = async (convId) => {
    setActiveConvId(convId);
    setLoading(true);
    setErrorText("");
    try {
      const res = await aiService.getConversation(convId);
      if (res.data) {
        setMessages(res.data.messages || []);
      }
    } catch (err) {
      console.error("Lỗi chi tiết hội thoại", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = async () => {
    try {
      const res = await aiService.createConversation({ title: "Cuộc trò chuyện mini" });
      if (res.data) {
        const newConv = res.data;
        setConversations((prev) => [newConv, ...prev]);
        setActiveConvId(newConv.id);
        setMessages([]);
        setErrorText("");
        if (textareaRef.current) {
          textareaRef.current.value = "";
          textareaRef.current.focus();
        }
      }
    } catch (err) {
      console.error("Lỗi tạo cuộc trò chuyện mới", err);
    }
  };

  const handleSendMessage = async (customText = null) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isSending) return;

    setLastPrompt(textToSend);
    setIsSending(true);
    setAiStatus("busy");
    setErrorText("");
    setInputMessage("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    let targetConvId = activeConvId;

    // Create a new conversation first if none exists
    if (!targetConvId) {
      try {
        const createRes = await aiService.createConversation({
          title: textToSend.substring(0, 40) || "Cuộc trò chuyện mini"
        });
        if (createRes.data) {
          targetConvId = createRes.data.id;
          setActiveConvId(targetConvId);
          setConversations((prev) => [createRes.data, ...prev]);
        }
      } catch (e) {
        // Continue to attempt
      }
    }

    // Optimistically append user message
    const tempUserMsg = {
      id: "temp-" + Date.now(),
      role: "user",
      content: textToSend,
      time_display: "Vừa xong",
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await aiService.sendMessage(targetConvId, { content: textToSend });
      if (res.data && res.data.assistant_message) {
        const assistantMsg = res.data.assistant_message;
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setErrorText("Không nhận được phản hồi từ AI. Vui lòng thử lại.");
      }
    } catch (err) {
      setErrorText("Lỗi kết nối tới Gemini AI. Vui lòng kiểm tra lại mạng hoặc khóa API.");
    } finally {
      setIsSending(false);
      setAiStatus(aiConfigured ? "ready" : "offline");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleOpenFullscreen = () => {
    if (setCurrentView) {
      setCurrentView("ai");
      setIsOpen(false);
    }
  };

  return (
    <div id="gf-chatbot-widget" className="gf-chatbot-widget">
      {/* Floating Trigger Button */}
      <button
        id="gf-chat-trigger-btn"
        className="gf-chat-trigger"
        type="button"
        aria-label="Mở Trợ lý GreenFarm AI"
        title="Trợ lý GreenFarm AI"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="gf-chat-trigger-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
            <path d="M12 2a8 8 0 0 0-8 8c0 3.3 2 6.2 5 7.4V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.6c3-1.2 5-4.1 5-7.4a8 8 0 0 0-8-8z"/>
            <path d="M9.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
            <path d="M14.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
            <path d="M8.5 14s1 1.5 3.5 1.5 3.5-1.5 3.5-1.5"/>
          </svg>
        </span>
      </button>

      {/* Floating Chat Window */}
      <div
        id="gf-chat-window"
        className={`gf-chat-window ${isOpen ? "open" : ""}`}
        role="dialog"
        aria-label="Cửa sổ trò chuyện GreenFarm AI"
      >
        {/* Header */}
        <div className="gf-chat-header">
          <div className="gf-chat-header-info">
            <div className="gf-chat-avatar">🌱</div>
            <div className="gf-chat-title-group">
              <h4>Trợ lý GreenFarm AI</h4>
              <p className="gf-chat-subtitle">
                <span
                  id="gf-status-indicator"
                  className={`gf-status-indicator ${aiStatus === "busy" ? "busy" : aiStatus === "offline" ? "offline" : ""}`}
                />
                <span id="gf-status-text">
                  {aiStatus === "busy" ? "Đang xử lý..." : aiStatus === "offline" ? "Chưa khả dụng" : "Sẵn sàng hỗ trợ"}
                </span>
              </p>
            </div>
          </div>
          <div className="gf-chat-header-actions">
            <button
              id="gf-chat-new-btn"
              className="gf-header-btn"
              type="button"
              title="Cuộc trò chuyện mới"
              aria-label="Tạo cuộc trò chuyện mới"
              onClick={handleNewConversation}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              id="gf-chat-fullscreen-btn"
              className="gf-header-btn"
              type="button"
              title="Mở trang Trợ lý AI đầy đủ"
              aria-label="Mở trang đầy đủ"
              onClick={handleOpenFullscreen}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
            <button
              id="gf-chat-close-btn"
              className="gf-header-btn"
              type="button"
              title="Đóng cửa sổ"
              aria-label="Đóng cửa sổ"
              onClick={() => setIsOpen(false)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat Body */}
        <div id="gf-chat-body" className="gf-chat-body" ref={chatBodyRef}>
          {messages.length === 0 && !loading && (
            <div className="gf-welcome-box">
              <div className="gf-welcome-icon">🌱</div>
              <div className="gf-welcome-title">Xin chào!</div>
              <div className="gf-welcome-desc">Tôi có thể giúp gì cho trang trại của bạn hôm nay?</div>

              {!aiConfigured && (
                <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "8px", padding: "8px 10px", marginBottom: "12px", fontSize: "0.78rem", color: "#92400e" }}>
                  ⚠️ Trợ lý AI đang chờ cấu hình khóa <code>GEMINI_API_KEY</code> ở file cấu hình. Bạn vẫn có thể mở giao diện và duyệt lịch sử.
                </div>
              )}

              <div className="gf-quick-prompts">
                <button
                  className="gf-quick-prompt-btn"
                  type="button"
                  onClick={() => handleSendMessage("Lô nào cần kiểm tra hôm nay?")}
                >
                  🔍 Lô nào cần kiểm tra hôm nay?
                </button>
                <button
                  className="gf-quick-prompt-btn"
                  type="button"
                  onClick={() => handleSendMessage("Tóm tắt nhật ký chăm sóc gần đây.")}
                >
                  📋 Tóm tắt nhật ký chăm sóc.
                </button>
                <button
                  className="gf-quick-prompt-btn"
                  type="button"
                  onClick={() => handleSendMessage("Lập lịch chăm sóc cây trồng 7 ngày tới.")}
                >
                  🌱 Lập lịch chăm sóc cây trồng.
                </button>
                <button
                  className="gf-quick-prompt-btn"
                  type="button"
                  onClick={() => handleSendMessage("Kiểm tra vật tư sắp hết trong kho.")}
                >
                  📦 Kiểm tra vật tư sắp hết.
                </button>
              </div>
            </div>
          )}

          {/* Render messages */}
          {messages.map((m) => {
            const isUser = m.role === "user";
            const isError = m.status === "error";
            return (
              <div key={m.id || Math.random()} className={`gf-msg-row ${isUser ? "user" : "assistant"}`}>
                <div className={`gf-msg-avatar ${isUser ? "user" : "assistant"}`}>
                  {isUser ? "👤" : isError ? "⚠️" : "🌿"}
                </div>
                <div>
                  <div
                    className={`gf-msg-bubble ${isUser ? "user" : "assistant"}`}
                    style={isError ? { borderColor: "#fecaca", background: "#fff5f5", color: "#991b1b" } : undefined}
                  >
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                    {isError && (
                      <div style={{ marginTop: "6px" }}>
                        <button
                          type="button"
                          style={{ background: "#059669", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "0.75rem", cursor: "pointer" }}
                          onClick={() => handleSendMessage(lastPrompt)}
                        >
                          Thử lại
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="gf-msg-meta">
                    <span>{m.time_display || "Vừa xong"}</span>
                    {!isUser && m.model_name && <span>• {m.model_name}</span>}
                    {m.latency_ms ? <span>({m.latency_ms} ms)</span> : null}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Thinking State */}
          {isSending && (
            <div className="gf-thinking" id="gf-current-thinking">
              <div className="gf-dots">
                <span className="gf-dot" />
                <span className="gf-dot" />
                <span className="gf-dot" />
              </div>
              <span>Gemini đang tra cứu dữ liệu...</span>
            </div>
          )}

          {/* Global Error Banner */}
          {errorText && (
            <div className="gf-msg-row assistant">
              <div className="gf-msg-avatar assistant">⚠️</div>
              <div>
                <div className="gf-msg-bubble assistant" style={{ borderColor: "#fecaca", background: "#fff5f5", color: "#991b1b" }}>
                  {errorText}
                  <div style={{ marginTop: "6px" }}>
                    <button
                      type="button"
                      style={{ background: "#059669", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "0.75rem", cursor: "pointer" }}
                      onClick={() => handleSendMessage(lastPrompt)}
                    >
                      Thử lại
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer / Input Bar */}
        <div className="gf-chat-footer">
          <div className="gf-input-row">
            <textarea
              ref={textareaRef}
              id="gf-chat-textarea"
              className="gf-textarea"
              placeholder="Nhập câu hỏi nông nghiệp... (Shift+Enter xuống dòng)"
              rows={1}
              maxLength={3000}
              value={inputMessage}
              onChange={(e) => {
                setInputMessage(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 90) + "px";
              }}
              onKeyDown={handleKeyDown}
            />
            <button
              id="gf-chat-send-btn"
              className="gf-send-btn"
              type="button"
              title="Gửi câu hỏi"
              disabled={!inputMessage.trim() || isSending}
              onClick={() => handleSendMessage()}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
