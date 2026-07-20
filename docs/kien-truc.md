# Kiến trúc AgentStudio

## Tổng quan

AgentStudio là ứng dụng Electron gồm hai runtime tách biệt:

```text
React renderer
  presentation → application hooks/services → IPC adapter
                                            │
                                      contextBridge
                                            │
Electron main
  IPC controller → application use case → domain port
                                            │
                                      infrastructure
```

- **Main process** trong `electron/` sở hữu filesystem, process, network, credential, policy, persistence và Electron API.
- **Renderer** trong `src/` chỉ chịu trách nhiệm giao diện và state trình bày. Renderer truy cập năng lực hệ thống qua bridge được preload expose.
- Hai runtime không chia sẻ bộ nhớ. Dữ liệu đi qua contract IPC có kiểu và được validate lại ở main.

## Công nghệ

| Phần | Công nghệ hiện tại |
|---|---|
| Desktop | Electron 43 |
| Renderer | React 19, TypeScript 6 |
| Build | Vite 8, vite-plugin-electron |
| Giao diện | Tailwind CSS 4, Material Symbols |
| State renderer | Zustand 5 |
| Terminal | xterm 6, node-pty |
| MCP | Model Context Protocol SDK 1.29 |
| Kiểm tra | Vitest 4, Oxlint |
| Đóng gói | electron-builder 26, NSIS |

Phiên bản dependency chính xác luôn nằm trong `package.json` và `package-lock.json`.

## Dependency rule

Mỗi runtime tuân theo hướng phụ thuộc:

```text
presentation / ipc
        ↓
application
        ↓
domain
        ↑
infrastructure
```

- `domain` chứa entity, quy tắc thuần và port; không import framework hoặc lớp ngoài.
- `application` điều phối use case và phụ thuộc abstraction.
- `infrastructure` cài đặt port bằng filesystem, fetch, spawn, Electron hoặc IPC thật.
- component React và IPC controller là lớp biên, không chứa business logic chính.

Repository vẫn có một số composition/wiring cũ trong `electron/main.ts`. Mã mới không được thêm handler trực tiếp vào file này; controller mới phải được tách thành `electron/ipc/registerXxxIpc.ts`.

## Cấu trúc mã nguồn

```text
AgentStudio/
├── electron/
│   ├── domain/          Entity và port của main process
│   ├── application/     Use case và service điều phối
│   ├── infrastructure/  AI, filesystem, tool, MCP, persistence, process
│   ├── ipc/             Controller IPC mỏng, validate input
│   ├── evaluation/      Golden suite và evaluator
│   ├── workflows/       Workflow dựng sẵn
│   ├── main.ts          Bootstrap và composition root
│   └── preload.ts       Context bridge
├── src/
│   ├── domain/          Entity và quy tắc thuần phía renderer
│   ├── application/     Hook/use case và service trình bày
│   ├── infrastructure/  Adapter IPC và tích hợp trình duyệt
│   ├── components/      Giao diện React
│   ├── store/           Các Zustand slice
│   ├── App.tsx
│   └── index.css
├── docs/                Tài liệu và ADR
├── scripts/             Công cụ đánh giá
└── public/              Tài nguyên tĩnh
```

## Luồng một yêu cầu agent

1. Composer tạo user message trong active thread.
2. Hook ứng dụng chiếu lịch sử thành payload an toàn và gọi bridge.
3. Main validate payload, nạp settings, workspace, instruction, skill và checkpoint.
4. Vòng lặp agent gọi provider tương thích OpenAI và nhận content/tool call dạng stream.
5. Tool catalog và policy quyết định tool có tồn tại, được phép hay cần approval.
6. Infrastructure thực thi tool trong ranh giới path, sandbox, network và credential tương ứng.
7. Action, chunk, interaction và trạng thái được gửi về renderer qua event có cleanup.
8. Transcript/checkpoint, audit và trace cần thiết được main lưu cục bộ.

Renderer không thực thi tool và không tự quyết định quyền cuối cùng.

## Tool platform

Tool local được định nghĩa từ catalog có kiểu dùng chung cho schema model và executor. Các nhóm chính:

- filesystem: list/read/glob/grep/write/patch;
- command: foreground/background shell và task supervisor;
- network: web search, WebFetch và remote trigger;
- collaboration: agent worker, team, message và shared task;
- IDE: LSP, notebook, MCP selection context;
- orchestration: workflow, cron, plan, config và context compaction;
- integration: MCP tool/resource/auth, skill và plugin.

Tool deferred không đưa toàn bộ schema vào mọi lượt. `ToolSearch` chọn schema cần dùng, sau đó catalog được làm mới ở lượt model tiếp theo.

## Permission, approval và audit

Policy được giải ở main process từ:

1. baseline của chế độ `read-only`, `workspace-write` hoặc `danger-full-access`;
2. rule trung tâm, workspace, user và session;
3. plan mode;
4. lifecycle hook;
5. giới hạn kế thừa từ agent cha.

`deny` mạnh hơn `ask`, và `ask` mạnh hơn `allow`. Quyết định approval được correlate theo request/action ID; renderer chỉ hiển thị và gửi lựa chọn của người dùng.

Audit tool không lưu nội dung file hay đối số tool. Trace chỉ giữ metadata, outcome, timing và usage đã giới hạn.

## Persistence

Main process sở hữu các repository cho:

- settings và secret đã mã hóa;
- chat history đã loại dữ liệu attachment nhạy cảm;
- durable agent task và checkpoint;
- worker, team, mailbox và shared task;
- trace, evaluation, workflow và optimizer;
- knowledge index;
- cron, background command và remote-trigger settings.

Các tệp riêng tư dùng identity đã hash, ghi nguyên tử và quyền owner-only ở hệ điều hành hỗ trợ. Renderer chỉ nhận projection cần cho UI.

## Agent worker và team

Worker production chạy model loop trong child process với environment đã lọc. Parent vẫn giữ:

- tool catalog và executor;
- permission/approval;
- hook và audit;
- checkpoint và trace;
- credential provider và workspace authority.

Giao tiếp parent/child dùng RPC được validate. Team dùng socket/pipe cục bộ đã xác thực cùng hàng đợi claim/ACK bền vững. Roster phẳng ngăn teammate tự mở rộng cây agent không giới hạn.

Các quyết định liên quan nằm trong:

- [ADR-0007: Subagent có giới hạn](adr/0007-bounded-subagents-and-profiles.md)
- [ADR-0013: Worker có địa chỉ](adr/0013-addressable-agent-workers.md)
- [ADR-0014: Team runtime bền vững](adr/0014-persistent-agent-team-runtime.md)

## Workspace, tab và utility dock

Renderer dùng state routing thay vì router URL. `activeView`, workspace tab và utility dock được quản lý bằng Zustand slice. Các surface gồm task, terminal, browser, file, knowledge, evaluation, workflow, capability, trace, optimizer, skill learning và agent profile.

Workspace browser đi qua use case và port ở main; component không đọc filesystem trực tiếp. Terminal dùng PTY do main sở hữu, còn xterm chỉ render và gửi input/resize qua bridge.

## Knowledge và evaluation

Knowledge pipeline tách repository, chunking, embedding và retrieval. Evaluation chạy golden suite deterministic qua production session loop, tool policy, checkpoint và trace trong workspace tạm.

- [ADR-0001: Unified observability](adr/0001-unified-observability.md)
- [ADR-0002: Agent-wide evaluation](adr/0002-agent-wide-evaluation.md)
- [ADR-0004: Capability registry](adr/0004-capability-registry.md)
- [ADR-0005: Safe optimizer](adr/0005-safe-optimizer.md)
- [ADR-0006: Signed skill learning](adr/0006-signed-skill-learning.md)

## Streaming và context

OpenAI-compatible SSE được decode theo chunk có giới hạn, chuẩn hóa content, tool call và usage trước khi vào domain. Context compaction loại dữ liệu attachment/capability, giữ continuity của tool deferred và từ chối kết quả không thực sự nhỏ hơn.

- [ADR-0020: Chuẩn hóa OpenAI stream](adr/0020-bounded-openai-stream-normalization.md)
- [ADR-0021: Context compaction cục bộ](adr/0021-bounded-manual-context-compaction.md)

## Quy tắc thay đổi kiến trúc

Trước khi thêm tính năng:

1. xác định domain;
2. bổ sung entity/port thuần nếu cần;
3. viết use case trong application;
4. cài đặt I/O ở infrastructure;
5. nối IPC hoặc hook ở lớp biên;
6. validate input ở main;
7. test logic thuần độc lập;
8. kiểm tra giới hạn kích thước file và checklist bảo mật.

Quy tắc bắt buộc và ngưỡng chi tiết nằm trong [`AGENTS.md`](../AGENTS.md) và thư mục `.agent/`.
