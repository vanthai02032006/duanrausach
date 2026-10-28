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
  const [qrModalHarvest, setQrModalHarvest] = useState(null);
  const [formData, setFormData] = useState({
    lot_id: "",
    product_name: "",
    quantity_kg: "",
    quality_grade: "pending",
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
      quality_grade: "pending",
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
                    <Badge variant={h.quality_grade === "pass" ? "success" : h.quality_grade === "review" ? "danger" : "warning"}>
                      {h.quality_grade_display}
                    </Badge>
                  </td>
                  <td>{h.harvested_at}</td>
                  <td>{h.recorded_by}</td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setQrModalHarvest(h)}
                        title="Xem và quét mã QR trực tiếp"
                        style={{ background: "#059669", color: "#fff", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <QrCode size={14} /> Xem QR
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleTraceClick(h.trace_code)}
                        title="Xem nhật ký canh tác số"
                      >
                        Tra cứu
                      </button>
                      <a
                        href={`/api/trace/${h.trace_code}/qr/?download=1`}
                        className="btn btn-outline btn-sm"
                        title="Tải ảnh QR PNG"
                        style={{ padding: "4px 8px" }}
                      >
                        💾 Tải QR
                      </a>
                      <a
                        href={`/api/trace/${h.trace_code}/label/`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline btn-sm"
                        title="Mở tem nhãn dán bao bì chuẩn VietGAP"
                        style={{ padding: "4px 8px" }}
                      >
                        🏷 Tem nhãn
                      </a>
                    </div>
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

      {/* Modal Quick View QR Code */}
      <Modal
        isOpen={Boolean(qrModalHarvest)}
        onClose={() => setQrModalHarvest(null)}
        title={`Mã QR nguồn gốc: ${qrModalHarvest?.product_name || "Lô thu hoạch"}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setQrModalHarvest(null)}>
              Đóng
            </button>
            {qrModalHarvest && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  const code = qrModalHarvest.trace_code;
                  setQrModalHarvest(null);
                  handleTraceClick(code);
                }}
              >
                Tra cứu chi tiết trên Web
              </button>
            )}
          </>
        }
      >
        {qrModalHarvest && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "12px",
              padding: "16px",
              marginBottom: "16px",
              display: "inline-block",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.12)"
            }}>
              <img
                src={`/api/trace/${qrModalHarvest.trace_code}/qr/?size=8`}
                alt={`QR code ${qrModalHarvest.trace_code}`}
                style={{ width: "220px", height: "220px", display: "block", margin: "0 auto", borderRadius: "8px" }}
              />
              <div style={{
                marginTop: "10px",
                fontFamily: "monospace",
                fontWeight: 800,
                fontSize: "1.1rem",
                color: "#065f46",
                letterSpacing: "1px"
              }}>
                {qrModalHarvest.trace_code}
              </div>
            </div>

            <div style={{
              background: "#ecfdf5",
              color: "#065f46",
              padding: "12px 16px",
              borderRadius: "10px",
              fontSize: "0.88rem",
              lineHeight: 1.5,
              marginBottom: "16px",
              textAlign: "left",
              borderLeft: "4px solid #10b981"
            }}>
              <div style={{ fontWeight: 700, marginBottom: "4px" }}>📱 Hướng dẫn quét kiểm tra:</div>
              <div>• Dùng <strong>Camera điện thoại</strong>, <strong>ứng dụng Zalo</strong> hoặc <strong>Google Lens</strong> hướng vào mã QR phía trên màn hình để quét thử.</div>
              <div>• Hoặc vào mục <strong>Truy xuất nguồn gốc</strong> trên thanh menu và bật camera web để quét.</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", textAlign: "left", fontSize: "0.85rem", background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
              <div><strong>Sản phẩm:</strong> {qrModalHarvest.product_name}</div>
              <div><strong>Lô trồng:</strong> {qrModalHarvest.lot_code}</div>
              <div><strong>Sản lượng:</strong> {formatKg(qrModalHarvest.quantity_kg)}</div>
              <div><strong>Ngày thu hoạch:</strong> {qrModalHarvest.harvested_at}</div>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <a
                href={`/api/trace/${qrModalHarvest.trace_code}/qr/?download=1`}
                className="btn btn-outline"
                style={{ fontSize: "0.85rem" }}
              >
                💾 Tải ảnh QR (PNG)
              </a>
              <a
                href={`/api/trace/${qrModalHarvest.trace_code}/label/`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline"
                style={{ fontSize: "0.85rem" }}
              >
                🏷 Xem tem nhãn in dán bao bì
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
