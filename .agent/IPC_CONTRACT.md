# Quy tắc hợp đồng IPC (preload ↔ main ↔ renderer)

## 1. Nguyên tắc chung

`preload.ts` là **biên giới tin cậy duy nhất** giữa renderer (không tin cậy, chạy code
React/third-party) và main process (có toàn quyền hệ thống). Mọi API expose qua
`contextBridge` phải:

1. Là một **hàm cụ thể, hẹp phạm vi** (vd: `gitCommit(path, files, message)`), không bao giờ
   expose thẳng `ipcRenderer` hoặc bất kỳ Node API nào ra `window`.
2. Có **type đầy đủ** khai báo trong `src/types/electron.d.ts` — không có API nào trong
   `preload.ts` mà thiếu type tương ứng.
3. Có **handler "mỏng"** phía main (`ipc/registerXxxIpc.ts`) — chỉ validate input rồi gọi
   đúng một use-case/service, không viết business logic ngay trong callback.

## 2. Checklist khi thêm kênh IPC mới

- [ ] Đặt tên channel theo format `domain:action` (đã dùng nhất quán: `git:commit`,
      `settings:save-provider-and-scan`, `terminal:create`) — tiếp tục theo convention này.
- [ ] Thêm hàm expose trong `contextBridge.exposeInMainWorld('agentStudio', { ... })` ở
      `preload.ts`, tham số và kiểu trả về khớp chính xác với `electron.d.ts`.
- [ ] Thêm entry tương ứng vào interface `Window.agentStudio` trong
      `src/types/electron.d.ts` — không để renderer tự suy luận kiểu qua `any`.
- [ ] Handler phía main dùng `isObject(rawPayload) ? rawPayload : {}` rồi `getString`/kiểm tra
      kiểu cho từng field trước khi dùng — không tin tưởng type IPC tại runtime.
- [ ] Handler gọi use-case trong `application/usecases/`, không tự chứa logic đọc/ghi file hay
      gọi git trực tiếp trong file `ipc/registerXxxIpc.ts`.
- [ ] Response shape nhất quán: dùng union `{ success: true, ... } | { success: false, error:
      string }` cho mọi thao tác có thể thất bại (đã dùng đúng cho các thao tác git — áp dụng
      tương tự cho settings/terminal thay vì `throw` không kiểm soát khi có thể).

## 3. Vấn đề nhất quán hiện tại cần lưu ý khi sửa

Hiện repo có 3 kiểu xử lý lỗi khác nhau giữa các handler:
- `git:*` → trả `{ success: false, error }` (tốt, giữ nguyên).
- `git:get-branch`, `git:diff` → nuốt lỗi, trả `null`/chuỗi rỗng (renderer không biết đã có
  lỗi hay thực sự không có dữ liệu).
- `settings:*`, `ai:chat:start` → `throw`, renderer phải tự bắt exception.

**Quy tắc khi sửa code cũ hoặc thêm handler mới**: chọn `{ success, error }` union làm chuẩn
mặc định. Chỉ dùng `throw`/reject khi lỗi thực sự là "không thể tiếp tục" (vd: thiếu
`requestId`) chứ không phải lỗi nghiệp vụ thông thường (vd: "chưa cấu hình provider").

## 4. Streaming/event channel (`ai:chat:*`, `terminal:*`)

- [ ] Mọi event gửi từ main → renderer qua `sender.send(channel, payload)` phải kèm định danh
      phiên (`requestId`/`terminalId`) để renderer lọc đúng listener — pattern đã đúng, giữ
      nguyên khi thêm event mới.
- [ ] Hàm `onXxx(listener)` ở `preload.ts` phải trả về **cleanup function** (`() =>
      ipcRenderer.off(...)`) — không được để renderer tự quản lý `ipcRenderer.on` trực tiếp.
- [ ] Mọi phiên streaming mới phải có đường thoát (`stop`/`kill`) tương tự
      `ai:chat:stop`/`terminal:kill`, tránh rò rỉ process/listener khi component unmount.

## 5. Renderer chỉ được chạm IPC qua một lớp

Component `.tsx` **không được** gọi `window.agentStudio.xxx()` trực tiếp. Phải qua:
- `infrastructure/ipc/agentStudioBridge.ts` — bọc `window.agentStudio`, xử lý trường hợp
  `undefined` (khi chạy ngoài Electron) tại một chỗ duy nhất, thay vì lặp lại `if
  (!window.agentStudio) throw ...` ở từng component.
- `application/hooks/useXxx.ts` — gọi bridge, expose state + action cho component.

Xem thêm `REACT_COMPONENT_STANDARDS.md`.
