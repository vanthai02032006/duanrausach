import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, Edit, Trash2, Calendar, MapPin } from "lucide-react";
import { farmService } from "../services/farmService";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import { LOT_STATUS_CHOICES } from "../utils/constants";

export function LotsPage() {
  const { user } = useAuth();
  const isManagerOrTech = user?.role === "Manager" || user?.role === "Technician" || user?.role === "Superuser";
  const isManager = user?.role === "Manager" || user?.role === "Superuser";

  const [lots, setLots] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [varietyFilter, setVarietyFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    variety_id: "",
    area_m2: "",
    planting_date: "",
    expected_harvest_date: "",
    status: "planned",
    notes: "",
  });

  const [alert, setAlert] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchLots = async () => {
    setLoading(true);
    try {
      const [lotsData, varietiesData] = await Promise.all([
        farmService.getLots({ q: search, status: statusFilter, variety: varietyFilter }),
        farmService.getVarieties(),
      ]);
      setLots(lotsData);
      setVarieties(varietiesData);
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi tải danh sách lô trồng." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLots();
  }, [search, statusFilter, varietyFilter]);

  const handleOpenCreate = () => {
    setEditingLot(null);
    setFormData({
      code: `LOT-${Date.now().toString().slice(-4)}`,
      name: "",
      variety_id: varieties[0]?.id || "",
      area_m2: "200",
      planting_date: new Date().toISOString().split("T")[0],
      expected_harvest_date: "",
      status: "planned",
      notes: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (lot) => {
    setEditingLot(lot);
    setFormData({
      code: lot.code,
      name: lot.name,
      variety_id: lot.variety_id,
      area_m2: lot.area_m2,
      planting_date: lot.planting_date,
      expected_harvest_date: lot.expected_harvest_date || "",
      status: lot.status,
      notes: lot.notes || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingLot) {
        await farmService.updateLot(editingLot.id, formData);
        setAlert({ type: "success", message: "Đã cập nhật lô trồng thành công!" });
      } else {
        await farmService.createLot(formData);
        setAlert({ type: "success", message: "Đã thêm lô trồng mới thành công!" });
      }
      setModalOpen(false);
      fetchLots();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi lưu lô trồng." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (lot) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lô "${lot.code} - ${lot.name}"?`)) return;
    try {
      await farmService.deleteLot(lot.id);
      setAlert({ type: "success", message: "Đã xóa lô trồng thành công." });
      fetchLots();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi xóa lô trồng." });
    }
  };

  return (
    <div>
      {alert.message && (
        <Alert variant={alert.type} message={alert.message} onClose={() => setAlert({ type: "", message: "" })} />
      )}

      {/* Action Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", flex: 1 }}>
          <div style={{ position: "relative", minWidth: "240px" }}>
            <input
              type="text"
              className="form-control"
              placeholder="Tìm theo mã lô, tên hoặc giống..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "34px" }}
            />
            <Search size={16} style={{ position: "absolute", left: "11px", top: "11px", color: "#94a3b8" }} />
          </div>

          <select className="form-control" style={{ width: "auto" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {LOT_STATUS_CHOICES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select className="form-control" style={{ width: "auto" }} value={varietyFilter} onChange={(e) => setVarietyFilter(e.target.value)}>
            <option value="">Tất cả giống cây</option>
            {varieties.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        {isManagerOrTech && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} />
            Thêm lô trồng mới
          </button>
        )}
      </div>

      {/* Content Table */}
      {loading ? (
        <LoadingSpinner text="Đang tải danh sách lô trồng..." />
      ) : lots.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
          <p>Không tìm thấy lô trồng nào phù hợp với bộ lọc.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Mã lô</th>
                <th>Tên lô & Giống cây</th>
                <th>Diện tích</th>
                <th>Ngày gieo</th>
                <th>Dự kiến thu hoạch</th>
                <th>Trạng thái</th>
                {isManagerOrTech && <th style={{ textAlign: "right" }}>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id}>
                  <td><strong>{lot.code}</strong></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{lot.name}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{lot.variety_name}</div>
                  </td>
                  <td>{lot.area_m2} m²</td>
                  <td>{lot.planting_date}</td>
                  <td>{lot.expected_harvest_date || "—"}</td>
                  <td>
                    <Badge
                      variant={
                        lot.status === "ready"
                          ? "warning"
                          : lot.status === "growing"
                          ? "info"
                          : lot.status === "harvested"
                          ? "success"
                          : "neutral"
                      }
                    >
                      {lot.status_display}
                    </Badge>
                  </td>
                  {isManagerOrTech && (
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(lot)} title="Chỉnh sửa">
                          <Edit size={14} />
                        </button>
                        {isManager && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(lot)} title="Xóa lô" style={{ color: "#dc2626" }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add / Edit */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingLot ? `Chỉnh sửa lô ${editingLot.code}` : "Thêm lô trồng mới"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Đang lưu..." : editingLot ? "Cập nhật thay đổi" : "Lưu lô trồng"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Mã lô (*)</label>
              <input
                type="text"
                className="form-control"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
                disabled={!!editingLot}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tên lô (*)</label>
              <input
                type="text"
                className="form-control"
                placeholder="VD: Lô rau xà lách thủy canh 1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Giống cây trồng (*)</label>
              <select
                className="form-control"
                value={formData.variety_id}
                onChange={(e) => setFormData({ ...formData, variety_id: e.target.value })}
                required
              >
                <option value="">Chọn giống cây...</option>
                {varieties.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.expected_days} ngày)</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Diện tích (m²) (*)</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                className="form-control"
                value={formData.area_m2}
                onChange={(e) => setFormData({ ...formData, area_m2: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Ngày gieo trồng (*)</label>
              <input
                type="date"
                className="form-control"
                value={formData.planting_date}
                onChange={(e) => setFormData({ ...formData, planting_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ngày thu hoạch dự kiến</label>
              <input
                type="date"
                className="form-control"
                value={formData.expected_harvest_date}
                onChange={(e) => setFormData({ ...formData, expected_harvest_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Trạng thái</label>
              <select
                className="form-control"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                {LOT_STATUS_CHOICES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ghi chú canh tác</label>
            <textarea
              className="form-control"
              placeholder="Ghi chú về phân bón lót, hệ thống tưới hoặc vị trí lô..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
