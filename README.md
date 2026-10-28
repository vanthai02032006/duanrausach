# GreenFarm AI — Hệ thống quản lý trang trại rau sạch & Trợ lý AI

Dự án đã được tái cấu trúc hoàn chỉnh và chuyên nghiệp theo mô hình **Tách biệt Backend API + Frontend SPA**, phân tầng rõ ràng (Layered / Clean Architecture) theo chuẩn thiết kế hiện đại.

---

## 1. Cấu trúc tổng thể dự án

```text
greenfarm-django/
├── backend/                       # BACKEND (Django REST API & Business Logic)
│   ├── config/                    # Cấu hình dự án (settings.py, urls.py, wsgi.py, database, CORS)
│   ├── farm/                      # Core Domain App
│   │   ├── controllers/           # Tầng Controller mỏng (Request handlers & Response logic)
│   │   │   ├── auth_controller.py
│   │   │   ├── dashboard_controller.py
│   │   │   ├── lot_controller.py
│   │   │   ├── care_controller.py
│   │   │   ├── material_controller.py
│   │   │   ├── harvest_controller.py
│   │   │   ├── sale_controller.py
│   │   │   ├── trace_controller.py
│   │   │   ├── ai_controller.py
│   │   │   ├── knowledge_controller.py
│   │   │   ├── report_controller.py
│   │   │   └── account_controller.py
│   │   ├── routes/                # Định nghĩa API routes (/api/...)
│   │   │   └── api_routes.py
│   │   ├── services/              # Tầng Business Logic & Reusable Services
│   │   │   ├── ai_service.py        (Gọi Gemini AI, tạo prompt, xử lý RAG)
│   │   │   ├── inventory_service.py (Trừ kho an toàn với Transaction lock)
│   │   │   ├── trace_service.py     (Tra cứu nguồn gốc theo mã lô / tem thu hoạch)
│   │   │   ├── dashboard_service.py (Tính toán KPI, cảnh báo tồn kho, doanh thu)
│   │   │   └── harvest_service.py   (Tạo phiếu thu hoạch, tự động chuyển trạng thái lô)
│   │   ├── models/ (models.py)    # ORM Database Models (CropLot, CareLog, Material, ...)
│   │   ├── validators/            # Request Payload Validation & Serializers
│   │   ├── middlewares/           # Custom Middlewares (Roles, API Error Handling)
│   │   ├── utils/                 # Utilities (Helpers, Role checks, Formatters)
│   │   ├── management/commands/   # Seed dữ liệu demo (seed_demo)
│   │   ├── migrations/            # Database migrations
│   │   └── prompts/               # System & Task Prompts cho Gemini AI
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── frontend/                      # FRONTEND (React + Vite + Design System)
│   ├── public/                    # Static public assets (favicon.svg, robots.txt)
│   ├── src/
│   │   ├── assets/                # Hình ảnh, icon, font
│   │   ├── components/            # UI components tái sử dụng (Navbar, Sidebar, Modal, Badge, StatCard, Alert)
│   │   ├── pages/                 # Các trang chức năng
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── LotsPage.jsx
│   │   │   ├── VarietiesPage.jsx
│   │   │   ├── CareLogsPage.jsx
│   │   │   ├── MaterialsPage.jsx
│   │   │   ├── HarvestsPage.jsx
│   │   │   ├── SalesPage.jsx
│   │   │   ├── TracePage.jsx
│   │   │   ├── AIAssistantPage.jsx
│   │   │   ├── KnowledgePage.jsx
│   │   │   ├── ReportsPage.jsx
│   │   │   ├── AIMonitorPage.jsx
│   │   │   └── AccountsPage.jsx
│   │   ├── hooks/                 # Custom React hooks (useAuth, useFetch)
│   │   ├── context/               # Global state (AuthContext)
│   │   ├── services/              # Giao tiếp HTTP với Backend API (authService, farmService, aiService)
│   │   ├── utils/                 # Formatters (tiền tệ VND, khối lượng kg, ngày tháng)
│   │   ├── styles/                # CSS Design System tông màu xanh lá nông trại, glassmorphism
│   │   ├── App.jsx                # Layout & Điều hướng màn hình
│   │   └── main.jsx               # Entry point
│   ├── package.json
│   ├── vite.config.js
│   └── Dockerfile
│
├── docker-compose.yml             # Orchestration: PostgreSQL + Backend API + Frontend SPA
└── README.md
```

---

## 2. Hướng dẫn chạy môi trường phát triển (Local không cần Docker)

Nếu máy tính của bạn **chưa cài đặt Docker Desktop** (như lỗi `The term 'docker' is not recognized`), bạn có thể chạy trực tiếp bằng Python và Node.js cực kỳ nhanh chóng:

### Bước 1: Khởi động Backend (Django API)
Mở cửa sổ Terminal thứ nhất:
```powershell
cd backend

# 1. Tạo và kích hoạt môi trường ảo Python
python -m venv .venv
.venv\Scripts\Activate.ps1

# 2. Cài đặt thư viện
pip install -r requirements.txt

# 3. Tạo file cấu hình môi trường
if (!(Test-Path .env)) { Copy-Item .env.example .env }

# 4. Migrate database và tạo dữ liệu mẫu
python manage.py migrate
python manage.py seed_demo

# 5. Khởi động server API
python manage.py runserver 8000
```
Backend API sẽ lắng nghe tại: `http://127.0.0.1:8000/api/`

---

### Bước 2: Khởi động Frontend (React / Vite)
Mở cửa sổ Terminal thứ hai:
```powershell
cd frontend

# 1. Cài đặt dependencies (chỉ cần chạy lần đầu)
npm install

# 2. Khởi chạy dev server
npm run dev
```
Giao diện người dùng sẽ chạy tại: **`http://localhost:5173`**

---

## 3. Chạy bằng Docker Compose (Khi đã cài Docker Desktop)

Khi máy tính của bạn đã bật Docker Desktop:
```powershell
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api/`
- PostgreSQL: cổng `5433` trên máy host

---

## 4. Tài khoản demo trải nghiệm

| Vai trò | Tên đăng nhập | Mật khẩu | Quyền hạn |
|---|---|---|---|
| **Quản lý** | `quanly` | `Demo12345!` | Toàn quyền quản trị, bán hàng, kho tri thức, tài khoản, giám sát AI |
| **Kỹ thuật viên** | `kythuat` | `Demo12345!` | Quản lý lô, ghi nhận thu hoạch, tư vấn AI, xem kho tri thức |
| **Nhân viên** | `nhanvien` | `Demo12345!` | Ghi nhật ký chăm sóc, xuất dùng vật tư trong kho, tra cứu nguồn gốc |

---

## 5. Các điểm nổi bật trong cấu trúc mới

1. **Keep Controllers Thin**: Mọi controller trong `backend/farm/controllers/` chỉ xử lý việc nhận request, gọi service tương ứng và trả JSON chuẩn `api_response`.
2. **Business Logic in Services**: Các nghiệp vụ quan trọng (trừ kho an toàn với atomic transaction, tính toán KPI dashboard, gọi Gemini AI với cơ chế RAG, sinh mã QR truy xuất) được đóng gói độc lập trong `backend/farm/services/`.
3. **Frontend SPA Hiện đại**: Giao diện React responsive mượt mà, đầy đủ tính năng:
   - Dashboard với biểu đồ và chỉ số trực quan.
   - Thao tác Thêm/Sửa/Xóa lô trồng, giống cây, nhật ký chăm sóc qua Modal popup.
   - Xuất dùng vật tư với kiểm tra và trừ tồn kho thời gian thực.
   - Trang Tra cứu nguồn gốc nông sản công khai.
   - Tích hợp Gemini AI với lịch sử tương tác, trích dẫn nguồn RAG và nút đánh giá phản hồi 👍/👎.
