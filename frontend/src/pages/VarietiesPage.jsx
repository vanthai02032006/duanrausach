import React, { useState, useEffect } from "react";
import { Plus, Search, Flower2, Edit, Trash2 } from "lucide-react";
import { farmService } from "../services/farmService";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";

export function VarietiesPage() {
  const { user } = useAuth();
  const isManager = user?.role === "Manager" || user?.role === "Superuser";

  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    scientific_name: "",
    expected_days: 35,
    description: "",
    care_notes: "",
  });
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchVarieties = async () => {
    setLoading(true);
    try {
      const data = await farmService.getVarieties({ q: search });
      setVarieties(data);
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi tải danh sách giống cây." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVarieties();
  }, [search]);

  const handleOpenCreate = () => {
    setEditing(null);
    setFormData({
      name: "",
      scientific_name: "",
      expected_days: 35,
      description: "",
      care_notes: "",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (v) => {
    setEditing(v);
    setFormData({
      name: v.name,
      scientific_name: v.scientific_name || "",
      expected_days: v.expected_days,
      description: v.description || "",
      care_notes: v.care_notes || "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await farmService.updateVariety(editing.id, formData);
        setAlert({ type: "success", message: "Đã cập nhật giống cây thành công!" });
      } else {
        await farmService.createVariety(formData);
        setAlert({ type: "success", message: "Đã thêm giống cây mới thành công!" });
      }
      setModalOpen(false);
      fetchVarieties();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi lưu giống cây." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (v) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa giống cây "${v.name}"?`)) return;
    try {
      await farmService.deleteVariety(v.id);
      setAlert({ type: "success", message: "Đã xóa giống cây thành công." });
      fetchVarieties();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi xóa giống cây." });
    }
  };

  return (
    <div>
      {alert.message && (
        <Alert variant={alert.type} message={alert.message} onClose={() => setAlert({ type: "", message: "" })} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ position: "relative", minWidth: "260px" }}>
          <input
            type="text"
            className="form-control"
            placeholder="Tìm theo tên hoặc tên khoa học..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "34px" }}
          />
          <Search size={16} style={{ position: "absolute", left: "11px", top: "11px", color: "#94a3b8" }} />
        </div>

        {isManager && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} />
            Thêm giống cây mới
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner text="Đang tải danh sách giống cây..." />
      ) : varieties.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
          <p>Không có giống cây nào.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "18px" }}>
          {varieties.map((v) => (
            <div key={v.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Flower2 size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: "1rem", fontWeight: 700 }}>{v.name}</h4>
                      {v.scientific_name && (
                        <div style={{ fontStyle: "italic", fontSize: "0.8rem", color: "var(--text-muted)" }}>{v.scientific_name}</div>
                      )}
                    </div>
                  </div>
                  <span className="badge badge-info">{v.expected_days} ngày sinh trưởng</span>
                </div>
                {v.description && (
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "8px" }}>{v.description}</p>
                )}
                {v.care_notes && (
                  <div style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: "6px", fontSize: "0.8rem", color: "#334155", border: "1px solid #e2e8f0" }}>
                    <strong>Lưu ý:</strong> {v.care_notes}
                  </div>
                )}
              </div>

              {isManager && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "14px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(v)}>
                    <Edit size={14} /> Sửa
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(v)} style={{ color: "#dc2626" }}>
                    <Trash2 size={14} /> Xóa
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Add / Edit */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Chỉnh sửa giống ${editing.name}` : "Thêm giống cây mới"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Đang lưu..." : editing ? "Cập nhật thay đổi" : "Lưu giống cây"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tên giống cây (*)</label>
            <input
              type="text"
              className="form-control"
              placeholder="VD: Xà lách lolo xanh"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Tên khoa học</label>
              <input
                type="text"
                className="form-control"
                placeholder="VD: Lactuca sativa"
                value={formData.scientific_name}
                onChange={(e) => setFormData({ ...formData, scientific_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Số ngày sinh trưởng (*)</label>
              <input
                type="number"
                min="1"
                className="form-control"
                value={formData.expected_days}
                onChange={(e) => setFormData({ ...formData, expected_days: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả đặc điểm</label>
            <textarea
              className="form-control"
              placeholder="Đặc điểm hình thái, mùa vụ thích hợp..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ghi chú chăm sóc tiêu chuẩn</label>
            <textarea
              className="form-control"
              placeholder="Quy trình bón phân, tưới nước, lưu ý sâu bệnh thường gặp..."
              value={formData.care_notes}
              onChange={(e) => setFormData({ ...formData, care_notes: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
