import React from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export function Navbar({ title, subtitle }) {
  const { user } = useAuth();
  const roleName = {
    Manager: "Quản lý",
    Technician: "Kỹ thuật viên",
    Staff: "Nhân viên",
    Superuser: "Quản trị cấp cao",
  }[user?.role] || user?.role;

  return (
    <header className="topbar">
      <div className="topbar-title">
        <h2>{title}</h2>
        {subtitle && <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>— {subtitle}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div className="topbar-badge">
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", marginRight: "6px" }} />
          Vai trò: {roleName}
        </div>
      </div>
    </header>
  );
}
