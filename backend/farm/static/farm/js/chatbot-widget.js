/**
 * GreenFarm AI — Floating Mini Chatbot Widget Client
 * Seamlessly connects to Django Backend Chat APIs, sharing conversations with AIAssistantPage.
 */
(function() {
  if (window.__greenfarmChatbotLoaded) return;
  window.__greenfarmChatbotLoaded = true;

  function getCsrfToken() {
    // 1. Try hidden input rendered by {% csrf_token %}
    const input = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (input && input.value) return input.value;

    // 2. Try meta tag
    const meta = document.querySelector('meta[name="csrf-token"]');
    if (meta && meta.content) return meta.content;

    // 3. Try reading document.cookie
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const c = cookies[i].trim();
        if (c.startsWith("csrftoken=")) {
          return decodeURIComponent(c.substring("csrftoken=".length));
        }
      }
    }
    return "";
  }

  // Format simple markdown (bold, italic, inline code, headers, lists, linebreaks)
  function formatMarkdown(text) {
    if (!text) return "";
    let safe = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Headings
    safe = safe.replace(/^### (.*$)/gim, '<strong style="color:#064e3b; display:block; margin:6px 0 2px;">$1</strong>');
    safe = safe.replace(/^## (.*$)/gim, '<strong style="color:#064e3b; font-size:1.05em; display:block; margin:8px 0 3px;">$1</strong>');

    // Bold & italic
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*(.*?)\*/g, '<em>$1</em>');
    safe = safe.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9; padding:2px 4px; border-radius:4px; font-size:0.85em;">$1</code>');

    // Bullet lists
    safe = safe.replace(/^[\*\-•]\s+(.*$)/gim, '<li style="margin-left:14px; margin-bottom:2px;">$1</li>');

    // Line breaks
    safe = safe.replace(/\n/g, '<br/>');
    return safe;
  }

  let activeConvId = null;
  let isSending = false;
  let isAIConfigured = true;
  let currentLotContextId = null;

  function initChatbot() {
    const widgetRoot = document.getElementById("gf-chatbot-widget");
    const triggerBtn = document.getElementById("gf-chat-trigger-btn");
    const chatWindow = document.getElementById("gf-chat-window");
    const closeBtn = document.getElementById("gf-chat-close-btn");
    const newChatBtn = document.getElementById("gf-chat-new-btn");
    const fullscreenBtn = document.getElementById("gf-chat-fullscreen-btn");
    const chatBody = document.getElementById("gf-chat-body");
    const textarea = document.getElementById("gf-chat-textarea");
    const sendBtn = document.getElementById("gf-chat-send-btn");
    const statusDot = document.getElementById("gf-status-indicator");
    const statusText = document.getElementById("gf-status-text");
    const unreadBadge = document.getElementById("gf-chat-unread-badge");
    const lotBanner = document.getElementById("gf-lot-context-banner");
    const lotNameSpan = document.getElementById("gf-lot-context-name");
    const clearLotBtn = document.getElementById("gf-clear-lot-context-btn");

    if (!triggerBtn || !chatWindow) return;

    // Detect if page has active lot context
    if (widgetRoot) {
      const lotId = widgetRoot.getAttribute("data-lot-id");
      const lotCode = widgetRoot.getAttribute("data-lot-code");
      if (lotId) {
        currentLotContextId = parseInt(lotId, 10);
        if (lotBanner && lotNameSpan) {
          lotNameSpan.innerText = lotCode ? `Lô ${lotCode}` : `Lô #${lotId}`;
          lotBanner.style.display = "flex";
        }
      }
    }

    if (clearLotBtn) {
      clearLotBtn.addEventListener("click", () => {
        currentLotContextId = null;
        if (lotBanner) lotBanner.style.display = "none";
      });
    }

    // Toggle window
    function toggleChat(open) {
      const isOpen = typeof open === "boolean" ? open : !chatWindow.classList.contains("open");
      if (isOpen) {
        chatWindow.classList.add("open");
        sessionStorage.setItem("greenfarm_widget_open", "1");
        if (unreadBadge) {
          unreadBadge.style.display = "none";
          unreadBadge.innerText = "0";
        }
        if (!activeConvId) {
          loadLatestConversation();
        }
        setTimeout(() => textarea && textarea.focus(), 200);
      } else {
        chatWindow.classList.remove("open");
        sessionStorage.setItem("greenfarm_widget_open", "0");
      }
    }

    triggerBtn.addEventListener("click", () => toggleChat());
    if (closeBtn) closeBtn.addEventListener("click", () => toggleChat(false));

    // Restore state from sessionStorage
    if (sessionStorage.getItem("greenfarm_widget_open") === "1") {
      toggleChat(true);
    }

    // Check Gemini API Configuration Status
    checkAIStatus();

    async function checkAIStatus() {
      try {
        const res = await fetch("/api/ai/meta/", {
          headers: { "X-Requested-With": "XMLHttpRequest" }
        });
        if (res.ok) {
          const json = await res.json();
          const configured = json.data && json.data.configured !== false;
          isAIConfigured = configured;
          if (!configured) {
            if (statusDot) statusDot.className = "gf-status-indicator offline";
            if (statusText) statusText.innerText = "Chưa khả dụng";
          } else {
            if (statusDot) statusDot.className = "gf-status-indicator";
            if (statusText) statusText.innerText = "Sẵn sàng hỗ trợ";
          }
        }
      } catch (e) {
        // Fallback default
      }
    }

    // Auto-resize textarea
    if (textarea) {
      textarea.addEventListener("input", function() {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 90) + "px";
        if (sendBtn) sendBtn.disabled = !this.value.trim() || isSending;
      });

      textarea.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener("click", () => sendMessage());
    }

    if (newChatBtn) {
      newChatBtn.addEventListener("click", () => createNewConversation());
    }

    function updateFullscreenLink(convId) {
      if (fullscreenBtn) {
        if (convId) {
          fullscreenBtn.href = `/farm/ai-assistant/?conversation_id=${convId}`;
        } else {
          fullscreenBtn.href = `/farm/ai-assistant/`;
        }
      }
    }

    // API: Load latest conversation
    async function loadLatestConversation() {
      try {
        const res = await fetch("/api/ai/chat/conversations/", {
          headers: { "X-Requested-With": "XMLHttpRequest" }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && json.data.length > 0) {
            loadConversation(json.data[0].id);
            return;
          }
        }
        renderWelcome();
      } catch (e) {
        renderWelcome();
      }
    }

    // API: Load specific conversation
    async function loadConversation(convId) {
      activeConvId = convId;
      updateFullscreenLink(convId);
      try {
        const res = await fetch(`/api/ai/chat/conversations/${convId}/`, {
          headers: { "X-Requested-With": "XMLHttpRequest" }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            renderMessages(json.data.messages || []);
          }
        }
      } catch (e) {
        console.error("Lỗi tải hội thoại", e);
      }
    }

    // API: Create new conversation
    async function createNewConversation() {
      try {
        const csrfToken = getCsrfToken();
        const payload = { title: "Cuộc trò chuyện mini" };
        if (currentLotContextId) {
          payload.crop_lot_id = currentLotContextId;
        }

        const res = await fetch("/api/ai/chat/conversations/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            activeConvId = json.data.id;
            updateFullscreenLink(activeConvId);
            renderWelcome();
            if (textarea) {
              textarea.value = "";
              textarea.focus();
            }
          }
        }
      } catch (e) {
        console.error("Lỗi tạo cuộc trò chuyện mới", e);
      }
    }

    function renderWelcome() {
      if (!chatBody) return;
      chatBody.innerHTML = `
        <div class="gf-welcome-box">
          <div class="gf-welcome-icon">🌱</div>
          <div class="gf-welcome-title">Xin chào!</div>
          <div class="gf-welcome-desc">Tôi có thể giúp gì cho trang trại của bạn hôm nay?</div>
          
          ${!isAIConfigured ? `
            <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:8px; padding:8px 10px; margin-bottom:12px; font-size:0.78rem; color:#92400e;">
              ⚠️ Trợ lý AI đang chờ cấu hình khóa <code>GEMINI_API_KEY</code> ở file cấu hình. Bạn vẫn có thể mở giao diện và duyệt lịch sử.
            </div>
          ` : ""}

          <div class="gf-quick-prompts">
            <button class="gf-quick-prompt-btn" type="button" data-prompt="Lô nào cần kiểm tra hôm nay?">🔍 Lô nào cần kiểm tra hôm nay?</button>
            <button class="gf-quick-prompt-btn" type="button" data-prompt="Tóm tắt nhật ký chăm sóc gần đây.">📋 Tóm tắt nhật ký chăm sóc.</button>
            <button class="gf-quick-prompt-btn" type="button" data-prompt="Lập lịch chăm sóc cây trồng 7 ngày tới.">🌱 Lập lịch chăm sóc cây trồng.</button>
            <button class="gf-quick-prompt-btn" type="button" data-prompt="Kiểm tra vật tư sắp hết trong kho.">📦 Kiểm tra vật tư sắp hết.</button>
          </div>
        </div>
      `;

      // Re-attach quick prompt handlers
      chatBody.querySelectorAll(".gf-quick-prompt-btn").forEach(btn => {
        btn.addEventListener("click", function() {
          const text = this.getAttribute("data-prompt") || this.innerText.trim();
          sendMessage(text);
        });
      });
    }

    function renderMessages(messages) {
      if (!chatBody) return;
      if (!messages || messages.length === 0) {
        renderWelcome();
        return;
      }

      chatBody.innerHTML = messages.map(m => {
        const isUser = m.role === "user";
        const isError = m.status === "error";
        return `
          <div class="gf-msg-row ${isUser ? "user" : "assistant"}">
            <div class="gf-msg-avatar ${isUser ? "user" : "assistant"}">
              ${isUser ? "👤" : (isError ? "⚠️" : "🌿")}
            </div>
            <div>
              <div class="gf-msg-bubble ${isUser ? "user" : "assistant"}" ${isError ? 'style="border-color:#fecaca; background:#fff5f5; color:#991b1b;"' : ""}>
                ${isUser ? m.content : formatMarkdown(m.content)}
              </div>
              <div class="gf-msg-meta">
                <span>${m.time_display || ""}</span>
                ${!isUser && m.model_name ? `<span>• ${m.model_name}</span>` : ""}
              </div>
            </div>
          </div>
        `;
      }).join("");

      scrollToBottom();
    }

    function scrollToBottom() {
      if (chatBody) {
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    }

    // Send Message
    async function sendMessage(overrideText) {
      const text = (overrideText || (textarea ? textarea.value : "")).trim();
      if (!text || isSending) return;

      isSending = true;
      if (sendBtn) sendBtn.disabled = true;
      if (textarea) {
        textarea.value = "";
        textarea.style.height = "auto";
      }
      if (statusDot) statusDot.className = "gf-status-indicator busy";
      if (statusText) statusText.innerText = "Đang xử lý...";

      // If no active conversation, create one first
      if (!activeConvId) {
        try {
          const csrfToken = getCsrfToken();
          const createPayload = { title: text.substring(0, 40) || "Cuộc trò chuyện mini" };
          if (currentLotContextId) createPayload.crop_lot_id = currentLotContextId;

          const createRes = await fetch("/api/ai/chat/conversations/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": csrfToken,
              "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify(createPayload)
          });
          const cJson = await createRes.json();
          if (cJson.success && cJson.data) {
            activeConvId = cJson.data.id;
            updateFullscreenLink(activeConvId);
          }
        } catch (e) {
          // Continue attempt
        }
      }

      // Append user bubble to UI
      const welcome = chatBody.querySelector(".gf-welcome-box");
      if (welcome) welcome.remove();

      const userRow = document.createElement("div");
      userRow.className = "gf-msg-row user";
      userRow.innerHTML = `
        <div class="gf-msg-avatar user">👤</div>
        <div>
          <div class="gf-msg-bubble user">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          <div class="gf-msg-meta">Vừa xong</div>
        </div>
      `;
      chatBody.appendChild(userRow);

      // Thinking indicator
      const thinkingEl = document.createElement("div");
      thinkingEl.className = "gf-thinking";
      thinkingEl.id = "gf-current-thinking";
      thinkingEl.innerHTML = `
        <div class="gf-dots"><span class="gf-dot"></span><span class="gf-dot"></span><span class="gf-dot"></span></div>
        <span>Gemini đang tra cứu dữ liệu...</span>
      `;
      chatBody.appendChild(thinkingEl);
      scrollToBottom();

      try {
        const csrfToken = getCsrfToken();
        const msgPayload = { content: text };
        if (currentLotContextId) {
          msgPayload.crop_lot_id = currentLotContextId;
        }

        const res = await fetch(`/api/ai/chat/conversations/${activeConvId}/messages/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify(msgPayload)
        });

        const thinking = document.getElementById("gf-current-thinking");
        if (thinking) thinking.remove();

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const aiMsg = json.data.assistant_message;
            const isError = aiMsg.status === "error";

            const aiRow = document.createElement("div");
            aiRow.className = "gf-msg-row assistant";
            aiRow.innerHTML = `
              <div class="gf-msg-avatar assistant">${isError ? "⚠️" : "🌿"}</div>
              <div>
                <div class="gf-msg-bubble assistant" ${isError ? 'style="border-color:#fecaca; background:#fff5f5; color:#991b1b;"' : ""}>
                  ${formatMarkdown(aiMsg.content)}
                  ${isError ? `
                    <div style="margin-top:6px;">
                      <button class="gf-retry-btn" type="button" style="background:#059669; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:0.75rem; cursor:pointer;">Thử lại</button>
                    </div>
                  ` : ""}
                </div>
                <div class="gf-msg-meta">
                  <span>${aiMsg.time_display || "Vừa xong"}</span>
                  ${aiMsg.model_name ? `<span>• ${aiMsg.model_name}</span>` : ""}
                  ${aiMsg.latency_ms ? `<span>(${aiMsg.latency_ms} ms)</span>` : ""}
                </div>
              </div>
            `;
            chatBody.appendChild(aiRow);

            if (isError) {
              const retryBtn = aiRow.querySelector(".gf-retry-btn");
              if (retryBtn) {
                retryBtn.addEventListener("click", () => {
                  aiRow.remove();
                  sendMessage(text);
                });
              }
            }
          } else {
            showErrorBubble(text);
          }
        } else {
          showErrorBubble(text);
        }
      } catch (err) {
        const thinking = document.getElementById("gf-current-thinking");
        if (thinking) thinking.remove();
        showErrorBubble(text);
      } finally {
        isSending = false;
        if (sendBtn) sendBtn.disabled = !textarea || !textarea.value.trim();
        if (statusDot) statusDot.className = isAIConfigured ? "gf-status-indicator" : "gf-status-indicator offline";
        if (statusText) statusText.innerText = isAIConfigured ? "Sẵn sàng hỗ trợ" : "Chưa khả dụng";
        scrollToBottom();
      }
    }

    function showErrorBubble(originalText) {
      const errRow = document.createElement("div");
      errRow.className = "gf-msg-row assistant";
      errRow.innerHTML = `
        <div class="gf-msg-avatar assistant">⚠️</div>
        <div>
          <div class="gf-msg-bubble assistant" style="border-color:#fecaca; background:#fff5f5; color:#991b1b;">
            Không thể hoàn tất kết nối tới máy chủ AI. Vui lòng kiểm tra lại mạng hoặc khóa API.
            <div style="margin-top:6px;">
              <button class="gf-retry-btn" type="button" style="background:#059669; color:#fff; border:none; padding:4px 10px; border-radius:6px; font-size:0.75rem; cursor:pointer;">Thử lại</button>
            </div>
          </div>
        </div>
      `;
      chatBody.appendChild(errRow);
      const retryBtn = errRow.querySelector(".gf-retry-btn");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => {
          errRow.remove();
          sendMessage(originalText);
        });
      }
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChatbot);
  } else {
    initChatbot();
  }
})();
