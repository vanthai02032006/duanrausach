import React, { useState, useEffect } from "react";
import { Plus, CircleDollarSign } from "lucide-react";
import { farmService } from "../services/farmService";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { formatVND, formatKg } from "../utils/formatters";

export function SalesPage() {
  const [data, setData] = useState({ sales: [], total_revenue: 0 });
  const [harvests, setHarvests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    harvest_id: "",
    customer_name: "",
    quantity_kg: "",
    unit_price: "",
    sold_at: new Date().toISOString().split("T")[0],
  });

  const [alert, setAlert] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const [salesRes, harvestsRes] = await Promise.all([
        farmService.getSales(),
        farmService.getHarvests(),
      ]);
      setData(salesRes);
      setHarvests(harvestsRes);
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi tải danh sách bán hàng." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const handleOpenCreate = () => {
    const firstH = harvests[0];
    setFormData({
      harvest_id: firstH?.id || "",
      customer_name: "",
      quantity_kg: firstH?.quantity_kg || "10",
      unit_price: "35000",
      sold_at: new Date().toISOString().split("T")[0],
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await farmService.createSale(formData);
      setAlert({ type: "success", message: "Đã tạo phiếu bán hàng thành công!" });
      setModalOpen(false);
      fetchSales();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi tạo phiếu bán hàng." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {alert.message && (
        <Alert variant={alert.type} message={alert.message} onClose={() => setAlert({ type: "", message: "" })} />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "10px 18px", borderRadius: "10px" }}>
            <span style={{ fontSize: "0.82rem", color: "#065f46", fontWeight: 600 }}>Tổng doanh thu: </span>
            <strong style={{ fontSize: "1.2rem", color: "#047857" }}>{formatVND(data.total_revenue)}</strong>
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={18} />
          Tạo phiếu bán hàng
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Đang tải danh sách bán hàng..." />
      ) : data?.sales?.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
          <p>Chưa có phiếu bán hàng nào.</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Mã truy xuất</th>
                <th>Sản phẩm</th>
                <th>Lô trồng</th>
                <th>Khách hàng</th>
                <th>Khối lượng</th>
                <th>Đơn giá</th>
                <th>Thành tiền</th>
                <th>Ngày bán</th>
                <th>Người tạo</th>
              </tr>
            </thead>
            <tbody>
              {data?.sales?.map((s) => (
                <tr key={s.id}>
                  <td><code style={{ color: "#047857" }}>{s.harvest_trace_code}</code></td>
                  <td><strong>{s.product_name}</strong></td>
                  <td>{s.lot_code}</td>
                  <td>{s.customer_name}</td>
                  <td>{formatKg(s.quantity_kg)}</td>
                  <td>{formatVND(s.unit_price)}</td>
                  <td><strong style={{ color: "#16a34a" }}>{formatVND(s.total_price)}</strong></td>
                  <td>{s.sold_at}</td>
                  <td>{s.recorded_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add Sale */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tạo phiếu bán rau sạch"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu phiếu bán"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Chọn lô thu hoạch (*)</label>
            <select
              className="form-control"
              value={formData.harvest_id}
              onChange={(e) => setFormData({ ...formData, harvest_id: e.target.value })}
              required
            >
              <option value="">Chọn lô thu hoạch...</option>
              {harvests.map((h) => (
                <option key={h.id} value={h.id}>
                  [{h.trace_code}] {h.product_name} ({h.lot_code} - {formatKg(h.quantity_kg)})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Tên khách hàng / Đơn vị mua (*)</label>
            <input
              type="text"
              className="form-control"
              placeholder="VD: Cửa hàng Thực phẩm sạch An Khang..."
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Số lượng bán (kg) (*)</label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                className="form-control"
                value={formData.quantity_kg}
                onChange={(e) => setFormData({ ...formData, quantity_kg: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Đơn giá (VNĐ/kg) (*)</label>
              <input
                type="number"
                min="0"
                className="form-control"
                placeholder="VD: 35000"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Ngày bán (*)</label>
            <input
              type="date"
              className="form-control"
              value={formData.sold_at}
              onChange={(e) => setFormData({ ...formData, sold_at: e.target.value })}
              required
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
