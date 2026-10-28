import React from "react";
import { BarChart3, TrendingUp, Sparkles, CheckCircle2, Clock, ThumbsUp } from "lucide-react";
import { farmService } from "../services/farmService";
import { useFetch } from "../hooks/useFetch";
import { StatCard } from "../components/StatCard";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { formatKg } from "../utils/formatters";

export function ReportsPage() {
  const { data, loading, error } = useFetch(farmService.getReports);

  if (loading) return <LoadingSpinner text="Đang tính toán các chỉ số thống kê & hiệu năng AI..." />;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      {/* Farm Stats */}
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "14px" }}>Hiệu quả vận hành nông trại</h3>
      <div className="stat-grid" style={{ marginBottom: "28px" }}>
        <StatCard label="Tổng diện tích canh tác" value={`${data?.total_area || 0} m²`} />
        <StatCard label="Sản lượng thu hoạch tháng" value={formatKg(data?.month_harvest_kg)} />
        <StatCard label="Danh mục vật tư lưu kho" value={data?.material_count || 0} />
        <StatCard label="Công việc chăm sóc đang chờ" value={data?.pending_care_logs || 0} />
      </div>

      {/* AI Performance Stats */}
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
        <Sparkles size={20} style={{ color: "#10b981" }} />
        Chỉ số chất lượng & Độ trễ AI Gemini
      </h3>
      <div className="stat-grid">
        <StatCard
          label="Tổng lượt gọi AI"
          value={data?.ai_total || 0}
          icon={<Sparkles size={22} />}
        />
        <StatCard
          label="Tỷ lệ gọi thành công"
          value={`${data?.ai_success_rate || 0}%`}
          icon={<CheckCircle2 size={22} style={{ color: "#16a34a" }} />}
          changeType="up"
        />
        <StatCard
          label="Độ trễ trung bình"
          value={`${data?.ai_avg_latency || 0} ms`}
          icon={<Clock size={22} />}
        />
        <StatCard
          label="Tỷ lệ đánh giá hữu ích"
          value={`${data?.helpful_rate || 0}%`}
          icon={<ThumbsUp size={22} style={{ color: "#059669" }} />}
          change={`${data?.feedback_total || 0} lượt phản hồi`}
        />
      </div>

      {/* Recent AI logs */}
      <div className="card" style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "16px" }}>Các phiên phân tích gần nhất</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Người gọi</th>
                <th>Tác vụ AI</th>
                <th>Lô tham chiếu</th>
                <th>Trạng thái</th>
                <th>Độ trễ</th>
                <th>Đánh giá người dùng</th>
              </tr>
            </thead>
            <tbody>
              {data?.recent_ai?.map((row) => (
                <tr key={row.id}>
                  <td>{row.created_at}</td>
                  <td><strong>{row.user}</strong></td>
                  <td>{row.task_display}</td>
                  <td>{row.lot_code || "—"}</td>
                  <td>
                    <span className={`badge ${row.succeeded ? "badge-success" : "badge-danger"}`}>
                      {row.succeeded ? "Thành công" : "Lỗi"}
                    </span>
                  </td>
                  <td>{row.latency_ms} ms</td>
                  <td>
                    {row.feedback === "helpful" ? (
                      <span className="badge badge-success">Hữu ích</span>
                    ) : row.feedback === "not_helpful" ? (
                      <span className="badge badge-danger">Chưa hữu ích</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Chưa đánh giá</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
