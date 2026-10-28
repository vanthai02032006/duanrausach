import React, { useState, useEffect } from "react";
import { Plus, Search, Wheat, QrCode } from "lucide-react";
import { farmService } from "../services/farmService";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import { formatKg } from "../utils/formatters";
import { HARVEST_GRADE_CHOICES } from "../utils/constants";

export function HarvestsPage({ setCurrentView, setTraceCodeToSearch }) {
  const { user } = useAuth();
  const isManagerOrTech = user?.role === "Manager" || user?.role === "Technician" || user?.role === "Superuser";

  const [harvests, setHarvests] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    lot_id: "",
    product_name: "",
    quantity_kg: "",
    quality_grade: "A",
    harvested_at: new Date().toISOString().split("T")[0],
    note: "",
  });

  const [alert, setAlert] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchHarvests = async () => {
    setLoading(true);
    try {
      const [harvestsData, lotsData] = await Promise.all([
        farmService.getHarvests({ q: search }),
        farmService.getLots(),
      ]);
      setHarvests(harvestsData);
      setLots(lotsData.filter((l) => l.status !== "harvested"));
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi tải danh sách thu hoạch." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHarvests();
  }, [search]);

  const handleOpenCreate = () => {
    const firstLot = lots[0];
    setFormData({
      lot_id: firstLot?.id || "",
      product_name: firstLot ? firstLot.name.replace("Lô ", "") : "Rau sạch",
      quantity_kg: "",
      quality_grade: "A",
      harvested_at: new Date().toISOString().split("T")[0],
      note: "",
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await farmService.createHarvest(formData);
      setAlert({ type: "success", message: `Đã lưu phiếu thu hoạch thành công! Mã truy xuất: ${res.trace_code}` });
      setModalOpen(false);
      fetchHarvests();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi lưu phiếu thu hoạch." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTraceClick = (code) => {
    if (setTraceCodeToSearch) {
      setTraceCodeToSearch(code);
    }
    setCurrentView("trace");
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
            placeholder="Tìm theo mã truy xuất, mã lô, sản phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: "34px" }}
          />
          <Search size={16} style={{ position: "absolute", left: "11px", top: "11px", color: "#94a3b8" }} />
        </div>

        {isManagerOrTech && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} />
            Ghi nhận thu hoạch mới
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner text="Đang tải danh sách thu hoạch..." />
      ) : harvests.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
          <p>Chưa có dữ liệu thu hoạch nào.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Mã truy xuất (Trace)</th>
                <th>Lô thu hoạch</th>
                <th>Sản phẩm</th>
                <th>Sản lượng</th>
                <th>Phân loại</th>
                <th>Ngày thu hoạch</th>
                <th>Người ghi nhận</th>
                <th style={{ textAlign: "right" }}>Nguồn gốc</th>
              </tr>
            </thead>
            <tbody>
              {harvests.map((h) => (
                <tr key={h.id}>
                  <td>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#065f46", background: "#ecfdf5", padding: "3px 8px", borderRadius: "6px", border: "1px solid #a7f3d0" }}>
                      {h.trace_code}
                    </span>
                  </td>
                  <td>
                    <strong>{h.lot_code}</strong>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{h.lot_name}</div>
                  </td>
                  <td><strong>{h.product_name}</strong></td>
                  <td><span style={{ fontSize: "1rem", fontWeight: 700 }}>{formatKg(h.quantity_kg)}</span></td>
                  <td>
                    <Badge variant={h.quality_grade === "A" ? "success" : h.quality_grade === "B" ? "info" : "warning"}>
                      {h.quality_grade_display}
                    </Badge>
                  </td>
                  <td>{h.harvested_at}</td>
                  <td>{h.recorded_by}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleTraceClick(h.trace_code)}
                      title="Xem nhật ký truy xuất nguồn gốc"
                    >
                      <QrCode size={14} /> Tra cứu
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add Harvest */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Ghi nhận thu hoạch rau sạch"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu phiếu thu hoạch"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="alert alert-info" style={{ fontSize: "0.82rem", marginBottom: "16px" }}>
            Lưu ý: Sau khi lưu, trạng thái của lô trồng sẽ được tự động chuyển thành <strong>Đã thu hoạch</strong> và hệ thống tự động sinh <strong>Mã truy xuất nguồn gốc (QR Code)</strong>.
          </div>

          <div className="form-group">
            <label className="form-label">Chọn lô thu hoạch (*)</label>
            <select
              className="form-control"
              value={formData.lot_id}
              onChange={(e) => {
                const selected = lots.find((l) => l.id === parseInt(e.target.value));
                setFormData({
                  ...formData,
                  lot_id: e.target.value,
                  product_name: selected ? selected.variety_name || selected.name : formData.product_name,
                });
              }}
              required
            >
              <option value="">Chọn lô...</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>{l.code} - {l.name} ({l.variety_name})</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Tên sản phẩm xuất bán (*)</label>
              <input
                type="text"
                className="form-control"
                placeholder="VD: Xà lách hữu cơ loại 1"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sản lượng (kg) (*)</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                className="form-control"
                placeholder="VD: 150.5"
                value={formData.quantity_kg}
                onChange={(e) => setFormData({ ...formData, quantity_kg: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Phân loại phẩm chất</label>
              <select
                className="form-control"
                value={formData.quality_grade}
                onChange={(e) => setFormData({ ...formData, quality_grade: e.target.value })}
              >
                {HARVEST_GRADE_CHOICES.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Ngày thu hoạch (*)</label>
              <input
                type="date"
                className="form-control"
                value={formData.harvested_at}
                onChange={(e) => setFormData({ ...formData, harvested_at: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ghi chú thu hoạch</label>
            <textarea
              className="form-control"
              placeholder="Độ đồng đều của búp, tình trạng sơ chế, bảo quản lạnh..."
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
