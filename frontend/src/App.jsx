import React, { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LotsPage } from "./pages/LotsPage";
import { VarietiesPage } from "./pages/VarietiesPage";
import { CareLogsPage } from "./pages/CareLogsPage";
import { MaterialsPage } from "./pages/MaterialsPage";
import { HarvestsPage } from "./pages/HarvestsPage";
import { SalesPage } from "./pages/SalesPage";
import { TracePage } from "./pages/TracePage";
import { AIAssistantPage } from "./pages/AIAssistantPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { ReportsPage } from "./pages/ReportsPage";
import { AIMonitorPage } from "./pages/AIMonitorPage";
import { AccountsPage } from "./pages/AccountsPage";
import { Sidebar } from "./components/Sidebar";
import { Navbar } from "./components/Navbar";
import { LoadingSpinner } from "./components/LoadingSpinner";

export function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState("dashboard");
  const [traceCodeToSearch, setTraceCodeToSearch] = useState("");

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LoadingSpinner text="Đang khởi tạo ứng dụng GreenFarm AI..." />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const viewTitles = {
    dashboard: { title: "Bảng điều khiển tổng quan", subtitle: "Theo dõi dữ liệu vận hành trang trại theo thời gian thực" },
    lots: { title: "Quản lý Lô trồng", subtitle: "Danh mục các khu vực canh tác và giai đoạn sinh trưởng" },
    varieties: { title: "Danh mục Giống cây trồng", subtitle: "Thông tin chu kỳ sinh trưởng và quy chuẩn chăm sóc" },
    care: { title: "Nhật ký chăm sóc nông trại", subtitle: "Ghi chép công việc tưới tiêu, bón phân, làm cỏ và theo dõi" },
    materials: { title: "Quản lý Kho vật tư", subtitle: "Kiểm soát tồn kho hạt giống, phân bón, chế phẩm sinh học" },
    harvests: { title: "Ghi nhận Thu hoạch nông sản", subtitle: "Quản lý sản lượng và tự động sinh mã QR truy xuất nguồn gốc" },
    sales: { title: "Bán hàng & Doanh thu", subtitle: "Quản lý phiếu xuất bán và báo cáo tài chính" },
    trace: { title: "Truy xuất nguồn gốc nông sản", subtitle: "Minh bạch hóa toàn bộ quy trình chăm sóc từ hạt giống đến bàn ăn" },
    ai: { title: "Trợ lý AI Gemini thông minh", subtitle: "Phân tích nhật ký, gợi ý lịch tưới phân và tư vấn kỹ thuật" },
    knowledge: { title: "Kho tri thức nông nghiệp", subtitle: "Tài liệu cơ sở dữ liệu chuyên gia phục vụ cơ chế RAG cho AI" },
    reports: { title: "Báo cáo số liệu & Hiệu năng", subtitle: "Tổng hợp năng suất trang trại và chất lượng phản hồi AI" },
    "ai-monitor": { title: "Giám sát vận hành AI", subtitle: "Kiểm soát độ trễ, prompt, mã lỗi và feedback từ mô hình LLM" },
    accounts: { title: "Quản lý Phân quyền tài khoản", subtitle: "Thiết lập quyền truy cập cho Quản lý, Kỹ thuật viên và Nhân viên" },
  };

  const currentInfo = viewTitles[currentView] || { title: "GreenFarm AI", subtitle: "" };

  return (
    <div className="app-container">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <div className="main-wrapper">
        <Navbar title={currentInfo.title} subtitle={currentInfo.subtitle} />
        <main className="content-area">
          {currentView === "dashboard" && <DashboardPage setCurrentView={setCurrentView} />}
          {currentView === "lots" && <LotsPage />}
          {currentView === "varieties" && <VarietiesPage />}
          {currentView === "care" && <CareLogsPage />}
          {currentView === "materials" && <MaterialsPage />}
          {currentView === "harvests" && (
            <HarvestsPage setCurrentView={setCurrentView} setTraceCodeToSearch={setTraceCodeToSearch} />
          )}
          {currentView === "sales" && <SalesPage />}
          {currentView === "trace" && <TracePage initialCode={traceCodeToSearch} />}
          {currentView === "ai" && <AIAssistantPage />}
          {currentView === "knowledge" && <KnowledgePage />}
          {currentView === "reports" && <ReportsPage />}
          {currentView === "ai-monitor" && <AIMonitorPage />}
          {currentView === "accounts" && <AccountsPage />}
        </main>
      </div>
    </div>
  );
}

export default App;
