# AGENTS.md — Quy tắc bắt buộc khi code trong repo AgentStudio

> File này là điểm vào duy nhất. Đọc file này trước, rồi mới lật sang các tài liệu chi tiết
> trong `docs/` khi cần. Không copy nội dung `docs/` vào đây — giữ file này ngắn để nó luôn
> được agent đọc trọn vẹn.

Repo này là app Electron + React + TypeScript có 2 tiến trình tách biệt: **main process**
(Node, thư mục `electron/`) và **renderer** (React, thư mục `src/`). Mọi quy tắc dưới đây áp
dụng cho cả hai, trừ khi ghi rõ.

## 1. Nguyên tắc cốt lõi (không thương lượng)

1. **Dependency Rule (Clean Architecture)**: lớp trong (`domain`) không được import bất cứ
   thứ gì từ lớp ngoài (`application`, `infrastructure`, `presentation`/`ipc`). Lớp ngoài phụ
   thuộc vào lớp trong qua interface (port), không bao giờ ngược lại.
   → Chi tiết: `docs/architecture/CLEAN_ARCHITECTURE.md`

2. **Một file = một lý do để thay đổi.** Nếu bạn sắp sửa một file vì hai lý do không liên
   quan nhau (ví dụ: vừa sửa logic git vừa sửa logic settings trong cùng `main.ts`), dừng lại
   và tách file trước.

3. **Cấm "file chúa" (god file).** `electron/main.ts` hiện tại là ví dụ phản-pattern (đăng ký
   IPC + lưu settings + thao tác git + quản lý terminal + spawn agent trong ~700 dòng). Không
   được thêm handler mới vào thẳng `main.ts`. Phải tạo module theo tính năng
   (`electron/ipc/registerGitIpc.ts`, v.v.) rồi import vào `main.ts`.

4. **Component React không được gọi `window.agentStudio` trực tiếp.** Phải đi qua một lớp
   adapter/hook trong `infrastructure/` hoặc `application/`.
   → Chi tiết: `docs/standards/REACT_COMPONENT_STANDARDS.md`

5. **Cấm string-interpolate biến vào lệnh shell.** Mọi lệnh chạy qua `child_process` phải
   dùng dạng mảng tham số (`execFile`, `spawn(cmd, args[])`) hoặc qua `simple-git`. Không bao
   giờ dùng template string đổ thẳng vào `exec`/`execAsync`.
   → Chi tiết: `docs/standards/SECURITY_CHECKLIST.md`

6. **Mọi kênh IPC mới** phải: có type đầy đủ trong `src/types/electron.d.ts`, validate input
   ở phía `main` (dùng `isObject`/`getString` pattern đã có), và handler phải "mỏng" — chỉ gọi
   một use-case/service, không chứa business logic trực tiếp trong callback `ipcMain.handle`.
   → Chi tiết: `docs/standards/IPC_CONTRACT.md`

7. **Giới hạn kích thước file** theo bảng trong `docs/standards/FILE_SIZE_AND_SRP.md`. Vượt
   ngưỡng nghĩa là phải tách trước khi coi task hoàn thành, không phải "để sau".

8. **Logic thuần (không phụ thuộc React/Electron)** viết dưới dạng pure function, đặt trong
   `domain/` hoặc `application/`, phải test được mà không cần mock UI hay IPC.
   `electron/contextCompaction.ts` hiện tại là ví dụ ĐÚNG cần noi theo (thuần TS, không import
   Electron/React).

## 2. Sơ đồ phụ thuộc (rút gọn)

```
presentation (React components)
      │  gọi qua hook/service
      ▼
application (use-cases, orchestration)
      │  gọi qua port/interface
      ▼
domain (entities, types, port interfaces — KHÔNG import gì cả)
      ▲
      │  implement port
infrastructure (IPC thật, fs, git, spawn, fetch, sandbox)
```

`ipc/registerXxxIpc.ts` phía main process đóng vai trò **controller**: nhận request từ
renderer, gọi use-case, trả kết quả. Không tự chứa business logic.

## 3. Việc PHẢI làm mỗi khi thêm tính năng mới

1. Xác định tính năng thuộc domain nào (git, settings, chat, terminal, workspace…).
2. Định nghĩa/entity thuần trong `domain/` nếu chưa có.
3. Viết logic điều phối trong `application/usecases/`, phụ thuộc vào port interface, không
   phụ thuộc trực tiếp Node API hay React.
4. Cài đặt port đó trong `infrastructure/` (đây mới là nơi được phép gọi `fs`, `spawn`,
   `fetch`, `simple-git`, `window.agentStudio`…).
5. Nối dây ở biên: `ipc/registerXxxIpc.ts` (main) hoặc hook trong `application/hooks/`
   (renderer).
6. Kiểm tra lại kích thước file vừa sửa/tạo so với `docs/standards/FILE_SIZE_AND_SRP.md`.
7. Chạy qua `docs/standards/SECURITY_CHECKLIST.md` nếu tính năng đụng tới: shell command, file
   path từ input người dùng/agent, hoặc dữ liệu gửi ra ngoài (API provider).
8. Tự kiểm tra bằng `docs/standards/PR_CHECKLIST.md` trước khi báo hoàn thành.

## 4. Tuyệt đối không được làm

- Không thêm hàm mới vào `electron/main.ts` — chỉ được import các `registerXxxIpc()`.
- Không gọi `window.agentStudio.*` trong component `.tsx` — phải qua hook/adapter.
- Không dùng `exec`/`execAsync` với template string chứa biến động (path, tên file, tên
  branch…) — dùng `execFile` hoặc `simple-git`.
- Không truyền `process.env` nguyên vẹn vào tiến trình con do agent điều khiển — phải lọc qua
  allowlist rõ ràng.
- Không nhân đôi logic (ví dụ: không copy-paste luồng gửi tin nhắn giữa `PromptComposer.tsx`
  và `ChatArea.tsx` — dùng chung một hook).
- Không thêm field/type mới vào `useAppStore.ts` nếu nó không phải state UI thuần — business
  entity thuộc về `domain/entities/`.

## 5. Tài liệu chi tiết

| Tài liệu | Nội dung |
|---|---|
| `docs/architecture/CLEAN_ARCHITECTURE.md` | Sơ đồ lớp đầy đủ, cấu trúc thư mục đích, bảng ánh xạ file hiện tại → vị trí mới |
| `docs/standards/FILE_SIZE_AND_SRP.md` | Ngưỡng số dòng theo loại file, dấu hiệu cần tách, ví dụ before/after |
| `docs/standards/SECURITY_CHECKLIST.md` | Checklist bắt buộc cho shell command, path, sandbox, IPC input |
| `docs/standards/IPC_CONTRACT.md` | Quy tắc cho ranh giới preload/main/renderer |
| `docs/standards/REACT_COMPONENT_STANDARDS.md` | Quy tắc component, hook, store selector |
| `docs/standards/PR_CHECKLIST.md` | Checklist tự kiểm tra trước khi merge |
