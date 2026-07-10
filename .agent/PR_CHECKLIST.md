# Checklist tự kiểm tra trước khi báo hoàn thành

Agent phải tự chạy qua checklist này trước khi coi một task là xong — không đợi người review
chỉ ra.

## Kiến trúc
- [ ] Không có import ngược chiều (domain import application/infrastructure, hoặc component
      import thẳng infrastructure thay vì qua hook).
- [ ] Không có logic nghiệp vụ nằm trong `ipc/registerXxxIpc.ts` hoặc trong component `.tsx`.
- [ ] Nếu thêm tính năng mới, đã đi đúng thứ tự: domain → application → infrastructure →
      ipc/hook (xem `AGENTS.md` mục 3).

## Kích thước & trách nhiệm file
- [ ] Không file nào vừa sửa/tạo vượt ngưỡng cứng trong `FILE_SIZE_AND_SRP.md`.
- [ ] Không thêm hàm mới vào `electron/main.ts`.
- [ ] Không copy-paste logic đã tồn tại ở file khác — nếu thấy trùng lặp, trích xuất module
      dùng chung.

## Bảo mật
- [ ] Không có `exec`/`execAsync` mới với template string chứa biến động.
- [ ] Mọi path mới nhận từ input đều qua `resolvePath`/kiểm tra `isInsidePath`.
- [ ] Mọi IPC handler mới validate input bằng `isObject`/`getString` trước khi dùng.
- [ ] Nếu đụng tới sandbox/`run_command`, đã kiểm tra parity 3 hệ điều hành hoặc có
      thông báo lỗi rõ ràng khi không hỗ trợ.

## IPC contract
- [ ] Mọi API mới trong `preload.ts` có type khớp trong `src/types/electron.d.ts`.
- [ ] Response shape theo chuẩn `{ success, error } `union (trừ trường hợp có lý do rõ ràng).
- [ ] Event streaming mới có cleanup function và đường thoát (`stop`/`kill`).

## React
- [ ] Component không gọi `window.agentStudio` trực tiếp.
- [ ] Store chỉ chứa state UI thuần, entity/logic nghiệp vụ đã ở đúng lớp.
- [ ] Selector Zustand theo field cụ thể, không lấy nguyên object store.

## Test (khi có logic thuần)
- [ ] Logic trong `domain/`, `application/`, hoặc pure util (kiểu `contextCompaction.ts`) có
      thể test độc lập, không cần mock React/Electron — nếu thêm hàm loại này, ưu tiên viết
      kèm 1 test nhỏ xác nhận hành vi biên (path traversal, input rỗng, giới hạn kích thước…).

## Cuối cùng
- [ ] Đã đọc lại diff một lượt như một reviewer bên ngoài: file này có đúng MỘT lý do để tồn
      tại/thay đổi không?
