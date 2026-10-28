import React, { useState, useEffect } from "react";
import { Search, QrCode, CheckCircle2, Sprout, Calendar, Clock, AlertCircle } from "lucide-react";
import { farmService } from "../services/farmService";
import { Badge } from "../components/Badge";
import { LoadingSpinner } from "../components/LoadingSpinner";

export function TracePage({ initialCode = "" }) {
  const [code, setCode] = useState(initialCode || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (codeToSearch) => {
    const query = (codeToSearch || code).trim();
    if (!query) return;
    setLoading(true);
    setError("");
    try {
      const data = await farmService.traceCode(query);
      setResult(data);
    } catch (err) {
      setError(err.message || "Lỗi khi tra cứu mã nguồn gốc.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      handleSearch(initialCode);
    }
  }, [initialCode]);

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      {/* Search Bar */}
      <div className="card" style={{ marginBottom: "24px", textAlign: "center", padding: "32px 24px" }}>
        <div style={{
          width: "52px",
          height: "52px",
          borderRadius: "14px",
          background: "#ecfdf5",
          color: "#059669",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "14px",
        }}>
          <QrCode size={28} />
        </div>
        <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#064e3b" }}>
          Hệ thống truy xuất nguồn gốc nông sản GreenFarm
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", maxWidth: "540px", margin: "6px auto 20px" }}>
          Nhập mã lô trồng (VD: <code>A01</code>, <code>A02</code>) hoặc mã tem thu hoạch (VD: <code>GF-...</code>) để tra cứu toàn bộ quy trình chăm sóc và thu hoạch minh bạch.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          style={{ display: "flex", gap: "10px", maxWidth: "500px", margin: "0 auto" }}
        >
          <input
            type="text"
            className="form-control"
            placeholder="Nhập mã truy xuất: GF-XXXXXXXX hoặc A01..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            style={{ fontSize: "1rem", padding: "11px 16px" }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: "0 22px" }} disabled={loading}>
            <Search size={18} />
            Tra cứu
          </button>
        </form>
      </div>

      {loading && <LoadingSpinner text="Đang tra cứu dữ liệu truy xuất nguồn gốc từ sổ cái..." />}
      {error && <div className="alert alert-danger">{error}</div>}

      {result && result.searched && !result.found && (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
          <AlertCircle size={36} style={{ color: "#d97706", margin: "0 auto 12px" }} />
          <h4 style={{ color: "#b45309", fontSize: "1.1rem" }}>Không tìm thấy dữ liệu</h4>
          <p style={{ marginTop: "6px" }}>Không tìm thấy lô trồng hoặc phiếu thu hoạch nào khớp với mã: <strong>{result.code}</strong></p>
        </div>
      )}

      {result && result.found && (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Certificate Header */}
          <div className="card" style={{ background: "linear-gradient(135deg, #064e3b 0%, #047857 100%)", color: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <span className="badge badge-success" style={{ background: "rgba(255,255,255,0.2)", color: "#ffffff", marginBottom: "8px" }}>
                  <CheckCircle2 size={13} /> {result.found_by}
                </span>
                <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "white", marginTop: "4px" }}>
                  {result.lot.name} ({result.lot.variety_name})
                </h2>
                {result.lot.scientific_name && (
                  <div style={{ fontStyle: "italic", opacity: 0.85, fontSize: "0.9rem" }}>{result.lot.scientific_name}</div>
                )}
              </div>
              <div style={{ textAlign: "right", background: "rgba(0,0,0,0.2)", padding: "10px 16px", borderRadius: "10px" }}>
                <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>Mã tra cứu</div>
                <div style={{ fontFamily: "monospace", fontSize: "1.15rem", fontWeight: 700 }}>{result.code}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.2)", fontSize: "0.85rem" }}>
              <div>
                <span style={{ opacity: 0.75 }}>Mã lô:</span> <strong>{result.lot.code}</strong>
              </div>
              <div>
                <span style={{ opacity: 0.75 }}>Diện tích:</span> <strong>{result.lot.area_m2} m²</strong>
              </div>
              <div>
                <span style={{ opacity: 0.75 }}>Ngày gieo trồng:</span> <strong>{result.lot.planting_date}</strong>
              </div>
              <div>
                <span style={{ opacity: 0.75 }}>Trạng thái:</span> <strong>{result.lot.status_display}</strong>
              </div>
            </div>
          </div>

          {/* Harvests */}
          {result.harvests?.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>Thông tin phiếu thu hoạch xuất bán</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {result.harvests.map((h) => (
                  <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#065f46" }}>Mã tem: {h.trace_code}</div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-main)", marginTop: "2px" }}>
                        Sản phẩm: <strong>{h.product_name}</strong> — Sản lượng: <strong>{h.quantity_kg} kg</strong>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Badge variant="success">{h.quality_grade}</Badge>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>Ngày thu: {h.harvested_at}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Care Logs Timeline */}
          <div className="card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "16px" }}>Nhật ký quy trình chăm sóc thực tế</h3>
            {result.logs?.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Chưa có ghi chép nhật ký.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {result.logs.map((g, idx) => (
                  <div key={g.id || idx} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Calendar size={16} />
                    </div>
                    <div style={{ flex: 1, background: "#f8fafc", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700 }}>{g.activity}</span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{g.occurred_at}</span>
                      </div>
                      <p style={{ fontSize: "0.85rem", marginTop: "4px" }}>{g.note}</p>
                      {g.observation && (
                        <div style={{ fontSize: "0.78rem", color: "#047857", marginTop: "4px" }}>
                          <em>Quan sát: {g.observation}</em>
                        </div>
                      )}
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "6px" }}>Người thực hiện: {g.performer}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Materials Used */}
          {result.usages?.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px" }}>Vật tư & Chế phẩm nông nghiệp đã sử dụng</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
                {result.usages.map((u) => (
                  <div key={u.id} style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.85rem" }}>
                    <div style={{ fontWeight: 700 }}>{u.material_name}</div>
                    <div style={{ color: "#047857", fontWeight: 600, marginTop: "2px" }}>
                      Số lượng: {u.quantity} {u.unit}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>Ngày dùng: {u.used_at}</div>
                    {u.note && <div style={{ fontSize: "0.78rem", color: "#475569", marginTop: "4px" }}>{u.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
