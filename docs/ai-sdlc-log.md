# Nhật ký sử dụng AI trong SDLC (mẫu minh chứng)

> Đây là mẫu nhật ký cần sinh viên điền thêm ảnh chụp/đường dẫn các phiên làm việc AI thực tế. Không tuyên bố các prompt dưới đây đã được gửi đến model để sinh code; chúng là hồ sơ thiết kế và kiểm chứng đề xuất.

| Pha SDLC | Mục đích dùng AI | Prompt minh họa | Cách kiểm chứng/chỉnh sửa của sinh viên |
|---|---|---|---|
| Phân tích | Bóc tách vai trò, chức năng và điều kiện nghiệm thu | “Từ mô tả trang trại, phân nhóm yêu cầu chức năng/phi chức năng cho Quản lý, Kỹ thuật viên, Nhân viên; chỉ rõ dữ liệu đầu vào, xử lý, đầu ra và điều kiện biên.” | So với đề bài AIA331; thêm yêu cầu truy xuất theo lô, phân quyền ở backend và cảnh báo AI tham khảo. |
| Thiết kế | Lập ERD và kiến trúc 5 tầng | “Thiết kế mô hình dữ liệu lô trồng, giống cây, nhật ký, vật tư, thu hoạch, bán hàng, kho tri thức và nhật ký AI; nêu PK/FK, ràng buộc và lựa chọn kiến trúc.” | Review lại FK, uniqueness, không xóa lô có phiếu thu hoạch; phân biệt dữ liệu nghiệp vụ với prompt/context. |
| Prompt | Thiết kế prompt theo 5 thành phần | “Viết system prompt và user prompt cho tác vụ tóm tắt nhật ký; bắt buộc nêu căn cứ dữ liệu, dữ liệu thiếu, output format và cảnh báo kiểm chứng chuyên môn.” | Tách prompt khỏi code; thêm chống prompt injection và cấm tự bịa thời tiết/liều lượng. |
| Code | Hỗ trợ viết CRUD/form/validation | “Tạo Django ModelForm cho lô trồng, kiểm tra ngày thu hoạch không trước ngày gieo; có lỗi tiếng Việt dễ hiểu.” | Kiểm tra lại `clean()`, trường được phép sửa, CSRF và kiểm tra quyền ở view; không chấp nhận code mù. |
| Test | Sinh trường hợp biên | “Đề xuất test case cho tồn kho không đủ, mã lô trùng, tài khoản sai vai trò, thiếu nhật ký, Gemini timeout và response rỗng.” | Chuyển thành `docs/test-plan.md`; thực thi bằng TestCase/manual test và lưu kết quả thực tế trước khi nộp. |
| Review / Ops | Review bảo mật và độ ổn định | “Review endpoint gọi Gemini: phát hiện khả năng lộ API key, lạm dụng prompt injection, gọi quá hạn mức, kết quả rỗng và quyền truy xuất dữ liệu.” | API key chỉ ở server `.env`; giới hạn input; không tự động thực thi; theo dõi model, latency, status và feedback. |

## Mẫu ghi nhận một vòng thực nghiệm

- Ngày/phiên bản:
- Mục tiêu:
- Prompt đã gửi (lưu nguyên văn):
- Kết quả model (lưu nguyên văn, che dữ liệu nhạy cảm):
- Lỗi/điểm chưa phù hợp:
- Chỉnh sửa của sinh viên:
- Test đã chạy và kết quả:
- Quyết định giữ/sửa/bỏ và lý do:
