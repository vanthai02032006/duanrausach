import React, { useState, useEffect } from "react";
import { Plus, Search, Calendar, CheckCircle2, Clock, Edit, Trash2 } from "lucide-react";
import { farmService } from "../services/farmService";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import { CARE_ACTIVITY_CHOICES, CARE_STATUS_CHOICES } from "../utils/constants";

export function CareLogsPage() {
  const { user } = useAuth();
  const isManager = user?.role === "Manager" || user?.role === "Superuser";

  const [logs, setLogs] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [lotFilter, setLotFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    lot_id: "",
    activity: "water",
    occurred_at: "",
    status: "done",
    note: "",
    observation: "",
  });

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
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi tải nhật ký chăm sóc." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search, statusFilter, lotFilter]);

  const handleOpenCreate = () => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await farmService.updateCareLog(editing.id, formData);
        setAlert({ type: "success", message: "Đã cập nhật nhật ký thành công!" });
      } else {
        await farmService.createCareLog(formData);
        setAlert({ type: "success", message: "Đã lưu nhật ký chăm sóc mới!" });
      }
      setModalOpen(false);
      fetchLogs();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi lưu nhật ký chăm sóc." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (log) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa nhật ký này?")) return;
    try {
      await farmService.deleteCareLog(log.id);
      setAlert({ type: "success", message: "Đã xóa nhật ký chăm sóc." });
      fetchLogs();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi xóa nhật ký." });
    }
  };

  return (
    <div>
      {alert.message && (
        <Alert variant={alert.type} message={alert.message} onClose={() => setAlert({ type: "", message: "" })} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1 }}>
          <div style={{ position: "relative", minWidth: "220px" }}>
            <input
              type="text"
              className="form-control"
              placeholder="Tìm theo lô, nội dung ghi chú..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "34px" }}
            />
            <Search size={16} style={{ position: "absolute", left: "11px", top: "11px", color: "#94a3b8" }} />
          </div>

          <select className="form-control" style={{ width: "auto" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {CARE_STATUS_CHOICES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select className="form-control" style={{ width: "auto" }} value={lotFilter} onChange={(e) => setLotFilter(e.target.value)}>
            <option value="">Tất cả lô trồng</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
            ))}
          </select>
        </div>

        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={18} />
          Ghi nhật ký mới
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Đang tải nhật ký chăm sóc..." />
      ) : logs.length === 0 ? (
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
              {logs.map((log) => {
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
                      <Badge variant={log.status === "done" ? "success" : log.status === "in_progress" ? "info" : "warning"}>
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

      {/* Modal Add / Edit */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Chỉnh sửa nhật ký chăm sóc" : "Ghi nhật ký chăm sóc mới"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Đang lưu..." : editing ? "Cập nhật thay đổi" : "Lưu nhật ký"}
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
              <label className="form-label">Thời điểm thực hiện</label>
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
            <label className="form-label">Quan sát thực tế (lá, rễ, sâu bệnh...)</label>
            <textarea
              className="form-control"
              placeholder="VD: Cây phát triển đồng đều, lá xanh mướt, không thấy rệp..."
              value={formData.observation}
              onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
