import React, { useState, useEffect } from "react";
import { Sparkles, Send, ThumbsUp, ThumbsDown, BookOpen, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { aiService } from "../services/aiService";
import { farmService } from "../services/farmService";
import { Alert } from "../components/Alert";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";

export function AIAssistantPage() {
  const { user } = useAuth();
  const [meta, setMeta] = useState(null);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedTask, setSelectedTask] = useState("summary");
  const [selectedLotId, setSelectedLotId] = useState("");
  const [question, setQuestion] = useState("");

  const [generating, setGenerating] = useState(false);
  const [latestResult, setLatestResult] = useState(null);
  const [latestInteraction, setLatestInteraction] = useState(null);
  const [alert, setAlert] = useState({ type: "", message: "" });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metaData, lotsData] = await Promise.all([
        aiService.getMeta(),
        farmService.getLots(),
      ]);
      setMeta(metaData);
      setLots(lotsData);
      if (metaData?.tasks?.length > 0) {
        setSelectedTask(metaData.tasks[0].value);
      }
      if (lotsData.length > 0) {
        setSelectedLotId(lotsData[0].id.toString());
      }
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi tải cấu hình AI." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setAlert({ type: "", message: "" });
    try {
      const res = await aiService.generateAdvice({
        task: selectedTask,
        lot_id: selectedLotId,
        question: question,
      });
      setLatestResult(res.result);
      setLatestInteraction(res.interaction);
      if (res.result?.ok) {
        setAlert({ type: "success", message: "Đã nhận kết quả tư vấn AI! Vui lòng đối chiếu với chuyên gia trước khi áp dụng." });
      } else {
        setAlert({ type: "warning", message: res.result?.text || "Chưa thể gọi Gemini AI." });
      }
      // Refresh meta for recent list
      const updatedMeta = await aiService.getMeta();
      setMeta(updatedMeta);
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi gọi AI Gemini." });
    } finally {
      setGenerating(false);
    }
  };

  const handleFeedback = async (id, feedbackType) => {
    try {
      await aiService.submitFeedback(id, feedbackType);
      setAlert({ type: "success", message: "Cảm ơn bạn đã gửi phản hồi đánh giá AI!" });
      const updatedMeta = await aiService.getMeta();
      setMeta(updatedMeta);
      if (latestInteraction && latestInteraction.id === id) {
        setLatestInteraction({ ...latestInteraction, feedback: feedbackType });
      }
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi gửi phản hồi." });
    }
  };

  return (
    <div>
      {alert.message && (
        <Alert variant={alert.type} message={alert.message} onClose={() => setAlert({ type: "", message: "" })} />
      )}

      {loading ? (
        <LoadingSpinner text="Đang khởi tạo môi trường AI Gemini..." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>
          {/* AI Request Form */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
              <div style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}>
                <Sparkles size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>Trợ lý AI Nông nghiệp GreenFarm</h3>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Model: {meta?.gemini_model || "gemini-3.8-flash"} — Phiên bản prompt: {meta?.prompt_version}
                </span>
              </div>
            </div>

            <form onSubmit={handleGenerate}>
              <div className="form-group">
                <label className="form-label">Chọn tác vụ tư vấn AI (*)</label>
                <select
                  className="form-control"
                  value={selectedTask}
                  onChange={(e) => setSelectedTask(e.target.value)}
                  required
                >
                  {meta?.tasks?.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {selectedTask !== "inspect" && (
                <div className="form-group">
                  <label className="form-label">Chọn lô trồng để lấy ngữ cảnh (*)</label>
                  <select
                    className="form-control"
                    value={selectedLotId}
                    onChange={(e) => setSelectedLotId(e.target.value)}
                    required
                  >
                    <option value="">Chọn lô...</option>
                    {lots.map((l) => (
                      <option key={l.id} value={l.id}>{l.code} - {l.name} ({l.variety_name})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Câu hỏi hoặc yêu cầu bổ sung (tùy chọn)</label>
                <textarea
                  className="form-control"
                  placeholder="VD: Cây có hiện tượng xoăn nhẹ đọt lá trên luống thứ 2, nên kiểm tra yếu tố nào?..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  style={{ minHeight: "100px" }}
                />
              </div>

              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.78rem", color: "#64748b", marginBottom: "18px" }}>
                <strong>Cơ chế RAG:</strong> Hệ thống tự động truy xuất dữ liệu lô, nhật ký gần nhất và tài liệu kỹ thuật trong kho tri thức PostgreSQL để truyền làm ngữ cảnh cho Gemini.
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "12px" }}
                disabled={generating}
              >
                {generating ? "Gemini đang suy nghĩ & phân tích..." : "Gửi yêu cầu tới AI"}
                {!generating && <Send size={16} />}
              </button>
            </form>

            {/* Output Display */}
            {latestResult && (
              <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontWeight: 700, color: "#065f46" }}>Kết quả phản hồi:</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Thời gian: {latestResult.latency_ms} ms
                  </span>
                </div>

                <div className="ai-output-card">
                  {latestResult.text}
                </div>

                {latestResult.sources?.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>
                      Tài liệu tri thức tham khảo (RAG):
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {latestResult.sources.map((src, i) => (
                        <span key={i} className="badge badge-info" style={{ fontSize: "0.75rem" }}>
                          <BookOpen size={12} /> {src}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {latestInteraction && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px", paddingTop: "12px", borderTop: "1px dashed #e2e8f0" }}>
                    <span style={{ fontSize: "0.82rem", color: "#64748b" }}>Kết quả này có hữu ích không?</span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className={`btn btn-sm ${latestInteraction.feedback === "helpful" ? "btn-primary" : "btn-secondary"}`}
                        onClick={() => handleFeedback(latestInteraction.id, "helpful")}
                      >
                        <ThumbsUp size={14} /> Hữu ích
                      </button>
                      <button
                        className={`btn btn-sm ${latestInteraction.feedback === "not_helpful" ? "btn-danger" : "btn-secondary"}`}
                        onClick={() => handleFeedback(latestInteraction.id, "not_helpful")}
                      >
                        <ThumbsDown size={14} /> Chưa đúng
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History / Recent interactions */}
          <div className="card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>Lịch sử tương tác AI gần đây</h3>
            {meta?.recent?.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Chưa có phiên tương tác AI nào.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "700px", overflowY: "auto" }}>
                {meta?.recent?.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "12px 14px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      fontSize: "0.82rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, color: "#065f46" }}>{item.task_display}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.created_at}</span>
                    </div>
                    {item.lot_code && (
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                        Lô: <strong>{item.lot_code}</strong>
                      </div>
                    )}
                    {item.user_question && (
                      <div style={{ fontStyle: "italic", color: "#334155", margin: "4px 0" }}>
                        "{item.user_question.length > 80 ? `${item.user_question.slice(0, 80)}...` : item.user_question}"
                      </div>
                    )}
                    <div style={{
                      maxHeight: "80px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "#475569",
                      marginTop: "6px",
                      background: "white",
                      padding: "8px",
                      borderRadius: "6px",
                      border: "1px solid #e2e8f0",
                    }}>
                      {item.output_text}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", fontSize: "0.72rem", color: "#94a3b8" }}>
                      <span>Người gọi: {item.user}</span>
                      <span>Độ trễ: {item.latency_ms} ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
