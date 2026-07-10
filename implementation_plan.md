# Refactoring AgentStudio — Clean Architecture Compliance

## Mục tiêu

Giải quyết toàn bộ 6 vấn đề kỹ thuật + 2 vấn đề tài liệu được phát hiện qua audit, đưa codebase khớp hoàn toàn với CLEAN_ARCHITECTURE.md, AGENTS.md và các doc chuẩn trong `.agent/`.

---

## User Review Required

> [!IMPORTANT]
> **Thứ tự thực thi**: Các thay đổi được nhóm thành 5 giai đoạn độc lập. Mỗi giai đoạn phải build thành công trước khi sang giai đoạn kế. Bạn có muốn thực hiện tuần tự từng giai đoạn hay toàn bộ cùng lúc?

> [!WARNING]
> **Import path breaking change**: Tất cả file import từ `'../agentRuntime.js'` sẽ được đổi về `'../domain/entities/agent.js'`. Không có thay đổi runtime, chỉ là đường dẫn import.

> [!CAUTION]
> **ChatArea.tsx sẽ được tách thành 6 file**. Nếu đang có nhánh git song song sửa file này, cần merge trước.

---

## Phân tích hiện trạng

| Vấn đề | File | Vi phạm quy tắc | Mức độ |
|---|---|---|---|
| RunAgentSession.ts God File (510 dòng) | `electron/application/usecases/RunAgentSession.ts` | FILE_SIZE_AND_SRP + CLEAN_ARCHITECTURE §3 | 🔴 Nghiêm trọng |
| Domain import Electron WebContents | `electron/domain/ports/IAiProvider.ts` | CLEAN_ARCHITECTURE §2 (Dependency Rule) | 🔴 Nghiêm trọng |
| RunAgentSession gọi `sender.send()` trực tiếp | `RunAgentSession.ts` L87/91/127 | CLEAN_ARCHITECTURE §2 | 🔴 Nghiêm trọng |
| Trùng lặp token budget logic | `RunAgentSession.ts` + `OpenAIProvider.ts` | AGENTS.md §4 (cấm duplicate) | 🟠 Quan trọng |
| ChatArea.tsx 459 dòng + 9 component trong 1 file | `src/components/ChatArea.tsx` | FILE_SIZE_AND_SRP (ngưỡng cứng 300) | 🟠 Quan trọng |
| parseAgentContent định nghĩa trong component | `ChatArea.tsx` L314-340 | REACT_COMPONENT_STANDARDS.md §1 | 🟠 Quan trọng |
| upsertAgentAction / appendAgentThoughtChunk có business logic | `useAppStore.ts` L233-298 | REACT_COMPONENT_STANDARDS.md §3 | 🟠 Quan trọng |
| Import PermissionMode gián tiếp qua agentRuntime | `JsonSettingsRepository.ts` L5, `registerSettingsIpc.ts` L4 | Phụ thuộc rối không cần thiết | 🟡 Nhỏ |
| SECURITY_CHECKLIST.md mô tả code không còn tồn tại | `.agent/SECURITY_CHECKLIST.md` §1 | Docs lệch thực tế | 🟡 Docs |
| REACT_COMPONENT_STANDARDS.md nhắc file không tồn tại | `.agent/REACT_COMPONENT_STANDARDS.md` | Docs lệch thực tế | 🟡 Docs |
| `encryptApiKey` không log khi lưu plaintext | `JsonSettingsRepository.ts` L118 | SECURITY_CHECKLIST.md §5 | 🟡 Nhỏ |
| `chat:save-workspace` dùng `rawPayload: any` | `registerWorkspaceIpc.ts` | SECURITY_CHECKLIST.md §4 | 🟡 Nhỏ |
| `danger-full-access` gọi cứng `/bin/sh` | `RunAgentSession.ts` L374 | SECURITY_CHECKLIST.md §2 (Windows parity) | 🟡 Nhỏ |
| Timeout chỉ SIGTERM, không fallback SIGKILL | `RunAgentSession.ts` L437 | Minor robustness | 🟢 Nhỏ |

---

## Giai đoạn 1 — Dọn import + Fix docs nhỏ

### 1.1 Fix import gián tiếp PermissionMode

#### [MODIFY] [JsonSettingsRepository.ts](file:///d:/AgentStudio/electron/infrastructure/JsonSettingsRepository.ts)
- Đổi `import type { PermissionMode } from '../agentRuntime.js'`  
  → `import type { PermissionMode } from '../domain/entities/agent.js'`

#### [MODIFY] [registerSettingsIpc.ts](file:///d:/AgentStudio/electron/ipc/registerSettingsIpc.ts)
- Đổi `import type { PermissionMode } from '../agentRuntime.js'`  
  → `import type { PermissionMode } from '../domain/entities/agent.js'`

### 1.2 Fix `chat:save-workspace` dùng `any`

#### [MODIFY] [registerWorkspaceIpc.ts](file:///d:/AgentStudio/electron/ipc/registerWorkspaceIpc.ts)
- Đổi `rawPayload: any` → `rawPayload: unknown` + validate với `isObject`/`getString`

### 1.3 Fix `encryptApiKey` thiếu warning log

#### [MODIFY] [JsonSettingsRepository.ts](file:///d:/AgentStudio/electron/infrastructure/JsonSettingsRepository.ts)
- Thêm `console.warn('[SECURITY] safeStorage unavailable — API key stored as plaintext.')` vào nhánh `plainApiKey`

---

## Giai đoạn 2 — Tách token budget ra module dùng chung

### Vấn đề
`MAX_RESPONSE_TOKENS`, `isUsableContextWindow()`, `getResponseTokenLimit()` bị copy y hệt giữa `RunAgentSession.ts` và `OpenAIProvider.ts`.

### [NEW] `electron/domain/entities/tokenBudget.ts`
```typescript
export const MAX_RESPONSE_TOKENS = 8_192;

export function isUsableContextWindow(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 2_048;
}

export function getResponseTokenLimit(contextWindow: number | undefined): number {
  if (!isUsableContextWindow(contextWindow)) return MAX_RESPONSE_TOKENS;
  return Math.min(MAX_RESPONSE_TOKENS, Math.max(1_024, Math.floor(contextWindow * 0.25)));
}

export function getInputContextTokenBudget(contextWindow: number | undefined): number {
  const DEFAULT_INPUT_CONTEXT_TOKENS = 24_000;
  if (!isUsableContextWindow(contextWindow)) return DEFAULT_INPUT_CONTEXT_TOKENS;
  const responseTokens = getResponseTokenLimit(contextWindow);
  const overheadTokens = Math.min(4_000, Math.max(800, Math.floor(contextWindow * 0.05)));
  return Math.max(1_000, contextWindow - responseTokens - overheadTokens);
}
```

#### [MODIFY] [RunAgentSession.ts](file:///d:/AgentStudio/electron/application/usecases/RunAgentSession.ts)
- Xóa các hàm duplicate, import từ `tokenBudget.ts`

#### [MODIFY] [OpenAIProvider.ts](file:///d:/AgentStudio/electron/infrastructure/providers/OpenAIProvider.ts)
- Xóa các hàm duplicate, import từ `tokenBudget.ts`

---

## Giai đoạn 3 — Tách Domain/Application khỏi Electron type leak

### 3.1 Tạo interface AgentEventSink (domain port)

#### [NEW] `electron/domain/ports/IAgentEventSink.ts`
```typescript
import type { AgentActionPayload } from '../entities/agent.js';

export interface IAgentEventSink {
  emitChunk(requestId: string, chunk: string): void;
  emitAction(requestId: string, action: AgentActionPayload): void;
  emitDone(requestId: string): void;
  emitError(requestId: string, error: string): void;
}
```

#### [MODIFY] [IAiProvider.ts](file:///d:/AgentStudio/electron/domain/ports/IAiProvider.ts)
- Thay `WebContents` bằng `IAgentEventSink`
- Xóa `import type { WebContents } from 'electron'`

### 3.2 Tạo ElectronAgentEventSink (infrastructure implement)

#### [NEW] `electron/infrastructure/ElectronAgentEventSink.ts`
```typescript
import type { WebContents } from 'electron';
import type { IAgentEventSink } from '../domain/ports/IAgentEventSink.js';

export class ElectronAgentEventSink implements IAgentEventSink { ... }
```

### 3.3 Cập nhật RunAgentSession + OpenAIProvider

#### [MODIFY] [RunAgentSession.ts](file:///d:/AgentStudio/electron/application/usecases/RunAgentSession.ts)
- Thay `sender: WebContents` → `eventSink: IAgentEventSink`
- Xóa `import type { WebContents } from 'electron'`

#### [MODIFY] [OpenAIProvider.ts](file:///d:/AgentStudio/electron/infrastructure/providers/OpenAIProvider.ts)
- Thay tham số `sender: WebContents` → `eventSink: IAgentEventSink`

#### [MODIFY] [agentRuntime.ts](file:///d:/AgentStudio/electron/agentRuntime.ts)
- Khởi tạo `ElectronAgentEventSink(sender)` rồi truyền vào `session.execute()`

---

## Giai đoạn 4 — Tách tool executor ra infrastructure

### Vấn đề
`RunAgentSession.ts` (510 dòng) chứa toàn bộ: vòng lặp use-case + đọc/ghi file + spawn process + sandbox builder. Cần tách tool execution sang `infrastructure/tools/`.

### Cấu trúc mới

```
electron/infrastructure/tools/
├── FileSystemToolExecutor.ts     # list_files, read_file, write_file
└── sandbox/
    ├── SandboxedCommandExecutor.ts  # điều phối platform
    ├── macOsSandbox.ts              # buildSeatbeltProfile + sandbox-exec
    ├── linuxSandbox.ts              # bwrap
    └── windowsSandbox.ts            # Windows-aware: dùng cmd.exe hoặc fail rõ ràng
```

### Tạo port ToolExecutorPort

#### [NEW] `electron/domain/ports/IToolExecutor.ts`
```typescript
import type { ToolResult, PermissionMode } from '../entities/agent.js';

export interface IToolExecutor {
  execute(
    toolName: string,
    args: Record<string, unknown>,
    workspaceRoot: string,
    permissionMode: PermissionMode,
  ): Promise<ToolResult>;
}
```

### Các file mới

#### [NEW] `electron/infrastructure/tools/sandbox/macOsSandbox.ts`
- Chứa `buildSeatbeltProfile()` + `runMacOsSandboxed()` từ RunAgentSession

#### [NEW] `electron/infrastructure/tools/sandbox/linuxSandbox.ts`
- Chứa logic `bwrap` từ RunAgentSession

#### [NEW] `electron/infrastructure/tools/sandbox/windowsSandbox.ts`
- Tách nhánh Windows: `danger-full-access` dùng `cmd.exe /c`, `workspace-write` fail rõ với message hướng dẫn

#### [NEW] `electron/infrastructure/tools/sandbox/SandboxedCommandExecutor.ts`
- Import các sandbox module theo platform, export `runSandboxedCommand()`
- Fix: thêm SIGKILL fallback 5s sau SIGTERM khi timeout

#### [NEW] `electron/infrastructure/tools/FileSystemToolExecutor.ts`
- Chứa `listFiles`, `readFileTool`, `writeFileTool`, `resolvePath`, `isInsidePath`
- Implement `IToolExecutor` cho file operations

#### [NEW] `electron/infrastructure/tools/AgentToolExecutor.ts`
- Facade: gộp FileSystemToolExecutor + SandboxedCommandExecutor
- Implement `IToolExecutor` hoàn chỉnh (dispatch theo toolName)

#### [MODIFY] [RunAgentSession.ts](file:///d:/AgentStudio/electron/application/usecases/RunAgentSession.ts)
- Nhận `IToolExecutor` qua constructor (dependency injection)
- Xóa toàn bộ private methods liên quan đến I/O
- Kết quả: ~120 dòng (chỉ còn vòng lặp use-case + formatMessages + prompt builder)

#### [MODIFY] [agentRuntime.ts](file:///d:/AgentStudio/electron/agentRuntime.ts)
- Khởi tạo `AgentToolExecutor` + inject vào `RunAgentSession`

---

## Giai đoạn 5 — Tách ChatArea.tsx + useAppStore

### 5.1 Rút parseAgentContent ra application layer

#### [NEW] `src/application/services/parseAgentContent.ts`
- Chứa `AgentContentPart` type, `parseTextAndCode()`, `parseAgentContent()`, `stripLegacyActionLogs()`
- Pure functions, testable độc lập

### 5.2 Tách ChatArea.tsx thành các file component riêng

```
src/components/chat/
├── UserMessage.tsx         # component UserMessage + AttachmentDisplay
├── AgentMessage.tsx        # component AgentMessage (dùng parseAgentContent từ application/)
├── CodeBlock.tsx           # component CodeBlock
├── ThinkStep.tsx           # component ThinkStep
├── ToolStep.tsx            # component ToolStep
├── ChatEmptyState.tsx      # component EmptyState
└── TypingIndicator.tsx     # component TypingIndicator
```

#### [MODIFY] [ChatArea.tsx](file:///d:/AgentStudio/src/components/ChatArea.tsx)
- Chỉ còn: import các sub-component + `ChatArea` container (~60 dòng)
- Xóa toàn bộ parse functions và sub-component definitions

### 5.3 Rút business logic khỏi useAppStore

Logic `upsertAgentAction` (tìm message `sending` → nối `[tool:id]`) và `appendAgentThoughtChunk` (FSM phức tạp) cần chuyển ra `application/`.

#### [NEW] `src/application/services/agentActionReducer.ts`
- Pure function `reduceAgentAction(state, action)` → new state
- Pure function `reduceAgentThoughtChunk(thoughts, startsNewLine, requestId, chunk)` → new state

#### [MODIFY] [useAppStore.ts](file:///d:/AgentStudio/src/store/useAppStore.ts)
- `upsertAgentAction` chỉ gọi `set(reduceAgentAction(state, action))`
- `appendAgentThoughtChunk` chỉ gọi `set(reduceAgentThoughtChunk(...))`
- Kết quả: ~200 dòng (trong ngưỡng khuyến nghị 250)

---

## Giai đoạn 6 — Đồng bộ tài liệu với thực tế

### [MODIFY] [SECURITY_CHECKLIST.md](file:///d:/AgentStudio/.agent/SECURITY_CHECKLIST.md)
- Mục 1: Cập nhật ví dụ sai không còn tồn tại (`git:diff`/`git:status`/`git:get-branch`)
- Thêm note: SimpleGitAdapter hiện chỉ có `getBranch()`, các thao tác git khác là roadmap
- Mục 2: Cập nhật note về Windows parity sau khi Giai đoạn 4 hoàn thành

### [MODIFY] [REACT_COMPONENT_STANDARDS.md](file:///d:/AgentStudio/.agent/REACT_COMPONENT_STANDARDS.md)
- Bảng mục 2: Xóa reference đến `BranchManagerModal.tsx`, `SourceControlView.tsx`, `useBranches()`
- Thay bằng các component thực tế hiện có

---

## Verification Plan

### Automated
```powershell
npm run build        # TypeScript compile check — zero errors
```

### Manual Verification
- [ ] Khởi động app: `npm run dev`
- [ ] Gửi tin nhắn chat → agent stream đúng
- [ ] Agent gọi tool `read_file` / `list_files` → hiển thị ToolStep
- [ ] Settings lưu/đọc provider + API key (encryption flow)
- [ ] Kiểm tra không còn `WebContents` import trong `domain/ports/`
- [ ] Kiểm tra `RunAgentSession.ts` còn ≤ 150 dòng
- [ ] Kiểm tra `ChatArea.tsx` còn ≤ 80 dòng

### Thứ tự thực hiện an toàn
1 → 2 → Build check → 3 → Build check → 4 → Build check → 5 → Build check → 6
