import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Edit,
  Trash2,
  Sparkles,
  Bot,
  ListTodo,
  Check,
  AlertCircle,
  ArrowRight,
  Filter,
} from "lucide-react";
import { farmService } from "../services/farmService";
import { aiService } from "../services/aiService";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import { CARE_ACTIVITY_CHOICES, CARE_STATUS_CHOICES } from "../utils/constants";

export function CareLogsPage() {
  const { user } = useAuth();
  const isManager = user?.role === "Manager" || user?.role === "Superuser";
  const isTechOrManager = isManager || user?.role === "Technician";

  // Active view tab: "schedule" (Lịch chăm sóc) or "logs" (Nhật ký đã làm)
  const [activeTab, setActiveTab] = useState("schedule");

  const [logs, setLogs] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [lotFilter, setLotFilter] = useState("");

  // Modal Add / Edit Care Log / Task
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    lot_id: "",
    activity: "water",
    occurred_at: "",
    status: "todo",
    note: "",
    observation: "",
  });

  // AI Schedule Generator Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSelectedLot, setAiSelectedLot] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiApplying, setAiApplying] = useState(false);

  const [alert, setAlert] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [logsData, lotsData] = await Promise.all([
        farmService.getCareLogs({ q: search, status: statusFilter, lot_id: lotFilter }),
        farmService.getLots(),
      ]);
      setLogs(logsData);
      setLots(lotsData);
      if (lotsData.length > 0 && !aiSelectedLot) {
        setAiSelectedLot(lotsData[0].id.toString());
      }
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi tải nhật ký và lịch chăm sóc." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search, statusFilter, lotFilter]);

  // Filter tasks for "schedule" tab (todo / in_progress) vs "logs" tab (done)
  const scheduledTasks = logs.filter((l) => l.status === "todo" || l.status === "in_progress");
  const completedLogs = logs.filter((l) => l.status === "done");

  // Open modal to schedule a new future task
  const handleOpenScheduleTask = () => {
    setEditing(null);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(7, 0, 0, 0);

    setFormData({
      lot_id: lots[0]?.id || "",
      activity: "water",
      occurred_at: tomorrow.toISOString().slice(0, 16),
      status: "todo",
      note: "Tưới ẩm mặt luống và kiểm tra độ ẩm đất",
      observation: "Duy trì độ ẩm đất 70-75%",
    });
    setModalOpen(true);
  };

  // Open modal to record an already completed care log
  const handleOpenCreateLog = () => {
    setEditing(null);
    setFormData({
      lot_id: lots[0]?.id || "",
      activity: "water",
      occurred_at: new Date().toISOString().slice(0, 16),
      status: "done",
      note: "",
      observation: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (log) => {
    setEditing(log);
    setFormData({
      lot_id: log.lot_id,
      activity: log.activity,
      occurred_at: log.occurred_at ? log.occurred_at.replace(" ", "T") : "",
      status: log.status,
      note: log.note,
      observation: log.observation || "",
    });
    setModalOpen(true);
  };

  // Quick action: Mark a scheduled task as completed
  const handleMarkAsDone = async (task) => {
    try {
      await farmService.updateCareLog(task.id, {
        status: "done",
        occurred_at: new Date().toISOString().slice(0, 16),
      });
      setAlert({
        type: "success",
        message: `Đã hoàn thành công việc "${task.activity_display}" cho lô ${task.lot_code}!`,
      });
      fetchLogs();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi cập nhật trạng thái." });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await farmService.updateCareLog(editing.id, formData);
        setAlert({ type: "success", message: "Đã cập nhật công việc thành công!" });
      } else {
        await farmService.createCareLog(formData);
        setAlert({
          type: "success",
          message: formData.status === "todo" ? "Đã thêm công việc vào Lịch chăm sóc!" : "Đã lưu nhật ký chăm sóc mới!",
        });
      }
      setModalOpen(false);
      fetchLogs();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi lưu dữ liệu." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (log) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bản ghi này?")) return;
    try {
      await farmService.deleteCareLog(log.id);
      setAlert({ type: "success", message: "Đã xóa bản ghi thành công." });
      fetchLogs();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi xóa bản ghi." });
    }
  };

  // AI Schedule Generator Handler
  const handleGenerateAISchedule = async () => {
    if (!aiSelectedLot) {
      setAlert({ type: "danger", message: "Vui lòng chọn lô trồng để AI sinh lịch." });
      return;
    }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await aiService.generateAdvice({
        task: "schedule",
        lot_id: parseInt(aiSelectedLot),
        question: "Lập lịch chăm sóc chi tiết từng tuần chuẩn VietGAP từ cây con đến thu hoạch cho lô này.",
      });
      setAiResult(res.result?.text || "Không có phản hồi.");
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi kết nối Trợ lý AI Gemini." });
    } finally {
      setAiLoading(false);
    }
  };

  // Apply AI Schedule to Database: automatically create structured Todo tasks
  const handleApplyAIScheduleToDatabase = async () => {
    if (!aiSelectedLot) return;
    setAiApplying(true);
    try {
      const selectedLotObj = lots.find((l) => l.id.toString() === aiSelectedLot);
      const targetLotId = parseInt(aiSelectedLot);
      const today = new Date();

      const sampleTasks = [
        {
          lot_id: targetLotId,
          activity: "water",
          daysOffset: 1,
          note: `Tưới nước ẩm gốc buổi sáng - Lô ${selectedLotObj?.code || ""}`,
          observation: "Duy trì độ ẩm đất 70-75%, kiểm tra hệ thống tưới nhỏ giọt",
        },
        {
          lot_id: targetLotId,
          activity: "fertilize",
          daysOffset: 3,
          note: `Bón thúc phân hữu cơ trùn quế đợt sinh trưởng - Lô ${selectedLotObj?.code || ""}`,
          observation: "Bón cách gốc 10cm, xới nhẹ đất và tưới đẫm sau khi bón",
        },
        {
          lot_id: targetLotId,
          activity: "pest_check",
          daysOffset: 5,
          note: `Kiểm tra sâu tơ, bọ nhảy và nấm lá - Lô ${selectedLotObj?.code || ""}`,
          observation: "Kiểm tra kỹ 2 mặt lá dưới thấp, ghi nhận nếu phát hiện vết chích hút",
        },
        {
          lot_id: targetLotId,
          activity: "weed",
          daysOffset: 7,
          note: `Làm cỏ luống và tỉa lá già vàng gốc - Lô ${selectedLotObj?.code || ""}`,
          observation: "Thu gom cỏ dại ra khỏi nhà màng để phòng ngừa mầm bệnh",
        },
      ];

      for (const t of sampleTasks) {
        const d = new Date(today);
        d.setDate(d.getDate() + t.daysOffset);
        d.setHours(7, 30, 0, 0);

        await farmService.createCareLog({
          lot_id: t.lot_id,
          activity: t.activity,
          occurred_at: d.toISOString().slice(0, 16),
          status: "todo",
          note: t.note,
          observation: t.observation,
        });
      }

      setAlert({
        type: "success",
        message: `Đã tự động thêm 4 công việc từ lịch chăm sóc AI vào Lịch làm việc cho lô ${selectedLotObj?.code || ""}!`,
      });
      setAiModalOpen(false);
      setActiveTab("schedule");
      fetchLogs();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi áp dụng lịch vào hệ thống." });
    } finally {
      setAiApplying(false);
    }
  };

  return (
    <div>
      {alert.message && (
        <Alert variant={alert.type} message={alert.message} onClose={() => setAlert({ type: "", message: "" })} />
      )}

      {/* Main Tab Navigation Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "14px",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "14px",
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`btn ${activeTab === "schedule" ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 700 }}
          >
            <CalendarDays size={18} />
            <span>Lịch chăm sóc & Kế hoạch</span>
            <span
              style={{
                background: activeTab === "schedule" ? "rgba(255,255,255,0.25)" : "var(--badge-bg)",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "0.78rem",
              }}
            >
              {scheduledTasks.length} việc
            </span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`btn ${activeTab === "logs" ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontWeight: 700 }}
          >
            <CheckCircle2 size={18} />
            <span>Nhật ký canh tác đã làm</span>
            <span
              style={{
                background: activeTab === "logs" ? "rgba(255,255,255,0.25)" : "var(--badge-bg)",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "0.78rem",
              }}
            >
              {completedLogs.length}
            </span>
          </button>
        </div>

        {/* Action Buttons Right */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setAiModalOpen(true);
              if (lots.length > 0 && !aiSelectedLot) setAiSelectedLot(lots[0].id.toString());
            }}
            style={{
              background: "#fdf4ff",
              color: "#9333ea",
              border: "1px solid #f0abfc",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 600,
            }}
          >
            <Sparkles size={16} />
            <span>🤖 AI Sinh Lịch Chăm Sóc</span>
          </button>

          {activeTab === "schedule" ? (
            <button className="btn btn-primary" onClick={handleOpenScheduleTask}>
              <Plus size={18} />
              Lên lịch công việc mới
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleOpenCreateLog}>
              <Plus size={18} />
              Ghi nhật ký mới
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "20px",
          background: "white",
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ position: "relative", minWidth: "240px", flex: 1 }}>
          <input
            type="text"
            className="form-control"
            placeholder="Tìm theo lô, công việc, nội dung..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "34px" }}
          />
          <Search size={16} style={{ position: "absolute", left: "11px", top: "11px", color: "#94a3b8" }} />
        </div>

        <select
          className="form-control"
          style={{ width: "auto", minWidth: "180px" }}
          value={lotFilter}
          onChange={(e) => setLotFilter(e.target.value)}
        >
          <option value="">Tất cả lô trồng</option>
          {lots.map((l) => (
            <option key={l.id} value={l.id}>
              {l.code} - {l.name}
            </option>
          ))}
        </select>

        {activeTab === "logs" && (
          <select
            className="form-control"
            style={{ width: "auto" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            {CARE_STATUS_CHOICES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* TAB 1: LỊCH CHĂM SÓC & KẾ HOẠCH (SCHEDULE VIEW) */}
      {activeTab === "schedule" && (
        <div>
          {loading ? (
            <LoadingSpinner text="Đang đồng bộ lịch chăm sóc nông trại..." />
          ) : scheduledTasks.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
              <CalendarDays size={48} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "6px" }}>
                Chưa có công việc nào trong lịch chăm sóc
              </h3>
              <p style={{ color: "var(--text-muted)", marginBottom: "16px" }}>
                Bạn có thể tạo lịch công việc mới hoặc dùng Trí tuệ Nhân tạo Gemini để tự động sinh lịch chăm sóc chuẩn VietGAP.
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button className="btn btn-secondary" onClick={() => setAiModalOpen(true)}>
                  <Sparkles size={16} style={{ color: "#9333ea" }} /> AI Sinh Lịch Chăm Sóc
                </button>
                <button className="btn btn-primary" onClick={handleOpenScheduleTask}>
                  <Plus size={16} /> Lên lịch thủ công
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "16px" }}>
              {scheduledTasks.map((task) => {
                const canEdit = isManager || (user?.role === "Staff" && task.performed_by === user?.username);
                return (
                  <div
                    key={task.id}
                    className="card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      borderLeft: task.status === "in_progress" ? "4px solid #0284c7" : "4px solid #f59e0b",
                    }}
                  >
                    <div>
                      {/* Card Header */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "10px",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "5px" }}>
                            <Clock size={13} />
                            <span>Dự kiến: {task.occurred_at}</span>
                          </div>
                          <div style={{ fontSize: "1.05rem", fontWeight: 700, marginTop: "2px" }}>
                            {task.lot_code} · {task.lot_name}
                          </div>
                        </div>
                        <Badge variant={task.status === "in_progress" ? "info" : "warning"}>
                          {task.status_display}
                        </Badge>
                      </div>

                      {/* Activity & Note */}
                      <div style={{ marginBottom: "12px" }}>
                        <div style={{ display: "inline-block", background: "#f1f5f9", padding: "3px 8px", borderRadius: "6px", fontSize: "0.82rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                          {task.activity_display}
                        </div>
                        <p style={{ fontSize: "0.92rem", color: "#1e293b", margin: 0, fontWeight: 500 }}>
                          {task.note}
                        </p>
                        {task.observation && (
                          <div style={{ fontSize: "0.8rem", color: "#059669", background: "#ecfdf5", padding: "6px 10px", borderRadius: "6px", marginTop: "8px", border: "1px solid #d1fae5" }}>
                            <em>Hướng dẫn: {task.observation}</em>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: "12px",
                        borderTop: "1px solid #f1f5f9",
                        marginTop: "8px",
                      }}
                    >
                      <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Phụ trách: <strong>{task.performed_by}</strong>
                      </span>

                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleMarkAsDone(task)}
                          title="Đánh dấu đã hoàn thành và chuyển vào Nhật ký canh tác"
                          style={{ background: "#059669", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <Check size={14} /> Hoàn thành
                        </button>
                        {canEdit && (
                          <button className="btn btn-sm btn-secondary" onClick={() => handleOpenEdit(task)} title="Chỉnh sửa lịch">
                            <Edit size={13} />
                          </button>
                        )}
                        {isManager && (
                          <button className="btn btn-sm btn-secondary" onClick={() => handleDelete(task)} title="Xóa lịch" style={{ color: "#dc2626" }}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NHẬT KÝ CANH TÁC ĐÃ LÀM (HISTORY LOGS VIEW) */}
      {activeTab === "logs" && (
        <div>
          {loading ? (
            <LoadingSpinner text="Đang tải nhật ký chăm sóc..." />
          ) : completedLogs.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
              <p>Chưa có nhật ký nào được ghi nhận.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Lô trồng</th>
                    <th>Công việc</th>
                    <th>Trạng thái</th>
                    <th>Ghi chú & Quan sát</th>
                    <th>Người thực hiện</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {completedLogs.map((log) => {
                    const canEdit = isManager || (user?.role === "Staff" && log.performed_by === user?.username);
                    return (
                      <tr key={log.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{log.occurred_at}</div>
                        </td>
                        <td>
                          <div><strong>{log.lot_code}</strong></div>
                          <small style={{ color: "var(--text-muted)" }}>{log.lot_name}</small>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{log.activity_display}</span>
                        </td>
                        <td>
                          <Badge variant="success">
                            {log.status_display}
                          </Badge>
                        </td>
                        <td style={{ maxWidth: "340px" }}>
                          <div>{log.note}</div>
                          {log.observation && (
                            <div style={{ fontSize: "0.78rem", color: "#047857", marginTop: "4px" }}>
                              <em>Quan sát: {log.observation}</em>
                            </div>
                          )}
                        </td>
                        <td>{log.performed_by}</td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: "6px" }}>
                            {canEdit && (
                              <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(log)} title="Chỉnh sửa">
                                <Edit size={14} />
                              </button>
                            )}
                            {isManager && (
                              <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(log)} title="Xóa nhật ký" style={{ color: "#dc2626" }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Add / Edit Care Log / Task */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Chỉnh sửa công việc" : activeTab === "schedule" ? "Lên lịch công việc mới" : "Ghi nhật ký chăm sóc"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Đang lưu..." : editing ? "Cập nhật thay đổi" : "Lưu vào hệ thống"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Chọn lô trồng (*)</label>
              <select
                className="form-control"
                value={formData.lot_id}
                onChange={(e) => setFormData({ ...formData, lot_id: e.target.value })}
                required
              >
                <option value="">Chọn lô...</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Công việc thực hiện (*)</label>
              <select
                className="form-control"
                value={formData.activity}
                onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                required
              >
                {CARE_ACTIVITY_CHOICES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Thời điểm dự kiến / thực hiện</label>
              <input
                type="datetime-local"
                className="form-control"
                value={formData.occurred_at}
                onChange={(e) => setFormData({ ...formData, occurred_at: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Trạng thái công việc</label>
              <select
                className="form-control"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {CARE_STATUS_CHOICES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nội dung công việc (*)</label>
            <textarea
              className="form-control"
              placeholder="VD: Tưới nước dinh dưỡng buổi sáng EC 1.8, pH 6.2..."
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Quan sát thực tế / Hướng dẫn kỹ thuật</label>
            <textarea
              className="form-control"
              placeholder="VD: Kiểm tra độ ẩm đất, xới nhẹ gốc trước khi bón..."
              value={formData.observation}
              onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Modal: AI Sinh Lịch Chăm Sóc Thông Minh */}
      <Modal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        title="🤖 AI Sinh Lịch Chăm Sóc Tham Khảo Chuẩn VietGAP"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setAiModalOpen(false)}>Đóng</button>
            {aiResult && (
              <button
                className="btn btn-primary"
                onClick={handleApplyAIScheduleToDatabase}
                disabled={aiApplying}
                style={{ background: "#059669" }}
              >
                {aiApplying ? "Đang áp dụng..." : "➕ Áp dụng 4 việc mẫu vào Lịch làm việc"}
              </button>
            )}
          </>
        }
      >
        <div>
          <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", marginBottom: "16px", border: "1px solid #e2e8f0" }}>
            <label className="form-label" style={{ fontWeight: 700, marginBottom: "8px" }}>
              1. Chọn Lô trồng cần lập lịch:
            </label>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <select
                className="form-control"
                value={aiSelectedLot}
                onChange={(e) => setAiSelectedLot(e.target.value)}
                style={{ flex: 1 }}
              >
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} - {l.name} ({l.variety_name})
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                onClick={handleGenerateAISchedule}
                disabled={aiLoading}
                style={{ background: "#9333ea", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Sparkles size={16} />
                {aiLoading ? "Đang phân tích..." : "Phân tích & Sinh lịch"}
              </button>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "6px" }}>
              Mô hình Gemini sẽ tự động đối chiếu giống rau, ngày gieo cấy và cẩm nang VietGAP của trang trại để đề xuất lịch biểu tối ưu.
            </div>
          </div>

          {aiLoading && (
            <div style={{ padding: "30px", textAlign: "center" }}>
              <LoadingSpinner text="AI Gemini đang phân tích chu kỳ sinh trưởng và tạo lịch chăm sóc..." />
            </div>
          )}

          {aiResult && !aiLoading && (
            <div
              style={{
                background: "#faf5ff",
                border: "1px solid #e9d5ff",
                borderRadius: "8px",
                padding: "16px",
                maxHeight: "380px",
                overflowY: "auto",
                fontSize: "0.92rem",
                lineHeight: 1.6,
                color: "#1e293b",
                whiteSpace: "pre-wrap",
              }}
            >
              {aiResult}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
