# Giới hạn kích thước file & Single Responsibility

## 1. Ngưỡng số dòng theo loại file

Đây là ngưỡng **khuyến nghị / cứng** — vượt ngưỡng cứng là bắt buộc phải tách trước khi coi
task hoàn thành.

| Loại file | Khuyến nghị | Ngưỡng cứng | Khi vượt ngưỡng |
|---|---|---|---|
| React component (`.tsx`) | ≤ 150 dòng | 300 dòng | Tách sub-component hoặc rút logic ra hook |
| Custom hook (`.ts`) | ≤ 100 dòng | 150 dòng | Tách theo concern (vd: `useAgentChat` tách phần stream khỏi phần state) |
| `ipc/registerXxxIpc.ts` (main) | ≤ 80 dòng | 150 dòng | Đang có logic không thuộc "controller" → chuyển vào use-case |
| `infrastructure/*Adapter.ts` | ≤ 200 dòng | 300 dòng | Tách theo sub-concern (vd: sandbox tách theo OS) |
| `application/usecases/*.ts` | ≤ 150 dòng | 250 dòng | Use-case đang làm quá nhiều bước → tách use-case con |
| `domain/entities/*.ts` | không giới hạn cứng (thường rất ngắn) | — | Nếu > 150 dòng, khả năng đang nhét cả logic vào entity |
| Store slice (Zustand) | ≤ 150 dòng/slice | 250 dòng | Tách nhiều slice theo domain rồi compose |

## 2. Dấu hiệu nhận biết file cần tách (code smell)

- File có từ **2 lý do thay đổi trở lên** không liên quan (vd: sửa vì đổi UI VÀ sửa vì đổi
  cách gọi git — đây chính là tình trạng hiện tại của `SourceControlView.tsx` và `main.ts`).
- Component có nhiều hơn ~4-5 `useState`/`useEffect` không liên quan trực tiếp đến render.
- Một file `main.ts`/`agentRuntime.ts` chứa cả: định nghĩa type, gọi HTTP, spawn process, và
  đăng ký IPC — 4 concern trong 1 file.
- Hai file khác nhau có đoạn code gần như giống hệt nhau (copy-paste) — đây không phải vấn đề
  "file quá dài" mà là thiếu một module dùng chung.
- Tên hàm/biến phải dùng "and" để mô tả (`saveAndScan`, `formatMessagesAndValidate`) — dấu
  hiệu hàm đang làm nhiều việc.

## 3. Quy tắc tách: theo LỚP trước, theo TÍNH NĂNG sau

Khi một file vượt ngưỡng, thứ tự ưu tiên tách:

1. **Tách theo lớp Clean Architecture trước** (domain / application / infrastructure /
   presentation) — xem `CLEAN_ARCHITECTURE.md`.
2. Trong mỗi lớp, nếu vẫn còn dài, **tách theo tính năng/domain nghiệp vụ** (git, settings,
   terminal, chat, workspace).
3. Chỉ sau đó mới tách theo kỹ thuật thuần (vd: tách theo OS trong sandbox executor).

## 4. Ví dụ cụ thể trong repo này

### 4.1. `electron/main.ts` — file chúa cần tách ngay

Hiện tại 1 file chứa: bootstrap window, quản lý settings (load/save/encrypt), toàn bộ thao
tác git (7 IPC handler), toàn bộ terminal (PTY + shell detection), và khởi động agent session.

**Cách tách:**
```
ipc/registerWindowIpc.ts     → minimize/maximize/close (3 dòng logic thật)
ipc/registerSettingsIpc.ts   → gọi JsonSettingsRepository, không tự đọc/ghi file
ipc/registerGitIpc.ts        → gọi SimpleGitAdapter, không tự execAsync
ipc/registerTerminalIpc.ts   → gọi PtyTerminalManager
ipc/registerChatIpc.ts       → gọi RunAgentSessionUseCase
main.ts                      → chỉ còn: tạo window + gọi 5 hàm register ở trên
```
Kết quả: không file nào trong số này còn vượt 100-150 dòng, và mỗi file có đúng 1 lý do để
thay đổi.

### 4.2. `PromptComposer.tsx` và `ChatArea.tsx` — logic trùng lặp

Cả hai file hiện định nghĩa lại gần như y hệt: gọi `addMessage` → `clearAgentActions` →
`streamChatCompletion` với 5 callback giống nhau → cùng logic xử lý lỗi.

**Cách tách:** tạo `application/hooks/useAgentChat.ts` export ra `sendMessage(content,
attachments)` và `regenerate(messageId, content)`. Cả hai component chỉ còn gọi hook này,
không tự viết lại luồng stream.

### 4.3. `electron/agentRuntime.ts` — use-case bị trộn với infrastructure

File này vừa là vòng lặp điều phối (use-case: "chạy 1 phiên agent, tối đa N bước"), vừa là
HTTP/SSE client (`requestAssistantMessage`, `mergeToolCallDeltas`), vừa là tool executor
(`listFiles`, `readFileTool`, `runCommandTool`), vừa là sandbox builder
(`buildSeatbeltProfile`).

**Cách tách:** như mô tả ở mục 3, `CLEAN_ARCHITECTURE.md` — use-case chỉ gọi qua
`ChatCompletionPort` và `ToolExecutorPort`, không tự `fetch` hay `spawn`.

## 5. Ngoại lệ được phép

- File type định nghĩa thuần (`*.d.ts`) không tính vào ngưỡng trên.
- File cấu hình (`vite.config.ts`, `tsconfig*.json`) không tính.
- Nếu một file dài vì chứa **nhiều entity nhỏ cùng một domain** và **không có logic** (chỉ
  `type`/`interface`), có thể vượt ngưỡng nếu tách ra sẽ gây import rối hơn — nhưng phải nêu
  rõ lý do trong PR.
