# Security Checklist bắt buộc

Áp dụng cho mọi thay đổi đụng tới: shell command, filesystem path, sandbox, hoặc dữ liệu gửi
ra ngoài qua API provider.

## 1. Shell command — cấm string-interpolation

**Sai (đang tồn tại trong `git:diff`, `git:status`, `git:get-branch` ở `main.ts`):**
```ts
await execAsync(`git diff HEAD -- "${filePath}"`, { cwd: workspacePath });
```
`filePath` có thể đến từ tên file trong repo (do người khác commit) — tên file chứa ký tự đặc
biệt có thể thực thi lệnh tùy ý.

**Đúng — dùng `simple-git` (đã dùng đúng cho commit/push/pull/branch trong repo này):**
```ts
await git.diff(['HEAD', '--', filePath]);
```
Hoặc nếu bắt buộc dùng `child_process`, dùng `execFile`/`spawn` với mảng args, KHÔNG BAO GIỜ
dùng `exec`/`execAsync` với template string chứa biến động.

**Checklist:**
- [ ] Không có biến động (path, tên branch, tên file, nội dung do agent/người dùng tạo) nào
      được nội suy trực tiếp vào một chuỗi lệnh truyền cho `exec`/`execAsync`.
- [ ] Mọi thao tác git mới đi qua `simple-git`, không viết thêm `execAsync('git ...')`.

## 2. Sandbox thực thi lệnh của agent (`run_command` tool)

- [ ] **Không truyền `process.env` nguyên vẹn** vào tiến trình con do agent điều khiển. Phải
      định nghĩa allowlist rõ ràng (vd: `PATH`, `HOME`, `LANG`) và loại bỏ biến chứa
      `KEY`/`TOKEN`/`SECRET`/`PASSWORD` theo pattern tên, cộng với allowlist tường minh.
- [ ] Sandbox macOS (`sandbox-exec`) hiện chỉ giới hạn **ghi**, không giới hạn **đọc**
      (`file-read*` được allow không điều kiện). Nếu tool đọc file nhạy cảm là mối lo với use
      case của bạn, cân nhắc giới hạn đọc theo subpath tương tự như ghi.
- [ ] **Parity 3 hệ điều hành bắt buộc**: nếu một chế độ permission (`workspace-write`,
      `danger-full-access`) hoạt động trên macOS/Linux, nó phải hoạt động tương đương trên
      Windows, hoặc phải fail rõ ràng kèm thông báo cho người dùng — không được để tool âm
      thầm không hoạt động (hiện trạng: `danger-full-access` gọi cứng `/bin/sh`, vỡ trên
      Windows).
- [ ] Output của tool (stdout/stderr) được gửi thẳng vào model qua API provider mà người dùng
      tự cấu hình `baseUrl` — nhắc rõ trong tài liệu người dùng rằng lệnh chạy trong
      `workspace-write`/`danger-full-access` có thể làm lộ dữ liệu môi trường cho provider đó.

## 3. Path resolution

- [ ] Mọi path đến từ input của agent hoặc renderer phải đi qua `resolvePath`/
      `resolveWorkspacePath` + kiểm tra `isInsidePath` trước khi đọc/ghi (đã làm đúng trong
      `agentRuntime.ts` — giữ nguyên pattern này cho mọi tool mới).
- [ ] Không thêm tool/IPC mới nhận `path` tuyệt đối từ renderer mà bỏ qua kiểm tra workspace
      trừ khi `permissionMode === 'danger-full-access'` và có comment giải thích rõ.

## 4. IPC input validation

- [ ] Mọi `ipcMain.handle`/`ipcMain.on` nhận payload từ renderer phải validate qua
      `isObject`/`getString` (hoặc tương đương) trước khi dùng — pattern đã có trong
      `main.ts`, áp dụng nhất quán cho handler mới, không tin tưởng type TypeScript tại
      runtime (renderer có thể gửi bất cứ gì qua `ipcRenderer.invoke`).
- [ ] Không destructure trực tiếp payload chưa validate (`const { path } = payload` khi
      `payload` có thể là `undefined`/mảng/kiểu sai).

## 5. Dữ liệu nhạy cảm

- [ ] API key luôn qua `safeStorage.encryptString` khi khả dụng; nếu không khả dụng
      (`plainApiKey`), phải log cảnh báo rõ ràng — không im lặng lưu plaintext.
- [ ] Không log API key, nội dung file đọc được, hoặc output lệnh shell ra console trong môi
      trường production build.
- [ ] Khi thêm field mới vào `AppSettings`/`StoredSettings` chứa dữ liệu nhạy cảm, cân nhắc mã
      hoá tương tự `encryptedApiKey`.

## 6. Trước khi merge bất kỳ thay đổi nào thuộc mục trên

- [ ] Đã tự hỏi: "nếu filename/branch name/nội dung file này do một bên thứ ba không tin cậy
      tạo ra (repo lạ, model trả về nội dung độc hại), điều gì xảy ra?"
- [ ] Đã chạy qua lại pattern hiện có trong repo (vd: cách `agentRuntime.ts` xử lý path) thay
      vì tự nghĩ ra cách mới.
