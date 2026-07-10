# Security Checklist bắt buộc

Áp dụng cho mọi thay đổi đụng tới: shell command, filesystem path, sandbox, hoặc dữ liệu gửi
ra ngoài qua API provider.

## 1. Shell command — cấm string-interpolation

**Đúng — dùng `child_process.spawn` với mảng args (hiện tại dùng trong `spawnAndCollect.ts`):**
```ts
spawn('/bin/sh', ['-lc', command], { cwd, env: safeEnv });
```
Không bao giờ dùng `exec`/`execAsync` với template string chứa biến động.

> **Lưu ý về git:** `SimpleGitAdapter.ts` hiện chỉ implement `getBranch()` dùng `execAsync('git
> rev-parse --abbrev-ref HEAD', { cwd })` — lệnh này không interpolate biến người dùng nên an
> toàn. Các thao tác git khác (diff, status, commit, push, pull) là **roadmap chưa implement**.
> Khi implement, bắt buộc dùng `simple-git` library, không dùng execAsync template string.

**Checklist:**
- [ ] Không có biến động (path, tên branch, tên file, nội dung do agent/người dùng tạo) nào
      được nội suy trực tiếp vào một chuỗi lệnh truyền cho `exec`/`execAsync`.
- [ ] Mọi thao tác git mới đi qua `simple-git`, không viết thêm `execAsync('git ...')`.

## 2. Sandbox thực thi lệnh của agent (`run_command` tool)

- [ ] **Env var allowlist bắt buộc**: `spawnAndCollect.ts` filter chỉ cho qua
      `PATH`, `HOME`, `LANG`, `LC_ALL`, `LC_CTYPE`, `TMPDIR`, `TEMP`, `TMP`, `TERM`, `USER`,
      `LOGNAME`, `SHELL`. Không truyền `process.env` nguyên vẹn vào tiến trình con.
- [ ] Sandbox macOS (`sandbox-exec`) hiện chỉ giới hạn **ghi**, không giới hạn **đọc**
      (`file-read*` được allow không điều kiện). Nếu tool đọc file nhạy cảm là mối lo với use
      case của bạn, cân nhắc giới hạn đọc theo subpath tương tự như ghi.
- [ ] **Parity 3 hệ điều hành:**
      - macOS: sandbox-exec + Seatbelt ✅ (`macOsSandbox.ts`)
      - Linux: bwrap ✅ (`linuxSandbox.ts`)
      - Windows danger-full-access: cmd.exe /c ✅ (`windowsSandbox.ts`)
      - Windows workspace-write: fail rõ ràng với hướng dẫn ✅ (`windowsSandbox.ts`)
- [ ] SIGTERM timeout: sau khi SIGTERM, có SIGKILL fallback 5 giây nếu process không phản hồi.
- [ ] Output của tool (stdout/stderr) được gửi thẳng vào model — nhắc rõ trong tài liệu người
      dùng rằng lệnh chạy trong `workspace-write`/`danger-full-access` có thể làm lộ dữ liệu
      môi trường cho provider đó.

## 3. Path resolution

- [ ] Mọi path đến từ input của agent hoặc renderer phải đi qua `resolvePath` +
      kiểm tra `isInsidePath` trước khi đọc/ghi (implement trong `FileSystemToolExecutor.ts`).
- [ ] Không thêm tool/IPC mới nhận `path` tuyệt đối từ renderer mà bỏ qua kiểm tra workspace
      trừ khi `permissionMode === 'danger-full-access'` và có comment giải thích rõ.

## 4. IPC input validation

- [ ] Mọi `ipcMain.handle`/`ipcMain.on` nhận payload từ renderer phải validate qua
      `isObject`/`getString` (hoặc tương đương) trước khi dùng — không tin tưởng type TypeScript
      tại runtime (renderer có thể gửi bất cứ gì qua `ipcRenderer.invoke`).
- [ ] Không dùng `rawPayload: any` — bắt buộc dùng `rawPayload: unknown` + validate.

## 5. Dữ liệu nhạy cảm

- [ ] API key luôn qua `safeStorage.encryptString` khi khả dụng; nếu không khả dụng
      (`plainApiKey`), **phải log `console.warn` cảnh báo rõ ràng** — không im lặng lưu plaintext.
- [ ] Không log API key, nội dung file đọc được, hoặc output lệnh shell ra console trong môi
      trường production build.
- [ ] Khi thêm field mới vào `AppSettings`/`StoredSettings` chứa dữ liệu nhạy cảm, cân nhắc mã
      hoá tương tự `encryptedApiKey`.

## 6. Trước khi merge bất kỳ thay đổi nào thuộc mục trên

- [ ] Đã tự hỏi: "nếu filename/branch name/nội dung file này do một bên thứ ba không tin cậy
      tạo ra (repo lạ, model trả về nội dung độc hại), điều gì xảy ra?"
- [ ] Đã chạy qua lại pattern hiện có trong repo (vd: cách `FileSystemToolExecutor.ts` xử lý
      path) thay vì tự nghĩ ra cách mới.
