# Clean Architecture cho AgentStudio (Electron 2 tiến trình)

## 1. Vì sao cần điều chỉnh Clean Architecture "sách vở"

AgentStudio có **hai runtime độc lập**, không chia sẻ bộ nhớ, chỉ nói chuyện qua IPC:

- **Main process** (`electron/`) — Node.js, có quyền truy cập filesystem, spawn process, gọi
  HTTP ra ngoài.
- **Renderer** (`src/`) — React, chạy trong sandbox trình duyệt, chỉ được chạm Node/Electron
  qua `window.agentStudio` (do `preload.ts` expose).

→ Áp dụng Clean Architecture **riêng cho từng runtime**. Không import code runtime giữa hai
phía. Chỉ được chia sẻ **định nghĩa kiểu dữ liệu thuần** (type/interface, không có logic) nếu
thật sự cần, và chỉ ở build-time.

## 2. Bốn lớp, dependency rule

```
Domain        → entities, value objects, PORT interfaces. Không import framework, không import
                 lớp nào khác.
Application   → use-cases điều phối domain, phụ thuộc PORT interface (không phụ thuộc
                 implementation cụ thể).
Infrastructure→ cài đặt PORT (fs thật, spawn thật, fetch thật, simple-git thật,
                 window.agentStudio thật). Đây là lớp DUY NHẤT được phép "bẩn tay" với I/O.
Presentation/IPC → React component (renderer) hoặc ipcMain handler (main). Chỉ gọi
                 application, không tự chứa business logic, không tự gọi infrastructure.
```

Quy tắc vàng: **mũi tên phụ thuộc luôn chỉ vào trong**. `domain` không biết `application` tồn
tại. `application` không biết `infrastructure` cụ thể là gì (chỉ biết interface).

## 3. Cấu trúc thư mục đích — `electron/` (main process)

```
electron/
├── main.ts                          # CHỈ bootstrap app + gọi các registerXxxIpc()
├── domain/
│   ├── entities/
│   │   ├── message.ts               # Message, Attachment
│   │   ├── tool.ts                  # ToolResult, ToolDefinition, PermissionMode
│   │   └── settings.ts              # StoredSettings, ModelMetadata, AIProvider
│   └── ports/                       # interface — application cần, infrastructure implement
│       ├── ChatCompletionPort.ts
│       ├── ToolExecutorPort.ts
│       ├── SettingsRepositoryPort.ts
│       ├── GitPort.ts
│       └── TerminalPort.ts
├── application/
│   ├── usecases/
│   │   ├── RunAgentSessionUseCase.ts       # vòng lặp step, chỉ gọi qua port
│   │   ├── SaveProviderAndScanModelsUseCase.ts
│   │   ├── CommitChangesUseCase.ts
│   │   ├── SyncBranchUseCase.ts
│   │   └── ...
│   └── services/
│       └── compactContext.ts               # nội dung electron/contextCompaction.ts hiện tại
├── infrastructure/
│   ├── ai/
│   │   └── OpenAiCompatibleChatClient.ts   # phần fetch + SSE parsing hiện nằm trong
│   │                                        # agentRuntime.ts (requestAssistantMessage, ...)
│   ├── tools/
│   │   ├── FileSystemToolExecutor.ts       # list_files/read_file/write_file
│   │   └── sandbox/
│   │       ├── SandboxedCommandExecutor.ts # điều phối chung
│   │       ├── macOsSandbox.ts             # buildSeatbeltProfile + sandbox-exec
│   │       ├── linuxSandbox.ts             # bwrap
│   │       └── windowsSandbox.ts           # (hiện chưa có — xem SECURITY_CHECKLIST)
│   ├── git/
│   │   └── SimpleGitAdapter.ts             # TOÀN BỘ thao tác git qua simple-git thuần,
│   │                                        # không còn execAsync string nào
│   ├── settings/
│   │   └── JsonSettingsRepository.ts       # load/save settings.json, encrypt/decrypt key
│   ├── chatHistory/
│   │   └── JsonChatHistoryRepository.ts
│   └── terminal/
│       └── PtyTerminalManager.ts           # createTerminalProcess, activeTerminals, shell dò
└── ipc/                                    # "controller" — mỏng, chỉ nối use-case với IPC
    ├── registerWindowIpc.ts
    ├── registerSettingsIpc.ts
    ├── registerWorkspaceIpc.ts
    ├── registerGitIpc.ts
    ├── registerTerminalIpc.ts
    └── registerChatIpc.ts
```

## 4. Cấu trúc thư mục đích — `src/` (renderer)

```
src/
├── domain/
│   └── entities/
│       ├── message.ts        # Message, Attachment, AgentAction
│       ├── chatThread.ts      # ChatThread
│       └── settings.ts        # AIProvider, AIModel, AppSettings, PermissionMode
│       # tách ra khỏi useAppStore.ts — store chỉ nên import type, không định nghĩa type
├── application/
│   └── hooks/
│       ├── useAgentChat.ts    # HỢP NHẤT logic gửi tin nhắn hiện đang trùng lặp giữa
│       │                       # PromptComposer.tsx và ChatArea.tsx
│       ├── useGitStatus.ts    # logic hiện nằm rải rác trong SourceControlView.tsx
│       ├── useBranches.ts     # logic hiện nằm trong BranchManagerModal.tsx
│       └── useTerminalSession.ts
├── infrastructure/
│   ├── ipc/
│   │   └── agentStudioBridge.ts  # LỚP DUY NHẤT được đụng vào window.agentStudio
│   └── ai/
│       └── chatCompletionClient.ts  # nội dung src/services/ai.ts hiện tại
├── presentation/
│   ├── components/            # các component hiện tại, chỉ render + gọi hook
│   └── store/
│       └── useAppStore.ts     # chỉ giữ state UI thuần (view đang mở, sidebar mở/đóng...),
│                                # KHÔNG chứa logic gọi IPC trực tiếp
```

## 5. Bảng ánh xạ file hiện tại → vị trí mới

| File hiện tại | Vấn đề | Tách thành |
|---|---|---|
| `electron/main.ts` (~700 dòng) | Gộp settings + git + terminal + chat + window trong 1 file | 6 file `ipc/registerXxxIpc.ts` + 4 module `infrastructure/*` |
| `electron/agentRuntime.ts` | Gộp vòng lặp use-case + HTTP/SSE client + tool executor + sandbox builder | `application/usecases/RunAgentSessionUseCase.ts` + `infrastructure/ai/OpenAiCompatibleChatClient.ts` + `infrastructure/tools/*` |
| `src/store/useAppStore.ts` (~380 dòng) | Vừa định nghĩa entity, vừa là store UI, vừa chứa logic nối thread/message | Tách type sang `domain/entities/*`, giữ store chỉ chứa state + action thuần UI |
| `src/components/PromptComposer.tsx` + `src/components/ChatArea.tsx` | Trùng lặp gần như y hệt luồng submit → stream → update message | `application/hooks/useAgentChat.ts` dùng chung |
| `src/components/BranchManagerModal.tsx`, `SourceControlView.tsx`, `SettingsView.tsx`, `TopAppBar.tsx` | Gọi `window.agentStudio.*` trực tiếp trong component | Qua `infrastructure/ipc/agentStudioBridge.ts` + hook tương ứng |
| `electron/contextCompaction.ts` | — (ĐÚNG chuẩn, giữ nguyên cách viết) | Di chuyển vào `application/services/compactContext.ts`, không đổi nội dung |

## 6. Vì sao tách theo cách này giúp "không phình file"

- Mỗi file trong `infrastructure/` chỉ cài đặt **một port** → khi port đó cần đổi cách cài đặt
  (ví dụ đổi thư viện sandbox trên Linux), chỉ sửa đúng 1 file.
- `ipc/registerXxxIpc.ts` không bao giờ vượt quá vài chục dòng vì không chứa logic, chỉ gọi
  use-case — tự động thỏa ngưỡng trong `FILE_SIZE_AND_SRP.md`.
- `domain/` không phụ thuộc gì nên gần như không bao giờ cần sửa khi đổi hạ tầng (đổi từ
  OpenAI-compatible sang provider khác chỉ đổi `infrastructure/ai/`, không đụng use-case).
- Test cho `application/` và `domain/` không cần khởi động Electron hay React — chạy nhanh,
  không cần mock IPC.
