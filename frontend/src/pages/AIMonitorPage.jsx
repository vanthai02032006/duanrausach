import React from "react";
import { Activity, ShieldAlert, Cpu, CheckCircle } from "lucide-react";
import { farmService } from "../services/farmService";
import { useFetch } from "../hooks/useFetch";
import { StatCard } from "../components/StatCard";
import { LoadingSpinner } from "../components/LoadingSpinner";

export function AIMonitorPage() {
  const { data, loading, error } = useFetch(farmService.getAiMonitor);

  if (loading) return <LoadingSpinner text="Đang tải nhật ký giám sát hoạt động AI..." />;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      <div className="stat-grid" style={{ marginBottom: "24px" }}>
        <StatCard label="Tổng tương tác ghi nhận" value={data?.total || 0} icon={<Activity size={22} />} />
        <StatCard label="Tỷ lệ thành công" value={`${data?.success_rate || 0}%`} icon={<CheckCircle size={22} style={{ color: "#16a34a" }} />} />
        <StatCard label="Độ trễ trung bình" value={`${data?.avg_latency || 0} ms`} icon={<Cpu size={22} />} />
        <StatCard label="Phiên bản Prompt" value={data?.prompt_version || "v3.0"} />
      </div>

      <div className="card">
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "16px" }}>Bảng giám sát chi tiết các truy vấn LLM</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Thời gian</th>
                <th>Người dùng</th>
                <th>Tác vụ</th>
                <th>Model</th>
                <th>Độ trễ</th>
                <th>Kết quả</th>
                <th>Mã lỗi</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {data?.interactions?.map((i) => (
                <tr key={i.id}>
                  <td><code>#{i.id}</code></td>
                  <td>{i.created_at}</td>
                  <td><strong>{i.user}</strong></td>
                  <td>{i.task_display}</td>
                  <td><code style={{ fontSize: "0.75rem" }}>{i.model_name || "gemini-3.8-flash"}</code></td>
                  <td>{i.latency_ms} ms</td>
                  <td>
                    <span className={`badge ${i.succeeded ? "badge-success" : "badge-danger"}`}>
                      {i.succeeded ? "OK" : "FAILED"}
                    </span>
                  </td>
                  <td>{i.error_category || "—"}</td>
                  <td>
                    {i.feedback === "helpful" ? (
                      <span className="badge badge-success">Hữu ích</span>
                    ) : i.feedback === "not_helpful" ? (
                      <span className="badge badge-danger">Chưa hữu ích</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
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
