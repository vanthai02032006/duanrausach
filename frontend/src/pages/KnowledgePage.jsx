import React, { useState, useEffect } from "react";
import { Plus, Search, BookOpen, CheckCircle, ShieldCheck, Edit, Trash2 } from "lucide-react";
import { farmService } from "../services/farmService";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";

export function KnowledgePage() {
  const { user } = useAuth();
  const isManager = user?.role === "Manager" || user?.role === "Superuser";

  const [articles, setArticles] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "general",
    variety_id: "",
    content: "",
    source: "",
    tags: "",
    is_active: true,
    is_verified: false,
  });

  const [alert, setAlert] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const [articlesData, varietiesData] = await Promise.all([
        farmService.getKnowledge({ q: search }),
        farmService.getVarieties(),
      ]);
      setArticles(articlesData);
      setVarieties(varietiesData);
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi tải kho tri thức." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [search]);

  const handleOpenCreate = () => {
    setEditing(null);
    setFormData({
      title: "",
      category: "general",
      variety_id: "",
      content: "",
      source: "",
      tags: "",
      is_active: true,
      is_verified: false,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (a) => {
    setEditing(a);
    setFormData({
      title: a.title,
      category: a.category,
      variety_id: a.variety_id || "",
      content: a.content,
      source: a.source || "",
      tags: a.tags || "",
      is_active: a.is_active,
      is_verified: a.is_verified,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await farmService.updateKnowledge(editing.id, formData);
        setAlert({ type: "success", message: "Đã cập nhật tài liệu tri thức thành công!" });
      } else {
        await farmService.createKnowledge(formData);
        setAlert({ type: "success", message: "Đã thêm tài liệu mới vào kho tri thức thành công!" });
      }
      setModalOpen(false);
      fetchArticles();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi lưu tài liệu." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (a) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài liệu "${a.title}"?`)) return;
    try {
      await farmService.deleteKnowledge(a.id);
      setAlert({ type: "success", message: "Đã xóa tài liệu khỏi kho tri thức." });
      fetchArticles();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi xóa tài liệu." });
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
            placeholder="Tìm theo tiêu đề, thẻ tags hoặc nội dung..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "34px" }}
          />
          <Search size={16} style={{ position: "absolute", left: "11px", top: "11px", color: "#94a3b8" }} />
        </div>

        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={18} />
          Thêm tài liệu tri thức mới
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Đang tải kho tri thức..." />
      ) : articles.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
          <p>Chưa có tài liệu tri thức nào trong kho.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "18px" }}>
          {articles.map((a) => (
            <div key={a.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <Badge variant={a.is_active ? "success" : "neutral"}>
                      {a.is_active ? "Đang bật" : "Tắt"}
                    </Badge>
                    {a.is_verified && (
                      <Badge variant="info">
                        <ShieldCheck size={12} /> Đã kiểm chứng
                      </Badge>
                    )}
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{a.created_at}</span>
                </div>

                <h4 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "6px 0", color: "#064e3b" }}>{a.title}</h4>
                {a.variety_name && (
                  <div style={{ fontSize: "0.78rem", color: "#047857", fontWeight: 600, marginBottom: "8px" }}>
                    Cây trồng: {a.variety_name}
                  </div>
                )}
                <p style={{
                  fontSize: "0.85rem",
                  color: "#334155",
                  lineHeight: "1.6",
                  maxHeight: "120px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  background: "#f8fafc",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}>
                  {a.content}
                </p>

                {a.source && (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "8px" }}>
                    Nguồn tài liệu: <em>{a.source}</em>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Bởi: {a.created_by}</span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(a)}>
                    <Edit size={14} /> Sửa
                  </button>
                  {isManager && (
                    <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(a)} style={{ color: "#dc2626" }}>
                      <Trash2 size={14} /> Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add / Edit */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Chỉnh sửa tài liệu tri thức" : "Thêm tài liệu tri thức mới"}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu tài liệu"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tiêu đề tài liệu (*)</label>
            <input
              type="text"
              className="form-control"
              placeholder="VD: Quy trình kiểm soát bọ nhảy trên rau cải"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Liên kết giống cây trồng (tùy chọn)</label>
              <select
                className="form-control"
                value={formData.variety_id}
                onChange={(e) => setFormData({ ...formData, variety_id: e.target.value })}
              >
                <option value="">Áp dụng chung tất cả</option>
                {varieties.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Nguồn trích dẫn</label>
              <input
                type="text"
                className="form-control"
                placeholder="VD: Viện Nghiên cứu Rau quả, TCVN..."
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nội dung tri thức chuẩn (*)</label>
            <textarea
              className="form-control"
              placeholder="Nhập nội dung kỹ thuật đầy đủ để làm tài liệu tham khảo cho AI..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              style={{ minHeight: "140px" }}
            />
          </div>

          <div style={{ display: "flex", gap: "20px", marginTop: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              />
              Bật dùng tài liệu này cho AI (RAG)
            </label>

            {isManager && (
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", cursor: "pointer", color: "#065f46", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={formData.is_verified}
                  onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
                />
                Xác nhận đã được chuyên gia kiểm chứng
              </label>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
