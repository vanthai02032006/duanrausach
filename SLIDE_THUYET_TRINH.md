# SLIDE THUYẾT TRÌNH BẢO VỆ ĐỒ ÁN GREENFARM AI

> **Học phần**: Ứng dụng Trí tuệ Nhân tạo (AIA331) - Lớp 80292
> **Đề tài**: Hệ thống Quản lý Trang trại Rau sạch có tích hợp AI
> **Giảng viên hướng dẫn**: TS. Nguyễn Tuấn Anh
> **Sinh viên thực hiện**:
> * Cấn Văn Thái - MSV: DTC245200867
> * Hoàng Anh Tú - MSV: DTC245200321

---

## Slide 1: ĐẠI HỌC THÁI NGUYÊN — TRƯỜNG ĐH CÔNG NGHỆ TT&TT

Học phần: ỨNG DỤNG TRÍ TUỆ NHÂN TẠO (AIA331) — GV: TS. Nguyễn Tuấn Anh

HỆ THỐNG QUẢN LÝ TRANG TRẠI RAU SẠCH

CÓ TÍCH HỢP TRÍ TUỆ NHÂN TẠO (GreenFarm AI)

> **🎤 Sinh viên thực hiện (nhóm 2 thành viên):**
> **🎤 Cấn Văn Thái — DTC245200867  •  Hoàng Anh Tú — DTC245200321**
Lớp: K23.K1.CNTT K23C

Công nghệ: Django 5.x + React 18 + PostgreSQL 16 + Gemini AI + Docker

Thái Nguyên, 2026


---

## Slide 2: NỘI DUNG THUYẾT TRÌNH

02

GreenFarm AI — Hệ thống quản lý trang trại rau sạch tích hợp AI

Nhóm SV: Thái & Tú

1

1. Giới thiệu đề tài & vấn đề

Bối cảnh, hạn chế hệ thống hiện tại

2

2. Giải pháp & chức năng

Quản lý + 4 tác vụ AI + Chatbot RAG

3

3. Kiến trúc & CSDL

3 tầng, Docker 3 container, 11 bảng (3NF)

4

4. Tích hợp AI & Prompt

RAG kho tri thức, 3 vòng tối ưu prompt

5

5. Giao diện & Demo

14 màn hình React, QR truy xuất

6

6. Kiểm thử & Triển khai

37 TC hộp đen, Docker, AI Monitor

7

7. Kết quả, hạn chế & hướng phát triển


---

## Slide 3: 1. VẤN ĐỀ & ĐỘNG LỰC

03

GreenFarm AI — Hệ thống quản lý trang trại rau sạch tích hợp AI

Nhóm SV: Thái & Tú

Hiện trạng trang trại rau sạch

▸  Quản lý bằng sổ sách / Excel

▸  Khó theo dõi lịch chăm sóc từng lô

▸  Không có truy xuất nguồn gốc

▸  Thống kê, tính doanh thu thủ công

▸  Nhân viên mới thiếu kinh nghiệm

Hạn chế & nhu cầu

▸  Khiếu nại khách hàng → không truy xuất được

▸  Vật tư thiếu kiểm soát tồn kho

▸  Thiếu kho tri thức chia sẻ kinh nghiệm

▸  Cần hỗ trợ AI cho nhân viên mới

▸  Cần số hóa toàn bộ quy trình

→ GIẢI PHÁP: GreenFarm AI

▸  Số hóa quản lý: lô, giống, nhật ký, vật tư, thu hoạch, bán hàng, truy xuất QR

▸  Tích hợp AI tạo sinh (Gemini): 4 tác vụ + Chatbot RAG kho tri thức, cảnh báo "chỉ tham khảo"

▸  API-first: Django REST + React SPA + PostgreSQL + Docker


---

## Slide 4: 2. GIẢI PHÁP TỔNG QUAN

04

GreenFarm AI — Hệ thống quản lý trang trại rau sạch tích hợp AI

Nhóm SV: Thái & Tú

FRONTEND — React 18 + Vite

14 màn hình, Chatbot widget, quét QR camera

BACKEND — Django 5.x REST

14 controllers, 6 services, 32 API endpoints, RBAC 3 vai trò

DỮ LIỆU & AI — PostgreSQL 16 + Gemini

11 bảng (3NF), RAG kho tri thức, 4 tác vụ AI + Chatbot

3 vai trò RBAC: Manager (Quản lý) • Technician (Kỹ thuật) • Staff (Nhân viên) — Truy xuất QR công khai


---

## Slide 5: 2.1. CHỨC NĂNG QUẢN LÝ

05

GreenFarm AI — Hệ thống quản lý trang trại rau sạch tích hợp AI

Nhóm SV: Thái & Tú

Sản xuất

▸  Quản lý 23 lô & 15 giống cây

▸  Lịch chăm sóc (todo) + Nhật ký (done)

▸  6 loại hoạt động: tưới, bón, sâu bệnh...

▸  Vật tư: xuất kho an toàn (atomic)

Thu hoạch & Bán hàng

▸  Nghiệm thu chất lượng (Pass/Review)

▸  Tự sinh mã QR VietGAP GF-XXXXXX

▸  In tem nhãn, thu hồi mã khi sự cố

▸  Phiếu bán hàng, tính doanh thu

Truy xuất & Báo cáo

▸  Quét QR → hồ sơ trồng trọt đầy đủ

▸  Thẻ xanh/vàng/đỏ theo chất lượng

▸  Dashboard KPI thời gian thực

▸  Báo cáo sản lượng, doanh thu theo kỳ

Điểm nổi bật về kỹ thuật

▸  @transaction.atomic chống âm kho vật tư • Quy tắc 11 chống hallucination trong prompt

▸  AI Monitor: độ trễ (latency), tỷ lệ thành công, feedback người dùng • 4 bộ test: unit, API, trace, chat

▸  32 REST API endpoints chuẩn JSON {success, data, message}


---

## Slide 6: 2.2. CHỨC NĂNG AI (Gemini + RAG)

06

GreenFarm AI — Hệ thống quản lý trang trại rau sạch tích hợp AI

Nhóm SV: Thái & Tú

AI1

AI1: Sinh lịch chăm sóc

Input: giống + ngày gieo + RAG → lịch theo tuần + cảnh báo

AI2

AI2: Tóm tắt nhật ký

Input: nhật ký lô + RAG → tóm tắt + checklist tuần tới

AI3

AI3: Gợi ý kiểm tra

Input: các lô + nhật ký gần nhất → lô cần kiểm tra + lý do

AI4

AI4: Gợi ý thu hoạch

Input: lô sắp đến kỳ → đề xuất thời điểm & chất lượng tham khảo

AI5

AI5: Chatbot đa vòng

Câu hỏi + lịch sử 6 vòng + dữ liệu PostgreSQL + Kho tri thức → trả lời có dẫn nguồn


---

## Slide 7: 3. KIẾN TRÚC HỆ THỐNG (Docker 3 container)

07

GreenFarm AI — Hệ thống quản lý trang trại rau sạch tích hợp AI

Nhóm SV: Thái & Tú

greenfarm_frontend

Nginx + React SPA build
Cổng 3000

greenfarm_backend

Django 5.x + Gunicorn
Cổng 8000 • 14 controllers
6 services • 32 API

greenfarm_postgres

PostgreSQL 16 Alpine
Cổng 5432
Persistent Volume

→

→

☁ Gemini API (Cloud)

gemini-3.5-flash-lite
RAG grounded context

↕

Người dùng (3 vai trò) ↔ Nginx :3000 ↔ Django :8000 ↔ PostgreSQL :5432 ↔ Gemini API • QR truy xuất công khai

Đặc điểm: API-first JSON • CORS • Session + RBAC • Whitenoise static • docker-compose orchestration


---

## Slide 8: 3.1. THIẾT KẾ CSDL (11 bảng — 3NF)

08

GreenFarm AI — Hệ thống quản lý trang trại rau sạch tích hợp AI

Nhóm SV: Thái & Tú

auth_user + auth_group

Người dùng & nhóm quyền

crop_varieties

Giống cây (tên KH, ngày sinh trưởng)

crop_lots

Lô trồng (variety, ngày gieo, 4 trạng thái)

care_logs

Nhật ký (6 loại, todo/done)

materials

Vật tư (5 nhóm, đơn giá, hạn dùng)

material_usages

Phiếu sử dụng vật tư

harvests

Thu hoạch (mã QR GF-XXXXXX, thu hồi)

sales

Bán hàng (tính total_price)

knowledge_articles

Kho tri thức RAG (is_verified)

ai_interactions

Nhật ký AI (latency, feedback)

chat_conversations/messages

Chatbot đa vòng + đánh giá


---

## Slide 9: 4. TÍCH HỢP AI & THIẾT KẾ PROMPT (3 vòng tối ưu)

09

GreenFarm AI — Hệ thống quản lý trang trại rau sạch tích hợp AI

Nhóm SV: Thái & Tú

V1 — Cơ bản

"Tóm tắt nhật ký sau" → Output tự do, khó parse, đôi khi hallucination

V2 — + System Prompt + JSON

Thêm system prompt 5 phần + JSON schema + ràng buộc "chỉ dùng dữ liệu cung cấp" → định dạng ổn định

V3 (cuối) — + RAG + Few-shot

Thêm truy xuất kho tri thức (grounded) + few-shot + cảnh báo tham khảo + lưu context_sources → không bịa, có dẫn nguồn

Cơ chế RAG: farm_context_service truy xuất dữ liệu thật PostgreSQL + Kho tri thức (is_active) → inject vào prompt → AI trả lời có dẫn nguồn, giảm hallucination. Mọi gọi AI lưu AIInteraction (prompt_version=v3.0, latency_ms, feedback).


---

## Slide 10: 5. GIAO DIỆN & DEMO THỰC TẾ

10

GreenFarm AI — Hệ thống quản lý trang trại rau sạch tích hợp AI

Nhóm SV: Thái & Tú


---

## Slide 11: 6. KIỂM THỬ & ĐẢM BẢO CHẤT LƯỢNG

11

GreenFarm AI — Hệ thống quản lý trang trại rau sạch tích hợp AI

Nhóm SV: Thái & Tú

Kiểm thử hộp đen (37 TC)

▸  3 kỹ thuật: Phân vùng tương đương (EP), Giá trị biên (BVA), Suy đoán lỗi

▸  Bao phủ: đăng nhập, nhật ký, vật tư, thu hoạch, bán hàng, phân quyền, truy xuất, AI

▸  4 bộ test tự động: tests.py (unit), tests_api (API+RBAC), tests_trace (QR+Quy tắc 2), tests_chat (chatbot+RAG)

▸  Review code bằng AI: phát hiện thiếu phân quyền 1 endpoint, truy vấn chưa tối ưu → đã sửa

Kiểm thử AI & Bảo mật

▸  AI01: dữ liệu đầy đủ → JSON đúng + cảnh báo

▸  AI02: nhật ký trống → báo "chưa đủ dữ liệu", không bịa

▸  AI03: dụ AI cam kết chuyên môn → AI từ chối

▸  AI04: API lỗi/timeout → báo thân thiện, không crash

▸  Bảo mật: Session+RBAC, API key trong .env, ORM chống SQLi, template chống XSS

Đạo đức AI & HITL (Human-in-the-Loop)

▸  AI chỉ đề xuất, KHÔNG tự ghi đè dữ liệu • Mọi output kèm cảnh báo "chỉ tham khảo, cần chuyên gia kiểm chứng"

▸  Chỉ gửi dữ liệu cần thiết cho AI, không gửi mật khẩu/khách hàng • AI Monitor đo lường chất lượng & thu thập feedback


---

## Slide 12: 6.1. TRIỂN KHAI & VẬN HÀNH

12

GreenFarm AI — Hệ thống quản lý trang trại rau sạch tích hợp AI

Nhóm SV: Thái & Tú

Docker Deployment

▸  docker-compose.yml: 3 container đồng thời

▸  PostgreSQL 16 Alpine (Persistent Volume)

▸  Backend Django + Gunicorn (Python 3.12 Slim)

▸  Frontend: Nginx phục vụ React build + reverse proxy /api/

▸  Khuyến nghị triển khai Render / Railway / VPS

Hiệu năng & Sao lưu

▸  API response < 2s (đo qua AI Monitor)

▸  AI lỗi không làm sập hệ thống (retry + circuit breaker đơn giản)

▸  Sao lưu: pg_dump định kỳ hàng ngày

▸  Khôi phục: pg_restore từ bản sao lưu

▸  AI Monitor: tỷ lệ thành công, độ trễ TB → tối ưu prompt

Kết quả đạt được

▸  Hoàn thiện đầy đủ: quản lý + bán hàng + truy xuất QR + thu hồi mã + 4 tác vụ AI + Chatbot RAG + AI Monitor

▸  RAG kho tri thức giảm hallucination • 37 test case hộp đen + 4 bộ test tự động • Minh chứng AI trong mọi giai đoạn SDLC


---

## Slide 13: 7. KẾT QUẢ, HẠN CHẾ & HƯỚNG PHÁT TRIỂN

13

GreenFarm AI — Hệ thống quản lý trang trại rau sạch tích hợp AI

Nhóm SV: Thái & Tú

Kết quả đạt được

▸  Hệ thống chạy đầy đủ chức năng

▸  4 tác vụ AI + Chatbot RAG

▸  QR truy xuất + thu hồi mã

▸  37 TC hộp đen + test tự động

▸  Báo cáo 8 chương + sơ đồ UML

Hạn chế

▸  Chưa tích hợp cảm biến IoT

▸  Kho tri thức còn cơ bản, cần chuyên gia kiểm chứng (is_verified)

▸  Chatbot phụ thuộc tốc độ Gemini

▸  Mới hỗ trợ tiếng Việt

Hướng phát triển

▸  Tích hợp IoT cảm biến (độ ẩm, nhiệt)

▸  Agentic AI: tự ghi nhật ký, tự đặt lịch

▸  Ứng dụng mobile cho nhân viên

▸  Thanh toán online + theo dõi vận chuyển

▸  Mở rộng đa trang trại

Bài học áp dụng AI trong SDLC

▸  AI tăng tốc code lặp lại, tài liệu, test case — nhưng có thể sinh lỗ hổng bảo mật, hallucination, đề xuất vượt phạm vi

▸  Nguyên tắc vàng: AI đề xuất, con người kiểm chứng & chịu trách nhiệm (HITL) • Luôn yêu cầu AI trích dẫn nguồn (RAG)


---

## Slide 14: CẢM ƠN THẦY CÔ

Đã quan tâm & hướng dẫn nhóm chúng em


---
