# GreenFarm AI — Frontend (React + Vite)

Cấu trúc frontend được tổ chức chuẩn theo mô hình dự án React/Vite hiện đại:

```text
frontend/
├── public/                 # Static files (favicon, logo, icons)
├── src/
│   ├── assets/             # Assets tĩnh (images, fonts, vector)
│   ├── components/         # Các UI component dùng lại (Navbar, Sidebar, Modal, Badge, StatCard, Alert)
│   ├── pages/              # Các màn hình chức năng (Dashboard, Lots, Varieties, Care, Materials, Harvests, Sales, Trace, AI, Knowledge, Reports, Accounts, Login)
│   ├── hooks/              # Custom React hooks (useAuth, useFetch)
│   ├── context/            # Quản lý trạng thái toàn cục (AuthContext)
│   ├── services/ (hoặc api/)# Tầng gọi API kết nối tới backend Django (authService, farmService, aiService)
│   ├── utils/              # Tiện ích bổ trợ (formatters tiền tệ VND, ngày tháng, constants)
│   ├── styles/             # Hệ thống thiết kế CSS (Design System xanh lá - trắng, micro-animations, glassmorphism)
│   ├── App.jsx             # Component gốc quản lý routing màn hình
│   └── main.jsx            # Entry point của ứng dụng React
├── .env.example
├── package.json
└── vite.config.js
```

## Khởi chạy Frontend Local:
```bash
cd frontend
npm install
npm run dev
```
Giao diện chạy tại: `http://localhost:5173`
Hệ thống tự động proxy các request `/api/*` tới backend Django đang chạy tại `http://127.0.0.1:8000`.
