# Quy tắc component React & hook

## 1. Component chỉ được làm 2 việc: render UI và gọi hook

Component **không** được:
- Gọi trực tiếp `window.agentStudio.*` (xem `IPC_CONTRACT.md` mục 5).
- Chứa logic nghiệp vụ nhiều bước (vd: luồng gửi tin nhắn → stream → cập nhật state → xử lý
  lỗi hiện đang lặp lại y hệt trong `PromptComposer.tsx` và `ChatArea.tsx`).
- Tự parse/transform dữ liệu phức tạp inline trong JSX (vd: `parseAgentContent`,
  `parseDiff` trong `SourceControlView.tsx` — các hàm thuần này nên nằm ở
  `application/` hoặc `domain/`, không định nghĩa ngay trong file component, để có thể
  unit-test độc lập với React).

Component **được phép**:
- Gọi `useAppStore` selector để đọc/ghi state UI thuần.
- Gọi custom hook (`application/hooks/useXxx.ts`) để lấy data + action đã đóng gói.
- Chứa logic hiển thị đơn giản (điều kiện render, format ngày giờ ngắn gọn).

## 2. Quy tắc tách hook khỏi component

Khi một component có **≥ 3 side-effect không liên quan trực tiếp đến render** (fetch data,
subscribe event, quản lý session), tách ra custom hook riêng.

Ví dụ cụ thể trong repo:

| Component hiện tại | Logic cần tách | Hook đích |
|---|---|---|
| `PromptComposer.tsx` + `ChatArea.tsx` | luồng gửi tin nhắn/regenerate, quản lý stream | `useAgentChat()` ✅ đã có |
| `TerminalView.tsx` | tạo PTY session, resize, cleanup | `useTerminalSession(shellId)` |
| `SettingsView.tsx` | load settings, save provider, fetch models | `useSettings()` (roadmap) |
| `TopAppBar.tsx` | fetch current branch | `useGitStatus()` ✅ đã có |

Hook trả về `{ data, isLoading, error, actions: {...} }` — component chỉ destructure và
render, không tự quản lý `useState`/`useEffect` cho cùng một concern ở nhiều nơi.

## 3. Store (Zustand) chỉ chứa state UI thuần

`useAppStore.ts` hiện đang trộn 3 loại state khác nhau:
1. State UI thuần (đúng chỗ): `isSidebarOpen`, `isTerminalOpen`, `activeView`.
2. Business entity (nên tách sang `domain/entities/`): định nghĩa `Message`, `Attachment`,
   `ChatThread`, `AIProvider`.
3. Business logic (nên tách sang `application/`): `syncThread`, `replaceUserMessageAndTrim`,
   `appendAgentThoughtChunk` — đây là logic nghiệp vụ (điều phối thread/message), không phải
   state UI đơn thuần.

**Quy tắc khi sửa store:**
- [ ] Type mới thêm vào store phải là entity nghiệp vụ → đặt ở `domain/entities/`, import vào
      store, không định nghĩa `interface`/`type` trực tiếp trong file store.
- [ ] Action mới có > 1 bước biến đổi dữ liệu phức tạp → cân nhắc đưa logic vào
      `application/`, action trong store chỉ gọi `set()` với kết quả đã tính sẵn.
- [ ] Nếu store vượt ngưỡng trong `FILE_SIZE_AND_SRP.md`, tách theo domain: `chatSlice`,
      `settingsSlice`, `uiSlice`, `threadSlice`, compose lại bằng cách gộp state/action (không
      bắt buộc dùng middleware `combine` của Zustand, có thể gộp thủ công miễn giữ mỗi slice
      trong 1 file riêng).

## 4. Selector — giữ nguyên pattern đang làm tốt

Repo hiện dùng đúng cách: `useAppStore((s) => s.settings)` thay vì lấy nguyên object store —
tránh re-render thừa. **Tiếp tục pattern này** khi thêm state mới: luôn subscribe theo field
cụ thể, không destructure toàn bộ store trong 1 dòng (`const { a, b, c } = useAppStore()`)
trừ khi cả 3 field chắc chắn luôn thay đổi cùng lúc.

## 5. Props

- Không truyền nhiều hơn ~6 props riêng lẻ — nếu vượt, gom thành 1 object có type rõ ràng từ
  `domain/entities/`.
- Callback prop đặt tên `onXxx`, nhận đúng entity domain làm tham số (như
  `onRegenerate: (message: Message, content: string) => void` trong `ChatArea.tsx` — đúng
  chuẩn, giữ nguyên).
