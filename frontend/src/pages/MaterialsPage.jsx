import React, { useState, useEffect } from "react";
import { Plus, Search, Boxes, AlertTriangle, ArrowDownRight, Edit } from "lucide-react";
import { farmService } from "../services/farmService";
import { Badge } from "../components/Badge";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import { formatVND } from "../utils/formatters";
import { MATERIAL_CATEGORY_CHOICES } from "../utils/constants";

export function MaterialsPage() {
  const { user } = useAuth();
  const isManager = user?.role === "Manager" || user?.role === "Superuser";

  const [data, setData] = useState({ materials: [], usages: [] });
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lowStockFilter, setLowStockFilter] = useState("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [usageModalOpen, setUsageModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  const [newMaterialData, setNewMaterialData] = useState({
    name: "",
    category: "fertilizer",
    unit: "kg",
    quantity: 0,
    minimum_quantity: 5,
    unit_price: 0,
    description: "",
  });

  const [usageData, setUsageData] = useState({
    material_id: "",
    lot_id: "",
    quantity: "",
    note: "",
  });

  const [alert, setAlert] = useState({ type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [res, lotsRes] = await Promise.all([
        farmService.getMaterials({ q: search, low: lowStockFilter }),
        farmService.getLots(),
      ]);
      setData(res);
      setLots(lotsRes);
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi tải danh mục vật tư." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, lowStockFilter]);

  const handleOpenUsage = (material) => {
    setSelectedMaterial(material);
    setUsageData({
      material_id: material.id,
      lot_id: lots[0]?.id || "",
      quantity: "",
      note: "",
    });
    setUsageModalOpen(true);
  };

  const handleCreateMaterial = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await farmService.createMaterial(newMaterialData);
      setAlert({ type: "success", message: "Đã thêm vật tư mới vào kho thành công!" });
      setCreateModalOpen(false);
      fetchData();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi khi thêm vật tư." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordUsage = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await farmService.useMaterial(usageData);
      setAlert({ type: "success", message: "Đã ghi nhận sử dụng và tự động trừ kho thành công!" });
      setUsageModalOpen(false);
      fetchData();
    } catch (err) {
      setAlert({ type: "danger", message: err.message || "Lỗi ghi nhận sử dụng vật tư." });
    } finally {
      setSubmitting(false);
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
              placeholder="Tìm theo tên vật tư hoặc nhóm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "34px" }}
            />
            <Search size={16} style={{ position: "absolute", left: "11px", top: "11px", color: "#94a3b8" }} />
          </div>

          <button
            type="button"
            className={`btn ${lowStockFilter === "1" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setLowStockFilter(lowStockFilter === "1" ? "" : "1")}
          >
            <AlertTriangle size={16} />
            {lowStockFilter === "1" ? "Đang lọc: Sắp hết hàng" : "Lọc vật tư sắp hết"}
          </button>
        </div>

        {isManager && (
          <button className="btn btn-primary" onClick={() => setCreateModalOpen(true)}>
            <Plus size={18} />
            Thêm vật tư mới
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner text="Đang tải dữ liệu kho vật tư..." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
          {/* Materials Table */}
          <div className="card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "16px" }}>Kho vật tư nông nghiệp</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Tên vật tư</th>
                    <th>Nhóm</th>
                    <th>Tồn kho</th>
                    <th>Mức tối thiểu</th>
                    <th>Đơn giá</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: "right" }}>Sử dụng</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.materials?.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        {m.description && <small style={{ color: "var(--text-muted)" }}>{m.description}</small>}
                      </td>
                      <td>{m.category_display}</td>
                      <td>
                        <strong style={{ fontSize: "0.95rem" }}>{m.quantity}</strong> {m.unit}
                      </td>
                      <td>{m.minimum_quantity} {m.unit}</td>
                      <td>{formatVND(m.unit_price)} / {m.unit}</td>
                      <td>
                        <Badge variant={m.is_low_stock ? "danger" : "success"}>
                          {m.is_low_stock ? "Dưới mức tối thiểu" : "Đủ hàng"}
                        </Badge>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenUsage(m)}
                          title="Ghi phiếu sử dụng"
                          style={{ color: "#059669", borderColor: "#a7f3d0" }}
                        >
                          <ArrowDownRight size={14} /> Xuất dùng
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Usage History */}
          <div className="card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "16px" }}>Lịch sử sử dụng gần đây</h3>
            {data?.usages?.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Chưa có phiếu sử dụng nào.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "600px", overflowY: "auto" }}>
                {data?.usages?.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      padding: "10px 12px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
                      <span>{u.material_name}</span>
                      <span style={{ color: "#dc2626" }}>-{u.quantity} {u.unit}</span>
                    </div>
                    <div style={{ color: "var(--text-muted)", marginTop: "2px" }}>
                      Dùng cho: <strong>{u.lot_code}</strong> ({u.lot_name})
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "0.75rem", color: "#64748b" }}>
                      <span>{u.used_by}</span>
                      <span>{u.used_at}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Add Material */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Thêm vật tư mới vào kho"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleCreateMaterial} disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu vật tư"}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateMaterial}>
          <div className="form-group">
            <label className="form-label">Tên vật tư (*)</label>
            <input
              type="text"
              className="form-control"
              placeholder="VD: Phân hữu cơ trùn quế"
              value={newMaterialData.name}
              onChange={(e) => setNewMaterialData({ ...newMaterialData, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Phân nhóm (*)</label>
              <select
                className="form-control"
                value={newMaterialData.category}
                onChange={(e) => setNewMaterialData({ ...newMaterialData, category: e.target.value })}
              >
                {MATERIAL_CATEGORY_CHOICES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Đơn vị tính (*)</label>
              <input
                type="text"
                className="form-control"
                placeholder="kg, lít, gói, chai..."
                value={newMaterialData.unit}
                onChange={(e) => setNewMaterialData({ ...newMaterialData, unit: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
            <div className="form-group">
              <label className="form-label">Số lượng nhập ban đầu</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                value={newMaterialData.quantity}
                onChange={(e) => setNewMaterialData({ ...newMaterialData, quantity: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Mức tối thiểu cảnh báo</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                value={newMaterialData.minimum_quantity}
                onChange={(e) => setNewMaterialData({ ...newMaterialData, minimum_quantity: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Đơn giá (VNĐ)</label>
              <input
                type="number"
                min="0"
                className="form-control"
                value={newMaterialData.unit_price}
                onChange={(e) => setNewMaterialData({ ...newMaterialData, unit_price: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả chi tiết</label>
            <textarea
              className="form-control"
              placeholder="Quy cách đóng gói, nhà sản xuất, hạn sử dụng..."
              value={newMaterialData.description}
              onChange={(e) => setNewMaterialData({ ...newMaterialData, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Record Usage */}
      <Modal
        isOpen={usageModalOpen}
        onClose={() => setUsageModalOpen(false)}
        title={`Ghi nhận xuất sử dụng: ${selectedMaterial?.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setUsageModalOpen(false)}>Hủy</button>
            <button className="btn btn-primary" onClick={handleRecordUsage} disabled={submitting}>
              {submitting ? "Đang xuất..." : "Xác nhận xuất dùng"}
            </button>
          </>
        }
      >
        <form onSubmit={handleRecordUsage}>
          <div style={{ background: "#ecfdf5", padding: "12px", borderRadius: "8px", marginBottom: "16px", border: "1px solid #a7f3d0" }}>
            <div>Tồn kho hiện có: <strong>{selectedMaterial?.quantity} {selectedMaterial?.unit}</strong></div>
            <div style={{ fontSize: "0.8rem", color: "#065f46" }}>Số lượng xuất sẽ được tự động trừ ngay trong kho sau khi xác nhận.</div>
          </div>

          <div className="form-group">
            <label className="form-label">Chọn lô trồng sử dụng (*)</label>
            <select
              className="form-control"
              value={usageData.lot_id}
              onChange={(e) => setUsageData({ ...usageData, lot_id: e.target.value })}
              required
            >
              <option value="">Chọn lô trồng...</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Số lượng xuất dùng ({selectedMaterial?.unit}) (*)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={selectedMaterial?.quantity}
              className="form-control"
              placeholder="Nhập số lượng xuất..."
              value={usageData.quantity}
              onChange={(e) => setUsageData({ ...usageData, quantity: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ghi chú mục đích sử dụng</label>
            <textarea
              className="form-control"
              placeholder="VD: Bón thúc đợt 2 cho luống 3 và 4..."
              value={usageData.note}
              onChange={(e) => setUsageData({ ...usageData, note: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
