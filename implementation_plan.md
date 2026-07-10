# Kế hoạch Tái cấu trúc Clean Architecture

Dự án hiện tại đang vi phạm nhiều quy tắc trong `.agent/CLEAN_ARCHITECTURE.md` (đặc biệt là lỗi "God File" ở `main.ts` và việc gọi trực tiếp `window.agentStudio` trong các file UI). 

Do khối lượng công việc tái cấu trúc (refactor) rất lớn và đụng chạm tới toàn bộ các chức năng cốt lõi (Git, Terminal, Chat, Settings), tôi đề xuất chia quá trình này thành **4 Giai đoạn (Phases)**. Chúng ta sẽ làm từng giai đoạn, chạy thử kỹ càng rồi mới sang giai đoạn tiếp theo để tránh làm hỏng dự án.

---

## Proposed Changes (Chi tiết các giai đoạn)

### Giai đoạn 1: Chuẩn hóa Frontend Bridge (Renderer)
Mục tiêu: Loại bỏ hoàn toàn sự phụ thuộc trực tiếp vào `window.agentStudio` trong các Component React, tuân thủ quy tắc số 4 trong `AGENTS.md`.

#### [NEW] `src/infrastructure/ipc/agentStudioBridge.ts`
- Tạo file bridge wrap lại toàn bộ các phương thức của `window.agentStudio`.
- Export một object (ví dụ: `AgentBridge`) chứa các hàm bọc lại IPC để toàn bộ app gọi qua đây.

#### [NEW] `src/domain/entities/*`
- Tách các interface/type (Message, Settings, Thread, AIProvider...) đang nằm lộn xộn trong `src/store/useAppStore.ts` ra thành các file định nghĩa riêng lẻ.

#### [MODIFY] `src/components/*.tsx` (App, TopAppBar, SourceControlView, SettingsView,...)
- Thay thế toàn bộ lời gọi `window.agentStudio.*` thành import `AgentBridge.*` từ lớp infrastructure.

---

### Giai đoạn 2: Tối ưu UI Logic & Custom Hooks (Renderer)
Mục tiêu: Đưa business logic ra khỏi giao diện, giảm tải cho `useAppStore.ts` và các file UI.

#### [NEW] `src/application/hooks/*`
- Tạo `useAgentChat.ts`: Gom logic gửi tin nhắn (hiện đang bị duplicate giữa `PromptComposer.tsx` và `ChatArea.tsx`).
- Tạo `useGitStatus.ts` và `useBranches.ts`: Gom logic Git đang nằm ở `SourceControlView.tsx` và `BranchManagerModal.tsx`.

#### [MODIFY] `src/store/useAppStore.ts`
- Lược bỏ logic, chỉ giữ lại state thuần túy (View đang mở, Sidebar đóng mở).

---

### Giai đoạn 3: Phân rã "God File" (Main Process)
Mục tiêu: Cứu file `electron/main.ts` khỏi tình trạng ôm đồm > 1000 dòng.

#### [NEW] `electron/ipc/register*.ts`
- Tạo các module IPC mỏng: `registerSettingsIpc.ts`, `registerGitIpc.ts`, `registerTerminalIpc.ts`, `registerWorkspaceIpc.ts`...
- Mỗi module chỉ nhận sự kiện từ Frontend và chuyển tiếp xuống tầng dưới.

#### [NEW] `electron/infrastructure/*`
- Tạo `SimpleGitAdapter.ts` (xử lý Git).
- Tạo `PtyTerminalManager.ts` (xử lý Terminal).
- Tạo `JsonSettingsRepository.ts` (xử lý Settings).

#### [MODIFY] `electron/main.ts`
- Xóa hàng nghìn dòng code cũ, chỉ import và chạy các hàm `registerXxxIpc()` và bootstrap window. File `main.ts` sẽ giảm xuống chỉ còn khoảng ~100 dòng.

---

### Giai đoạn 4: Refactor Agent Runtime (Main Process)
Mục tiêu: Tái cấu trúc logic chat của AI theo chuẩn Clean Architecture.

#### [NEW] `electron/application/usecases/*`
- Đưa các chu trình chat, gọi tool của AI (hiện đang nằm trong `electron/agentRuntime.ts`) thành các Use Case độc lập (`RunAgentSessionUseCase.ts`).

#### [NEW] `electron/infrastructure/ai/OpenAiCompatibleChatClient.ts`
- Trích xuất phần gọi Fetch API HTTP ra thành một module riêng để dễ test và thay đổi sau này.

---

## User Review Required

> [!CAUTION]
> Tái cấu trúc là một quá trình **rủi ro** vì chúng ta sẽ đập đi xây lại hầu hết cấu trúc file.
> Tuy nhiên, khi làm xong, dự án của bạn sẽ chuẩn mực, sạch sẽ, dễ dàng mở rộng và không bao giờ gặp tình trạng lỗi lặt vặt khó tìm do code dính chùm vào nhau.

> [!IMPORTANT]
> - Bạn có đồng ý với lộ trình 4 giai đoạn này không? 
> - Nếu đồng ý, chúng ta sẽ bắt đầu làm **Giai đoạn 1** trước nhé. Bạn hãy bấm "Proceed" hoặc trả lời để tôi bắt đầu tạo các file thư mục mới cho Giai đoạn 1.
