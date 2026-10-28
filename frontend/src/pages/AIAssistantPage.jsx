import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  Database,
  Layers,
  Calendar,
  AlertCircle,
  RefreshCw,
  PanelLeftClose,
  PanelLeft,
  X,
  Sprout,
  FileText,
  Search,
  Wheat,
  Package,
  BarChart3,
  Bot,
  User as UserIcon,
  CheckCircle2,
} from "lucide-react";
import { aiService } from "../services/aiService";
import { farmService } from "../services/farmService";
import { useAuth } from "../hooks/useAuth";
import { Alert } from "../components/Alert";
import { LoadingSpinner } from "../components/LoadingSpinner";

// Lightweight safe Markdown formatting component
function FormattedMessage({ text }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let inList = false;
  let listItems = [];
  let inCodeBlock = false;
  let codeLines = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ paddingLeft: "20px", marginBottom: "10px" }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ marginBottom: "4px" }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushCode = () => {
    if (inCodeBlock && codeLines.length > 0) {
      elements.push(
        <pre key={`code-${elements.length}`}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      codeLines = [];
      inCodeBlock = false;
    }
  };

  const renderInline = (str) => {
    // Regex for bold **text**, inline code `code`, and italic *text*
    const parts = [];
    let remaining = str;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Bold **...**
      const boldMatch = remaining.match(/^(.*?)\*\*(.*?)\*\*(.*)$/);
      if (boldMatch) {
        if (boldMatch[1]) parts.push(<span key={keyIdx++}>{boldMatch[1]}</span>);
        parts.push(<strong key={keyIdx++}>{boldMatch[2]}</strong>);
        remaining = boldMatch[3];
        continue;
      }

      // Inline code `...`
      const codeMatch = remaining.match(/^(.*?)`(.*?)`(.*)$/);
      if (codeMatch) {
        if (codeMatch[1]) parts.push(<span key={keyIdx++}>{codeMatch[1]}</span>);
        parts.push(<code key={keyIdx++}>{codeMatch[2]}</code>);
        remaining = codeMatch[3];
        continue;
      }

      // Plain text
      parts.push(<span key={keyIdx++}>{remaining}</span>);
      break;
    }

    return parts;
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();

    // Code block toggle
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        flushCode();
      } else {
        flushList();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      return;
    }

    // Unordered List item
    if (line.match(/^[-*•]\s+/)) {
      inList = true;
      listItems.push(line.replace(/^[-*•]\s+/, ""));
      return;
    } else if (inList) {
      flushList();
    }

    // Headings
    if (line.startsWith("### ")) {
      elements.push(<h3 key={index}>{renderInline(line.replace("### ", ""))}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={index}>{renderInline(line.replace("## ", ""))}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={index}>{renderInline(line.replace("# ", ""))}</h1>);
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={index}>
          <p>{renderInline(line.replace("> ", ""))}</p>
        </blockquote>
      );
    } else if (line.trim() === "") {
      // Blank line spacer
      elements.push(<div key={index} style={{ height: "6px" }} />);
    } else {
      elements.push(<p key={index}>{renderInline(line)}</p>);
    }
  });

  flushList();
  flushCode();

  return <div className="chat-markdown">{elements}</div>;
}

export function AIAssistantPage() {
  const { user } = useAuth();

  // State
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [lots, setLots] = useState([]);
  const [selectedLotId, setSelectedLotId] = useState("");

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  const [inputText, setInputText] = useState("");
  const [historyOpen, setHistoryOpen] = useState(true);
  const [editingConvId, setEditingConvId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [expandedRefs, setExpandedRefs] = useState(new Set());
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [meta, setMeta] = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Status computation
  const isOnline = !meta?.error;
  const statusLabel = sending ? "Đang xử lý" : isOnline ? "Đã kết nối" : "Không khả dụng";
  const statusClass = sending ? "busy" : isOnline ? "online" : "offline";

  // Role display
  const roleName = user?.role === "Manager" ? "Quản lý" : user?.role === "Technician" ? "Kỹ thuật viên" : "Nhân viên";

  // 1. Load initial data: conversations, accessible lots, meta
  const initData = async () => {
    setLoadingInitial(true);
    try {
      const [convsData, lotsData, metaData] = await Promise.all([
        aiService.getConversations().catch(() => []),
        farmService.getLots().catch(() => []),
        aiService.getMeta().catch(() => null),
      ]);

      setConversations(convsData || []);
      setLots(lotsData || []);
      setMeta(metaData);

      if (convsData && convsData.length > 0) {
        selectConversation(convsData[0].id);
      }
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi nạp dữ liệu trợ lý AI." });
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    initData();
  }, []);

  // 2. Select conversation and load its messages
  const selectConversation = async (convId) => {
    if (!convId) return;
    setActiveConvId(convId);
    setLoadingMessages(true);
    try {
      const detail = await aiService.getConversation(convId);
      setCurrentConversation(detail);
      setMessages(detail.messages || []);
      if (detail.crop_lot_id) {
        setSelectedLotId(detail.crop_lot_id.toString());
      } else {
        setSelectedLotId("");
      }
    } catch (err) {
      setAlert({ type: "danger", message: "Không thể tải nội dung cuộc hội thoại." });
    } finally {
      setLoadingMessages(false);
    }
  };

  // 3. Scroll to bottom on new message or conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // 4. Auto-resize textarea
  const handleTextareaChange = (e) => {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 130)}px`;
    }
  };

  // 5. Create new conversation
  const handleNewConversation = async () => {
    try {
      const newConv = await aiService.createConversation({
        title: "Cuộc trò chuyện mới",
        crop_lot_id: selectedLotId ? parseInt(selectedLotId, 10) : null,
      });
      setConversations([newConv, ...conversations]);
      setActiveConvId(newConv.id);
      setCurrentConversation(newConv);
      setMessages([]);
      setInputText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi tạo cuộc trò chuyện mới." });
    }
  };

  // 6. Rename conversation
  const startRename = (conv) => {
    setEditingConvId(conv.id);
    setEditingTitle(conv.title);
  };

  const saveRename = async (convId) => {
    if (!editingTitle.trim()) {
      setEditingConvId(null);
      return;
    }
    try {
      const updated = await aiService.updateConversation(convId, { title: editingTitle.trim() });
      setConversations(conversations.map((c) => (c.id === convId ? { ...c, title: updated.title } : c)));
      if (currentConversation && currentConversation.id === convId) {
        setCurrentConversation({ ...currentConversation, title: updated.title });
      }
    } catch (err) {
      setAlert({ type: "danger", message: "Không thể đổi tên cuộc trò chuyện." });
    } finally {
      setEditingConvId(null);
    }
  };

  // 7. Delete conversation
  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    if (!window.confirm("Bạn có chắc chắn muốn xóa cuộc trò chuyện này cùng toàn bộ tin nhắn liên quan?")) {
      return;
    }
    try {
      await aiService.deleteConversation(convId);
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);
      if (activeConvId === convId) {
        if (remaining.length > 0) {
          selectConversation(remaining[0].id);
        } else {
          setActiveConvId(null);
          setCurrentConversation(null);
          setMessages([]);
        }
      }
    } catch (err) {
      setAlert({ type: "danger", message: "Lỗi xóa cuộc hội thoại." });
    }
  };

  // 8. Send message
  const handleSendMessage = async (customText = null) => {
    const textToSend = customText || inputText;
    if (!textToSend.trim() || sending) return;

    let targetConvId = activeConvId;

    // If no active conversation, create one first
    if (!targetConvId) {
      try {
        const created = await aiService.createConversation({
          title: "Cuộc trò chuyện mới",
          crop_lot_id: selectedLotId ? parseInt(selectedLotId, 10) : null,
        });
        targetConvId = created.id;
        setActiveConvId(created.id);
        setCurrentConversation(created);
        setConversations([created, ...conversations]);
      } catch (err) {
        setAlert({ type: "danger", message: "Lỗi tạo phiên hội thoại mới." });
        return;
      }
    }

    // Optimistic UI for user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: textToSend,
      time_display: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setSending(true);
    setAlert({ type: "", message: "" });

    try {
      const res = await aiService.sendMessage(targetConvId, {
        content: textToSend,
        crop_lot_id: selectedLotId ? parseInt(selectedLotId, 10) : null,
      });

      // Replace with confirmed messages from backend
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
        return [...filtered, res.user_message, res.assistant_message];
      });

      // Update conversation title in sidebar if renamed automatically
      if (res.conversation_title) {
        setConversations((prev) =>
          prev.map((c) => (c.id === targetConvId ? { ...c, title: res.conversation_title } : c))
        );
        if (currentConversation) {
          setCurrentConversation((prev) => ({ ...prev, title: res.conversation_title }));
        }
      }
    } catch (err) {
      setAlert({
        type: "danger",
        message: err.message || "Không thể nhận phản hồi từ Gemini AI. Vui lòng thử lại.",
      });
      // Retain draft message so user doesn't lose text
      setInputText(textToSend);
    } finally {
      setSending(false);
    }
  };

  // Key handler (Enter to send, Shift+Enter for newline)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 9. Quick Suggestion Card click handler
  const handleCardClick = (card) => {
    if (card.needsLot && !selectedLotId) {
      setAlert({
        type: "warning",
        message: `Câu hỏi "${card.title}" cần đối chiếu dữ liệu một lô cụ thể. Vui lòng chọn một lô trồng ở thanh trên trước khi gửi!`,
      });
      return;
    }
    setInputText(card.prompt);
    handleSendMessage(card.prompt);
  };

  // 10. Copy answer to clipboard
  const handleCopyText = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // 11. Feedback rating
  const handleFeedback = async (msgId, rating) => {
    try {
      await aiService.submitMessageFeedback(msgId, { rating });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedback: { rating } } : m))
      );
    } catch (err) {
      setAlert({ type: "danger", message: "Lỗi gửi phản hồi đánh giá." });
    }
  };

  // 12. Toggle Reference Accordion
  const toggleRefAccordion = (msgId) => {
    setExpandedRefs((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  // Group conversations: Hôm nay, Hôm qua, Trước đó
  const groupConversations = () => {
    const today = new Date().toLocaleDateString();
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toLocaleDateString();

    const groups = { today: [], yesterday: [], older: [] };
    conversations.forEach((c) => {
      const cDate = new Date(c.updated_at).toLocaleDateString();
      if (cDate === today) {
        groups.today.push(c);
      } else if (cDate === yesterday) {
        groups.yesterday.push(c);
      } else {
        groups.older.push(c);
      }
    });
    return groups;
  };

  const grouped = groupConversations();

  // Selected Lot Details Helper
  const selectedLotObj = lots.find((l) => l.id.toString() === selectedLotId);

  // 6 Predefined Quick Prompt Cards (Requirement 2.D)
  const quickCards = [
    {
      icon: <Sprout size={20} color="#059669" />,
      title: "🌱 Lập lịch chăm sóc",
      desc: "Lập lịch tưới nước, bón phân 7 ngày tới cho lô",
      prompt: "Lập lịch chăm sóc chi tiết trong 7 ngày tới cho cây trồng của lô, bao gồm các hoạt động tưới nước, bón phân và lưu ý sinh trưởng.",
      needsLot: true,
    },
    {
      icon: <FileText size={20} color="#0284c7" />,
      title: "📋 Tóm tắt nhật ký",
      desc: "Tổng hợp các ghi nhận chăm sóc & quan sát gần nhất",
      prompt: "Tóm tắt các hoạt động chăm sóc, việc đã hoàn thành và quan sát sinh trưởng gần đây nhất của lô trồng.",
      needsLot: true,
    },
    {
      icon: <Search size={20} color="#d97706" />,
      title: "🔍 Lô cần kiểm tra",
      desc: "Chỉ ra các lô có việc tồn đọng hoặc dấu hiệu bất thường",
      prompt: "Phân tích toàn bộ trang trại và chỉ ra những lô trồng cần được ưu tiên kiểm tra, có công việc chăm sóc đang chờ hoặc dấu hiệu cần lưu ý.",
      needsLot: false,
    },
    {
      icon: <Wheat size={20} color="#16a34a" />,
      title: "🌾 Gợi ý thu hoạch",
      desc: "Đối chiếu ngày gieo và tiêu chuẩn thu hoạch",
      prompt: "Dựa trên ngày gieo và thời gian sinh trưởng chuẩn của giống cây, hãy phân tích xem lô đã đến thời điểm thu hoạch chưa và các tiêu chí chất lượng cần đối chiếu.",
      needsLot: true,
    },
    {
      icon: <Package size={20} color="#7c3aed" />,
      title: "📦 Kiểm tra vật tư",
      desc: "Cảnh báo phân bón, chế phẩm sinh học sắp hết",
      prompt: "Kiểm tra tình trạng tồn kho của các loại vật tư (phân bón, chế phẩm sinh học, hạt giống), cảnh báo những loại sắp hết và cần nhập thêm.",
      needsLot: false,
    },
    {
      icon: <BarChart3 size={20} color="#ea580c" />,
      title: "📊 Sản lượng thu hoạch",
      desc: "Đánh giá năng suất và chất lượng mùa vụ",
      prompt: "Phân tích sản lượng và chất lượng các đợt thu hoạch gần đây, đánh giá năng suất và lưu ý bảo quản nguồn gốc nông sản.",
      needsLot: false,
    },
  ];

  if (loadingInitial) {
    return <LoadingSpinner text="Đang khởi tạo Trợ lý AI Gemini..." />;
  }

  return (
    <div>
      {alert.message && (
        <Alert
          variant={alert.type}
          message={alert.message}
          onClose={() => setAlert({ type: "", message: "" })}
        />
      )}

      {/* Main Chatbot Application Layout */}
      <div className="chat-app-wrapper">
        {/* Left: Conversation History Pane (Collapsible) */}
        <aside className={`chat-history-pane ${!historyOpen ? "collapsed" : ""}`}>
          <div className="chat-history-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Bot size={20} style={{ color: "#059669" }} />
              <strong style={{ fontSize: "0.95rem", color: "#064e3b" }}>Lịch sử hội thoại</strong>
            </div>
            <button
              className="btn btn-primary btn-sm"
              style={{ padding: "4px 10px", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
              onClick={handleNewConversation}
              title="Tạo cuộc hội thoại mới"
            >
              <Plus size={14} /> Mới
            </button>
          </div>

          <div className="chat-history-list">
            {conversations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                Chưa có cuộc trò chuyện nào. Bấm <strong>+ Mới</strong> để bắt đầu!
              </div>
            ) : (
              <>
                {grouped.today.length > 0 && (
                  <div>
                    <div className="chat-history-group-title">Hôm nay</div>
                    {grouped.today.map(renderConvItem)}
                  </div>
                )}
                {grouped.yesterday.length > 0 && (
                  <div>
                    <div className="chat-history-group-title">Hôm qua</div>
                    {grouped.yesterday.map(renderConvItem)}
                  </div>
                )}
                {grouped.older.length > 0 && (
                  <div>
                    <div className="chat-history-group-title">Trước đó</div>
                    {grouped.older.map(renderConvItem)}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Right: Main Chat Pane */}
        <main className="chat-main-pane">
          {/* Header Bar */}
          <div className="chat-header-bar">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                className="chat-icon-btn"
                onClick={() => setHistoryOpen(!historyOpen)}
                title={historyOpen ? "Thu gọn lịch sử" : "Mở lịch sử"}
                style={{ padding: "6px" }}
              >
                {historyOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
              </button>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#064e3b" }}>
                    Trợ lý nông nghiệp Gemini
                  </h2>
                  <span className={`chat-status-pill ${statusClass}`}>
                    <span className={`status-dot ${statusClass}`} />
                    {statusLabel}
                  </span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Trợ lý AI hỗ trợ chăm sóc cây trồng dựa trên dữ liệu trang trại • Vai trò: <strong>{roleName}</strong>
                </p>
              </div>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              onClick={handleNewConversation}
            >
              <Plus size={15} /> Tạo cuộc trò chuyện mới
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="chat-messages-area">
            {loadingMessages ? (
              <div style={{ margin: "auto", textAlign: "center" }}>
                <LoadingSpinner text="Đang tải tin nhắn..." />
              </div>
            ) : messages.length === 0 ? (
              /* Welcome screen when no messages yet */
              <div className="chat-welcome-container">
                <div className="chat-welcome-avatar">
                  <Sprout size={34} />
                </div>
                <h1 className="chat-welcome-title">Xin chào, {user?.full_name || user?.username}!</h1>
                <p className="chat-welcome-subtitle">
                  Tôi là trợ lý nông nghiệp Gemini. Tôi có thể giúp bạn phân tích nhật ký, lập lịch chăm sóc và
                  theo dõi tình trạng các lô trồng. Bạn muốn bắt đầu từ đâu?
                </p>

                <div className="chat-suggestions-grid">
                  {quickCards.map((card, idx) => (
                    <div
                      key={idx}
                      className="chat-suggestion-card"
                      onClick={() => handleCardClick(card)}
                      title={card.desc}
                    >
                      <div className="chat-suggestion-card-title">
                        {card.icon}
                        <span>{card.title}</span>
                      </div>
                      <div className="chat-suggestion-card-desc">{card.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Render chat message rows */
              messages.map((msg) => {
                const isUser = msg.role === "user";
                const isExpanded = expandedRefs.has(msg.id);
                const hasRefs = msg.references_data && (
                  msg.references_data.lot ||
                  (msg.references_data.care_logs && msg.references_data.care_logs.length > 0) ||
                  (msg.references_data.materials && msg.references_data.materials.length > 0) ||
                  (msg.references_data.articles && msg.references_data.articles.length > 0)
                );

                return (
                  <div key={msg.id} className={`chat-message-row ${isUser ? "user" : "assistant"}`}>
                    <div className={`chat-avatar ${isUser ? "user" : "assistant"}`}>
                      {isUser ? <UserIcon size={18} /> : <Bot size={20} />}
                    </div>

                    <div style={{ maxWidth: "100%", flex: 1 }}>
                      <div className={`chat-bubble ${isUser ? "user" : "assistant"}`}>
                        {isUser ? (
                          <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                        ) : (
                          <>
                            <FormattedMessage text={msg.content} />

                            {/* Reference Data Accordion (PostgreSQL Grounded Sources) */}
                            {hasRefs && (
                              <div className="chat-references-box">
                                <button
                                  className="chat-references-trigger"
                                  onClick={() => toggleRefAccordion(msg.id)}
                                >
                                  <Database size={13} />
                                  <span>Dữ liệu tham chiếu hệ thống</span>
                                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>

                                {isExpanded && (
                                  <div className="chat-references-panel">
                                    {/* Lot reference */}
                                    {msg.references_data.lot && (
                                      <div className="chat-ref-section">
                                        <div className="chat-ref-header">
                                          <Sprout size={13} color="#059669" /> Lô trồng:
                                        </div>
                                        <div style={{ paddingLeft: "18px", color: "var(--text-muted)" }}>
                                          Mã <strong>{msg.references_data.lot.code}</strong> — {msg.references_data.lot.name} ({msg.references_data.lot.variety}) • Trạng thái: {msg.references_data.lot.status} • Ngày gieo: {msg.references_data.lot.planting_date}
                                        </div>
                                      </div>
                                    )}

                                    {/* Care logs */}
                                    {msg.references_data.care_logs && msg.references_data.care_logs.length > 0 && (
                                      <div className="chat-ref-section">
                                        <div className="chat-ref-header">
                                          <FileText size={13} color="#0284c7" /> Nhật ký chăm sóc ({msg.references_data.care_logs.length} bản ghi):
                                        </div>
                                        <ul style={{ paddingLeft: "26px", color: "var(--text-muted)" }}>
                                          {msg.references_data.care_logs.slice(0, 4).map((cl, i) => (
                                            <li key={i}>
                                              {cl.occurred_at}: [{cl.activity}] {cl.note} {cl.observation ? `— Quan sát: ${cl.observation}` : ""}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Materials */}
                                    {msg.references_data.materials && msg.references_data.materials.length > 0 && (
                                      <div className="chat-ref-section">
                                        <div className="chat-ref-header">
                                          <Package size={13} color="#7c3aed" /> Tình trạng kho vật tư:
                                        </div>
                                        <ul style={{ paddingLeft: "26px", color: "var(--text-muted)" }}>
                                          {msg.references_data.materials.slice(0, 4).map((m, i) => (
                                            <li key={i}>
                                              {m.name}: Tồn {m.quantity} {m.unit} {m.is_low_stock ? "⚠️ (CẢNH BÁO TỒN THẤP)" : ""}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Articles */}
                                    {msg.references_data.articles && msg.references_data.articles.length > 0 && (
                                      <div className="chat-ref-section">
                                        <div className="chat-ref-header">
                                          <CheckCircle2 size={13} color="#16a34a" /> Tài liệu kho tri thức RAG:
                                        </div>
                                        <ul style={{ paddingLeft: "26px", color: "var(--text-muted)" }}>
                                          {msg.references_data.articles.map((art, i) => (
                                            <li key={i}>
                                              <strong>{art.title}</strong> ({art.category}) — {art.is_verified ? "Đã kiểm chứng" : "Chưa kiểm chứng"}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Meta & Action Bar */}
                      <div className="chat-meta-bar">
                        <span>{msg.time_display}</span>
                        {!isUser && msg.model_name && (
                          <span>• {msg.model_name} ({msg.latency_ms} ms)</span>
                        )}

                        {!isUser && (
                          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                            {/* Copy button */}
                            <button
                              className="chat-icon-btn"
                              onClick={() => handleCopyText(msg.id, msg.content)}
                              title="Sao chép nội dung câu trả lời"
                            >
                              {copiedMsgId === msg.id ? (
                                <Check size={14} style={{ color: "#16a34a" }} />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>

                            {/* Helpful button */}
                            <button
                              className={`chat-icon-btn ${msg.feedback?.rating === 1 ? "active" : ""}`}
                              onClick={() => handleFeedback(msg.id, 1)}
                              title="Đánh giá hữu ích"
                              style={{ color: msg.feedback?.rating === 1 ? "#16a34a" : undefined }}
                            >
                              <ThumbsUp size={14} />
                            </button>

                            {/* Not helpful button */}
                            <button
                              className={`chat-icon-btn ${msg.feedback?.rating === -1 ? "active" : ""}`}
                              onClick={() => handleFeedback(msg.id, -1)}
                              title="Đánh giá chưa hữu ích"
                              style={{ color: msg.feedback?.rating === -1 ? "#dc2626" : undefined }}
                            >
                              <ThumbsDown size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Thinking Indicator */}
            {sending && (
              <div className="chat-message-row assistant">
                <div className="chat-avatar assistant">
                  <Bot size={20} />
                </div>
                <div className="chat-thinking-bubble">
                  <div className="chat-typing-dots">
                    <span className="chat-typing-dot" />
                    <span className="chat-typing-dot" />
                    <span className="chat-typing-dot" />
                  </div>
                  <span>Gemini đang tra cứu dữ liệu trang trại & suy nghĩ câu trả lời...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Context Selector & Input Pane */}
          <div className="chat-input-pane">
            {/* Context Selector Bar (Requirement 2.F) */}
            <div className="chat-context-bar">
              <div className="chat-context-lot-selector">
                <Layers size={14} color="#059669" />
                <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>Ngữ cảnh lô:</span>
                <select
                  value={selectedLotId}
                  onChange={(e) => setSelectedLotId(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: "0.82rem",
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <option value="">Tự động theo câu hỏi</option>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} - {l.name} ({l.variety_name || l.variety?.name}) [{l.status_display || l.status}]
                    </option>
                  ))}
                </select>

                {selectedLotObj && (
                  <span className="chat-context-chip">
                    <span>{selectedLotObj.variety_name || selectedLotObj.variety?.name}</span>
                    <span>• {selectedLotObj.status_display || selectedLotObj.status}</span>
                    {selectedLotObj.planting_date && (
                      <span>• Gieo: {selectedLotObj.planting_date}</span>
                    )}
                    <button
                      onClick={() => setSelectedLotId("")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", color: "#065f46" }}
                      title="Bỏ chọn lô"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </div>

              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                Nhấn <strong>Enter</strong> để gửi, <strong>Shift + Enter</strong> để xuống dòng
              </div>
            </div>

            {/* Input Form */}
            <form
              className="chat-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <textarea
                ref={textareaRef}
                rows={1}
                className="chat-textarea"
                placeholder="Hỏi về cây trồng, lịch chăm sóc, vật tư hoặc thu hoạch..."
                value={inputText}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                disabled={sending}
              />

              <button
                type="submit"
                className="chat-send-btn"
                disabled={!inputText.trim() || sending}
                title="Gửi câu hỏi"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );

  // Render individual conversation row in sidebar
  function renderConvItem(conv) {
    const isActive = conv.id === activeConvId;
    const isEditing = editingConvId === conv.id;

    return (
      <div
        key={conv.id}
        className={`chat-history-item ${isActive ? "active" : ""}`}
        onClick={() => selectConversation(conv.id)}
      >
        <div className="chat-history-item-content">
          {isEditing ? (
            <input
              type="text"
              value={editingTitle}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={() => saveRename(conv.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename(conv.id);
                if (e.key === "Escape") setEditingConvId(null);
              }}
              style={{
                width: "100%",
                padding: "2px 6px",
                fontSize: "0.85rem",
                borderRadius: "4px",
                border: "1px solid var(--primary)",
              }}
            />
          ) : (
            <>
              <div className="chat-history-item-title">{conv.title}</div>
              <div className="chat-history-item-meta">
                <span>{conv.date_display}</span>
                {conv.crop_lot && (
                  <span style={{ color: "#059669", fontWeight: 600 }}>• {conv.crop_lot.code}</span>
                )}
              </div>
            </>
          )}
        </div>

        {!isEditing && (
          <div className="chat-history-item-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="chat-icon-btn"
              onClick={() => startRename(conv)}
              title="Đổi tên cuộc trò chuyện"
            >
              <Edit2 size={13} />
            </button>
            <button
              className="chat-icon-btn danger"
              onClick={(e) => handleDeleteConversation(conv.id, e)}
              title="Xóa cuộc trò chuyện"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    );
  }
}
