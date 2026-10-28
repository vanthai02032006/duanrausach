# Test plan — GreenFarm AI

## Kiểm thử chức năng nghiệp vụ

| ID | Trường hợp | Kết quả mong đợi |
|---|---|---|
| LOT-01 | Quản lý thêm lô với mã duy nhất, diện tích dương | Lô lưu trong DB, xuất hiện ở danh sách và dashboard. |
| LOT-02 | Tạo lô với mã trùng | Form từ chối lưu, có thông báo lỗi. |
| LOT-03 | Ngày thu hoạch dự kiến trước ngày gieo | Form hiển thị validation error, DB không thay đổi. |
| LOT-04 | Nhân viên thử mở URL sửa lô | Backend từ chối quyền và chuyển hướng về dashboard. |
| CARE-01 | Ghi nhật ký có lô, hoạt động và ghi chú | Bản ghi liên kết đúng lô, người tạo và thời điểm. |
| MAT-01 | Sử dụng lượng vật tư nhỏ hơn tồn kho | Transaction tạo phiếu và giảm tồn kho đúng số lượng. |
| MAT-02 | Dùng nhiều hơn tồn kho | Validation từ chối; không tạo phiếu và không đổi tồn kho. |
| HARV-01 | Ghi phiếu thu hoạch | Tạo mã truy xuất duy nhất và cập nhật trạng thái lô đã thu hoạch. |
| TRACE-01 | Tra mã lô hoặc mã truy xuất thu hoạch | Hiển thị giống, nhật ký, vật tư và các phiếu thu hoạch đã ghi. |
| SALE-01 | Bán vượt số lượng còn lại của phiếu thu hoạch | Form từ chối số lượng bán vượt mức. |

## Kiểm thử phân quyền

| ID | Vai trò | Hành động | Kết quả mong đợi |
|---|---|---|---|
| RBAC-01 | Quản lý | Quản lý tài khoản/đổi vai trò/giám sát AI | Truy cập được. |
| RBAC-02 | Kỹ thuật viên | Quản lý tài khoản | Không được truy cập. |
| RBAC-03 | Nhân viên | Mở trang giám sát AI hoặc kho tri thức | Không được truy cập. |
| RBAC-04 | Nhân viên | Ghi nhật ký của chính mình | Được phép. |
| RBAC-05 | Nhân viên | Sửa nhật ký của người khác | Không được phép. |

## Kiểm thử AI

| ID | Trường hợp | Kết quả mong đợi |
|---|---|---|
| AI-01 | Gemini API key được cấu hình, lô có nhật ký | Gọi Gemini từ backend, hiển thị output và nguồn ngữ cảnh đã truy xuất. |
| AI-02 | Không có key | Hiển thị thông báo cấu hình, ghi nhận lượt thất bại, không giả kết quả. |
| AI-03 | Gemini timeout/API error | Có fallback an toàn, không làm crash trang và không cập nhật dữ liệu nghiệp vụ. |
| AI-04 | Output rỗng | Đánh dấu lỗi; hiển thị hướng xử lý. |
| AI-05 | Không có nhật ký | Prompt/context phải nói rõ thiếu dữ liệu, không được bịa hoạt động đã làm. |
| AI-06 | Prompt injection trong ghi chú | System prompt yêu cầu coi ghi chú là dữ liệu không tin cậy; không bỏ qua ràng buộc. |
| AI-07 | Người dùng đánh giá output | Feedback gắn với đúng interaction; không thể đánh giá interaction của người khác trừ quản lý. |

## Trước khi nộp

- Chạy `python manage.py check`, `python manage.py makemigrations --check --dry-run`, `python manage.py migrate`.
- Chạy unit/integration tests khi môi trường đã cài Django dependencies.
- Thực hiện các vai trò demo độc lập; chụp bằng chứng.
- Chạy test prompt trên dữ liệu mẫu ít nhất 3 vòng, lưu nguyên prompt, output, đánh giá và quyết định sửa.
- Kiểm tra `.env` không nằm trong Git; rà soát secret, CSRF, quyền truy cập, backup và log.
