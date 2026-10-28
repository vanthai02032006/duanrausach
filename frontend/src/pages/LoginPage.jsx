import React, { useState } from "react";
import { Sprout, Lock, User, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at 50% 20%, #ecfdf5 0%, #f8fafc 70%)",
      padding: "20px",
    }}>
      <div style={{
        background: "white",
        borderRadius: "20px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
        maxWidth: "440px",
        width: "100%",
        padding: "36px 32px",
      }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: "56px",
            height: "56px",
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            borderRadius: "16px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            marginBottom: "16px",
            boxShadow: "0 8px 16px rgba(16, 185, 129, 0.3)",
          }}>
            <Sprout size={32} />
          </div>
          <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#064e3b" }}>GreenFarm AI</h2>
          <p style={{ color: "#64748b", fontSize: "0.88rem", marginTop: "4px" }}>
            Hệ thống quản lý trang trại rau sạch & AI Gemini
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: "20px" }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tên đăng nhập</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="form-control"
                placeholder="quanly, kythuat hoặc nhanvien"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ paddingLeft: "38px" }}
              />
              <User size={18} style={{ position: "absolute", left: "12px", top: "11px", color: "#94a3b8" }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: "24px" }}>
            <label className="form-label">Mật khẩu</label>
            <div style={{ position: "relative" }}>
              <input
                type="password"
                className="form-control"
                placeholder="Mật khẩu của bạn"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: "38px" }}
              />
              <Lock size={18} style={{ position: "absolute", left: "12px", top: "11px", color: "#94a3b8" }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "12px" }}
            disabled={loading}
          >
            {loading ? "Đang xác thực..." : "Đăng nhập hệ thống"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px dashed #e2e8f0" }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "10px", textAlign: "center" }}>
            Tài khoản demo sẵn có:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {[
              { role: "Quản lý", u: "quanly", p: "Demo12345!" },
              { role: "Kỹ thuật viên", u: "kythuat", p: "Demo12345!" },
              { role: "Nhân viên", u: "nhanvien", p: "Demo12345!" },
            ].map((d) => (
              <button
                key={d.u}
                type="button"
                onClick={() => fillDemo(d.u, d.p)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  color: "#334155",
                  transition: "all 0.15s ease",
                }}
                onMouseOver={(e) => (e.currentTarget.style.borderColor = "#10b981")}
                onMouseOut={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
              >
                <span><strong>{d.role}:</strong> {d.u}</span>
                <span style={{ color: "#059669", fontWeight: 600 }}>Điền nhanh</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
