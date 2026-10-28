import React from "react";
import {
  Grid,
  Maximize2,
  Wheat,
  CircleDollarSign,
  CalendarCheck,
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { farmService } from "../services/farmService";
import { useFetch } from "../hooks/useFetch";
import { StatCard } from "../components/StatCard";
import { Badge } from "../components/Badge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { formatVND, formatKg } from "../utils/formatters";

export function DashboardPage({ setCurrentView }) {
  const { data, loading, error, refetch } = useFetch(farmService.getDashboard);

  if (loading) return <LoadingSpinner text="Đang đồng bộ dữ liệu nông trại..." />;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      {/* KPI Cards */}
      <div className="stat-grid">
        <StatCard
          label="Tổng số lô trồng"
          value={data?.total_lots || 0}
          icon={<Grid size={22} />}
          change={`${data?.active_lots || 0} lô đang canh tác`}
          changeType="up"
        />
        <StatCard
          label="Tổng diện tích"
          value={`${data?.total_area || 0} m²`}
          icon={<Maximize2 size={22} />}
        />
        <StatCard
          label="Thu hoạch trong tháng"
          value={formatKg(data?.monthly_harvest_kg)}
          icon={<Wheat size={22} />}
          change={`${data?.ready_lots || 0} lô sắp thu hoạch`}
          changeType="up"
        />
        <StatCard
          label="Doanh thu tháng này"
          value={formatVND(data?.monthly_revenue)}
          icon={<CircleDollarSign size={22} />}
        />
        <StatCard
          label="Nhật ký hôm nay"
          value={data?.today_logs || 0}
          icon={<CalendarCheck size={22} />}
          change={`${data?.pending_logs || 0} việc cần làm`}
          changeType="neutral"
        />
        <StatCard
          label="Cảnh báo tồn kho"
          value={data?.low_stock?.length || 0}
          icon={<AlertTriangle size={22} style={{ color: "#d97706" }} />}
          change={data?.low_stock?.length > 0 ? "Cần bổ sung vật tư" : "Kho an toàn"}
          changeType={data?.low_stock?.length > 0 ? "down" : "up"}
        />
      </div>

      {/* Quick Action Shortcuts */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
        marginBottom: "24px",
        background: "white",
        padding: "14px 20px",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)"
      }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "6px" }}>
          Thao tác nhanh:
        </span>
        <button className="btn btn-secondary btn-sm" onClick={() => setCurrentView("lots")}>
          ➕ Quản lý Lô trồng
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setCurrentView("care")}>
          📝 Ghi Nhật ký
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setCurrentView("materials")}>
          📦 Xuất kho Vật tư
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setCurrentView("harvests")}>
          🌾 Thu hoạch & Mã QR
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setCurrentView("trace")}>
          🔍 Tra cứu Nguồn gốc
        </button>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => setCurrentView("ai")}>
          ✨ Trợ lý Nông nghiệp AI
        </button>
      </div>

      {/* AI Banner */}
      <div className="ai-box" style={{ marginBottom: "24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
          }}>
            <Sparkles size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#064e3b" }}>Trợ lý AI Gemini cho Nông Nghiệp</h3>
            <p style={{ color: "#047857", fontSize: "0.85rem", marginTop: "2px" }}>
              Tự động phân tích nhật ký, gợi ý lịch tưới phân và đánh giá rủi ro trước thu hoạch.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setCurrentView("ai")}>
          Mở Trợ lý AI
          <ArrowRight size={16} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        {/* Recent lots */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Lô trồng gần đây</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setCurrentView("lots")}>
              Xem tất cả
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Mã lô</th>
                  <th>Tên & Giống</th>
                  <th>Diện tích</th>
                  <th>Ngày gieo</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data?.recent_lots?.map((lot) => (
                  <tr key={lot.id}>
                    <td><strong>{lot.code}</strong></td>
                    <td>
                      <div>{lot.name}</div>
                      <small style={{ color: "var(--text-muted)" }}>{lot.variety_name}</small>
                    </td>
                    <td>{lot.area_m2} m²</td>
                    <td>{lot.planting_date}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock & Urgent */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Urgent lots */}
          <div className="card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>🌾</span> Lô cần thu hoạch gấp
            </h3>
            {data?.urgent_lots?.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 10px", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>✅</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>Không có lô đến hạn gấp</div>
                <div style={{ fontSize: "0.75rem" }}>Tất cả các lô đang phát triển theo đúng kế hoạch.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data?.urgent_lots?.map((l) => (
                  <div
                    key={l.id}
                    style={{
                      padding: "12px 14px",
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderLeft: "4px solid #f59e0b",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "var(--transition)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#92400e" }}>{l.code} - {l.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#b45309", marginTop: "2px" }}>Dự kiến: {l.expected_harvest_date}</div>
                    </div>
                    <Badge variant="warning">Sắp thu hoạch</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low stock */}
          <div className="card">
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📦</span> Vật tư dưới mức tối thiểu
            </h3>
            {data?.low_stock?.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 10px", color: "#16a34a" }}>
                <div style={{ fontSize: "1.8rem", marginBottom: "6px" }}>🛡️</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 700 }}>Kho vật tư an toàn</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Mọi loại phân bón & hạt giống đều đủ định mức.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data?.low_stock?.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: "12px 14px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderLeft: "4px solid #ef4444",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "var(--transition)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#991b1b" }}>{m.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "2px" }}>
                        Còn lại: <strong>{m.quantity} {m.unit}</strong> (Định mức: {m.minimum_quantity} {m.unit})
                      </div>
                    </div>
                    <Badge variant="danger">Cần nhập</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
