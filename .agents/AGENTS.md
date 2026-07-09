# Global Agent Rules

## Testing Requirement
Luôn luôn phải test lại xem mã nguồn vừa sửa hoặc viết mới có bị lỗi không trước khi kết thúc công việc. 
- Chạy các lệnh kiểm tra lỗi (ví dụ: `npm run build`, `tsc --noEmit`, chạy test runner, hoặc khởi động ứng dụng để kiểm tra log) để đảm bảo không có lỗi cú pháp hay logic nào.
- Nếu phát hiện lỗi, bắt buộc phải tự động tìm hiểu nguyên nhân và sửa tiếp. 
- Chỉ khi nào hoàn toàn hết lỗi thì mới được tính là hoàn thành công việc và thông báo cho người dùng.
