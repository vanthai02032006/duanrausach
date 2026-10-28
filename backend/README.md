# GreenFarm AI — Backend API (Django + Layered Architecture)

Kiến trúc backend được tổ chức theo mô hình phân lớp rõ ràng (Layered / Clean Architecture) tương tự như chuẩn Enterprise:

```text
backend/
├── config/                 # Cấu hình dự án (settings.py, urls.py, wsgi.py, database, env)
├── farm/                   # Core Farm Domain
│   ├── controllers/        # Request handlers & response logic (mỏng, chỉ nhận & trả dữ liệu HTTP)
│   ├── routes/             # Định nghĩa API routes và endpoints (/api/...)
│   ├── services/           # Chứa toàn bộ Business logic và các reusable service (ai, inventory, trace, dashboard)
│   ├── models/ (models.py) # Database ORM models (CropLot, CareLog, Material, Harvest, AIInteraction, ...)
│   ├── validators/         # Kiểm tra tính hợp lệ dữ liệu đầu vào (Validation schemas)
│   ├── middlewares/        # Custom middlewares (auth, roles, error formatting)
│   ├── utils/              # Utility functions & helpers (api_response, role checkers, generator)
│   ├── management/         # Django commands (seed_demo)
│   ├── migrations/         # Database migrations
│   └── prompts/            # System & task prompts cho Gemini AI
├── manage.py
├── requirements.txt
├── .env.example
└── Dockerfile
```

## Khởi chạy Backend Local:
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 8000
```
API sẵn sàng tại: `http://127.0.0.1:8000/api/`
Tài liệu / health check: `http://127.0.0.1:8000/health/`
