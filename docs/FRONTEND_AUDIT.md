# Kiểm kê và quyết định chuyển đổi

Đã đọc toàn bộ `README.md`, 4 HTML và DESIGN.md. Không có `README_UPDATED.md` trong bộ nguồn. Quyết định trong yêu cầu đính kèm được ưu tiên hơn README cũ.

## Tệp nguồn

| Thư mục | Tệp | Nội dung |
| --- | --- | --- |
| personal_payment_tracking_system_dashboard | code.html, screen.png | Tổng quan, KPI, bảng gần đây, lịch sử và nhắc việc mẫu |
| qu_n_l_t_ch_c_paytrack | code.html, screen.png | Bảng đơn vị, tìm kiếm, modal thêm đơn vị |
| qu_n_l_kho_n_thu_minimalist_paytrack | code.html, screen.png | Bảng khoản thu, bộ lọc, nút sửa/đánh dấu nhận |
| b_o_c_o_ph_n_t_ch_t_i_ch_nh_paytrack | code.html, screen.png | Tổng hợp, biểu đồ, modal xuất báo cáo |
| warm_financial_atelier | DESIGN.md | Màu, typography, spacing và hướng dẫn thiết kế |

Tổng: **4 HTML, 4 PNG, 1 Markdown**. Không có CSS/JS/font/icon nhị phân riêng. CSS và JavaScript nhúng trong HTML. Font Google Fonts: Be Vietnam Pro, Plus Jakarta Sans; Material Symbols được gọi lặp nhiều lần. Dashboard dùng SVG inline; PNG là ảnh chụp tham chiếu, không phải ảnh nghiệp vụ. Tailwind được nạp bằng CDN runtime ở cả bốn màn hình. `scripts/audit.cjs` đọc toàn bộ HTML để liệt kê văn bản, scripts và liên kết.

## Đánh giá

| Phần | Quyết định | Lý do |
| --- | --- | --- |
| PayTrack, sắc cam, nền sáng, điều hướng trái | Giữ, tinh chỉnh | Nhận diện và cấu trúc đã phù hợp ứng dụng quản lý |
| Bốn màn hình, KPI, bảng, bộ lọc và luồng dialog | Chuyển thành Next.js/React | Dùng component TypeScript dùng chung và dữ liệu WebSocket thật |
| Font Be Vietnam Pro | Giữ, tự host bằng npm | Hỗ trợ dấu tiếng Việt; bỏ phụ thuộc CDN khi chạy |
| Material Symbols, SVG phân tán | Chuyển sang Lucide | Đồng nhất nét và kích thước, không cần tải font icon |
| Header/sidebar bị lặp và kích thước desktop cố định | Chỉnh | Một shell chung, mobile có thanh điều hướng dưới và bảng cuộn trong vùng riêng |
| Tổng doanh thu, ngân hàng, thuế, quá hạn, Pending, chi tiền | Loại | Không thuộc nghiệp vụ hai trạng thái PAID/UNPAID |
| Xuất Excel/PDF/JSON, email nhắc nợ, cài đặt, trợ giúp giả | Loại | Không có backend; nút export báo thành công bằng alert dù không sinh file |
| Biểu đồ năm 2024, tỷ lệ tăng trưởng, tín nhiệm, ngân hàng | Loại | Toàn bộ là số liệu viết cố định hoặc suy diễn ngoài phạm vi |
| Bảng báo cáo theo đơn vị/tháng | Giữ và nối dữ liệu thật | Hỗ trợ đối chiếu trực tiếp, không cần biểu đồ trang trí |
| Script thay class/DOM, onclick và parseFloat tính tiền | Thay | React state; backend Decimal làm tròn HALF_UP; preview frontend dùng BigInt |
| Login và sao lưu SQLite | Bổ sung | Yêu cầu bắt buộc mới; backup là tác vụ I/O thật trong thread pool |

## Lỗi tìm được trong nguồn

- Các mục sidebar dùng `href="#"`; dashboard có `#details`, không có hệ thống route thật.
- Màn hình khoản thu gọi `addReceivableModal` và `markPaidModal` nhưng không có các dialog tương ứng trong tài liệu.
- Submit form đơn vị chỉ đóng modal, không lưu dữ liệu.
- Bộ lọc, phân trang, chọn kiểu bảng/thẻ và nhiều nút chi tiết/sửa chưa nối nghiệp vụ.
- Báo cáo đổi tháng/quý bằng đổi class nút, không tính lại thống kê.
- Font icon được khai báo lặp, scrollbar bị ẩn toàn cục, select-none cản sao chép số liệu; một màn hình có width/height cố định và overflow hidden.
- Các tổng, số lượng dòng và trạng thái ở nhiều màn hình không khớp nhau.

Thư mục `stitch_javafx_payment_tracker_dashboard/` được giữ nguyên. Không dùng iframe hoặc dangerouslySetInnerHTML để chuyển đổi.

Cập nhật 03/11/2026: theo yêu cầu tiếp theo của chủ dự án, font giao diện đã đổi từ Be Vietnam Pro sang Inter (tự host). Các nhận xét giữ font phía trên ghi lại quyết định chuyển đổi ban đầu.

