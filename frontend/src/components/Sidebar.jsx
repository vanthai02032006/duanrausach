import React from "react";
import {
  Sprout,
  LayoutDashboard,
  Grid,
  Flower2,
  CalendarDays,
  Boxes,
  Wheat,
  CircleDollarSign,
  QrCode,
  Sparkles,
  BookOpen,
  BarChart3,
  Activity,
  Users,
  LogOut,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export function Sidebar({ currentView, setCurrentView }) {
  const { user, logout } = useAuth();
  const role = user?.role || "Guest";
  const isManager = role === "Manager" || role === "Superuser";
  const isTechOrManager = isManager || role === "Technician";

  const navItems = [
    { id: "dashboard", label: "Tổng quan", icon: <LayoutDashboard /> },
    { id: "lots", label: "Lô trồng", icon: <Grid /> },
    { id: "varieties", label: "Giống cây", icon: <Flower2 /> },
    { id: "care", label: "Lịch & Nhật ký chăm sóc", icon: <CalendarDays /> },
    { id: "materials", label: "Vật tư & Kho", icon: <Boxes /> },
    { id: "harvests", label: "Thu hoạch", icon: <Wheat /> },
    ...(isManager ? [{ id: "sales", label: "Bán hàng", icon: <CircleDollarSign /> }] : []),
    { id: "trace", label: "Truy xuất nguồn gốc", icon: <QrCode /> },
    { id: "ai", label: "Trợ lý AI Gemini", icon: <Sparkles /> },
    ...(isTechOrManager ? [{ id: "knowledge", label: "Kho tri thức AI", icon: <BookOpen /> }] : []),
    ...(isTechOrManager ? [{ id: "reports", label: "Báo cáo số liệu", icon: <BarChart3 /> }] : []),
    ...(isManager ? [{ id: "ai-monitor", label: "Giám sát AI", icon: <Activity /> }] : []),
    ...(isManager ? [{ id: "accounts", label: "Quản lý tài khoản", icon: <Users /> }] : []),
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-icon">
          <Sprout size={24} />
        </div>
        <div className="brand-text">
          <h1>GreenFarm AI</h1>
          <span>Nông nghiệp sạch thông minh</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Hệ thống quản lý</div>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`nav-item ${currentView === item.id ? "active" : ""}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-badge">
          <div className="user-avatar">
            {user?.username?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="user-info">
            <div className="username">{user?.full_name || user?.username}</div>
            <div className="role">
              {role === "Manager" ? "Quản lý" : role === "Technician" ? "Kỹ thuật viên" : "Nhân viên"}
            </div>
          </div>
        </div>
        <button onClick={logout} className="btn-logout" title="Đăng xuất">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
