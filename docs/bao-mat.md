# Bảo mật và dữ liệu trong AgentStudio

## Nguyên tắc

AgentStudio coi renderer, nội dung repository, output tool, phản hồi model, MCP server và dữ liệu web là các nguồn không đáng tin cậy. Quyền cuối cùng thuộc main process và không thể được mở rộng chỉ bằng prompt, skill, hook, plugin hoặc message giữa agent.

Không có chế độ nào bảo đảm an toàn tuyệt đối khi người dùng cho phép một command đọc dữ liệu nhạy cảm. Policy và sandbox giảm rủi ro; chúng không thể làm sạch dữ liệu mà một lệnh được phép cố ý đọc rồi in ra.

## Dữ liệu có thể rời khỏi máy

Các dữ liệu sau có thể được gửi tới model provider đang cấu hình khi cần thực hiện tác vụ:

- nội dung chat và instruction hiệu lực;
- phần tệp được agent đọc;
- kết quả retrieval từ knowledge;
- output command/tool;
- ảnh hoặc trang PDF đã chọn đọc;
- schema và output từ MCP tool;
- nội dung web do WebFetch hoặc web search trả về.

Không chạy command in credential, token, `.env` hoặc dữ liệu cá nhân không liên quan. Chỉ kết nối provider và MCP server mà bạn tin cậy.

Trace và audit cục bộ không được dùng làm nơi lưu prompt, nội dung file, tool argument hoặc output thô.

## Chế độ quyền

### `read-only`

- Cho phép tool đọc trong workspace theo policy.
- Chặn thao tác ghi và thực thi làm thay đổi trạng thái.
- Rule không thể hạ thấp baseline này.

### `workspace-write`

- Giới hạn path vào workspace.
- Tool ghi, thực thi hoặc mạng có thể yêu cầu approval.
- Command dùng sandbox trên nền tảng có implementation được kiểm chứng.
- Trên Windows, agent command ở chế độ này fail closed vì chưa có sandbox filesystem tương đương; ứng dụng không âm thầm chạy unsandboxed.

### `danger-full-access`

- Cho phép path tuyệt đối và command unsandboxed theo policy.
- Chỉ dùng trong dự án đáng tin cậy.
- Rule `deny`, `ask`, Plan Mode và giới hạn kế thừa vẫn áp dụng.

## Rule tùy chỉnh

Workspace rule nằm tại:

```text
.agentstudio/permissions.json
```

Workspace chỉ được siết policy bằng `ask` hoặc `deny`. User rule nằm dưới Electron `userData/permissions/rules.json` và có thể dùng `allow`, `ask` hoặc `deny`.

Rule hỗ trợ:

- `toolGlob`;
- `risk`: `read`, `write`, `execute`, `network`;
- `pathGlob`;
- `domainGlob`;
- `commandPrefix`.

Thứ tự ưu tiên hiệu lực là `deny` → `ask` → `allow`, sau đó mới xét source và độ cụ thể.

```json
{
  "rules": [
    {
      "id": "deny-secret-files",
      "effect": "deny",
      "toolGlob": "read_file",
      "pathGlob": "**/.env*"
    },
    {
      "id": "review-commands",
      "effect": "ask",
      "toolGlob": "run_command"
    }
  ]
}
```

## Ranh giới filesystem

- Path từ renderer hoặc agent được chuẩn hóa và kiểm tra nằm trong workspace, trừ phạm vi được cho phép rõ ràng ở chế độ toàn quyền.
- Tool không đi theo symlink khi việc đó có thể vượt ranh giới.
- Search bỏ qua dependency/build tree và giới hạn số kết quả.
- Ghi tệp nhạy cảm dùng thao tác nguyên tử khi implementation yêu cầu.
- Tên workspace thô không được dùng trực tiếp làm tên file persistence; scope riêng tư dùng identity đã hash.

## Attachment, ảnh và PDF

Attachment chat chỉ được cấp quyền từ một `File` thật do người dùng chọn hoặc kéo thả:

1. preload đổi lựa chọn thành capability ngẫu nhiên có thời hạn;
2. main ghim identity, size và thời gian sửa của regular file;
3. symlink, file đã đổi hoặc quá kích thước bị từ chối;
4. raw path, capability, preview URL và attachment byte bị loại khỏi lịch sử lưu bền.

Capability hết hạn yêu cầu người dùng chọn lại file. Renderer không thể tự khai báo một path tùy ý để biến nó thành attachment hợp lệ.

Ảnh và trang PDF được đọc có thể được gửi tới provider multimodal. PDF trên 10 trang cần range rõ ràng, tối đa 20 trang mỗi lần theo contract hiện tại.

## Command và process

- Process con do agent điều khiển nhận environment theo allow-list, không nhận toàn bộ `process.env`.
- Git và process launcher dùng executable cùng mảng argument; input động không được nội suy vào `exec` string.
- Command timeout có đường dừng và kill fallback.
- Background command có state/output riêng và stop capability; PID lưu trên đĩa không tự trở thành quyền điều khiển.
- Terminal do người dùng mở là một bề mặt tương tác mạnh; nội dung bạn tự nhập không qua approval tool của agent.

## Credential

- API key và bearer token được main process sở hữu.
- Electron `safeStorage` được dùng khi khả dụng.
- Fallback plaintext phải phát cảnh báo rõ ràng; không được âm thầm coi là mã hóa.
- Credential không được đưa vào renderer projection, trace, audit hoặc tool output.
- MCP stdio chỉ nhận môi trường an toàn của SDK và credential được cấu hình rõ ràng.

## Network

- MCP Streamable HTTP yêu cầu HTTPS, ngoại trừ loopback HTTP.
- OAuth dùng PKCE, callback loopback ngẫu nhiên và kiểm tra state.
- WebFetch giới hạn redirect, timeout, kích thước và content; endpoint công khai phải qua kiểm tra địa chỉ.
- Remote trigger mặc định không tồn tại trong tool catalog cho tới khi được bật. Nó từ chối redirect, giới hạn thời gian/body và che bearer token nếu endpoint phản chiếu lại.
- Network tool vẫn qua policy, approval, hook, audit và trace.

## Skill, plugin và hook

- Skill phải có metadata hợp lệ, được trust và enable trước khi instruction được nạp.
- `allowed-tools` trong skill không vượt central policy.
- Plugin workspace có LSP command chỉ được chạy sau khi content hash chính xác được trust và enable.
- Hook chỉ dùng action khai báo trong allow-list. Không có hook action để cấp quyền, chạy shell, gọi model hoặc gửi HTTP.
- Project instruction là hướng dẫn do workspace cung cấp; nó không thể cấp quyền hoặc cho phép data egress.

## Agent worker và team

- Worker kế thừa mode, policy, plan, workspace và giới hạn spawn.
- Child process dùng bootstrap credential qua kênh riêng và environment đã lọc.
- Tool execution, approval, audit, hook, checkpoint và trace vẫn thuộc parent.
- Message team được xác thực, giới hạn scope và có chống replay/duplicate ở tầng persistence.
- Teammate không được mở rộng authority hoặc tạo cây worker không giới hạn.

## IPC và renderer

- Preload chỉ expose API cần thiết qua `contextBridge`.
- Payload từ renderer được coi là `unknown` và validate ở main.
- Event subscription phải trả cleanup function.
- Component React không gọi trực tiếp `window.agentStudio`; hook/application adapter là lớp trung gian.
- TypeScript type không thay thế validation runtime.

## Dữ liệu lưu cục bộ

Tùy tính năng, Electron `userData` có thể chứa settings, chat history, knowledge, task/checkpoint, trace, evaluation, optimizer, skill, MCP, worker/team và background state.

Các nguyên tắc chung:

- secret mã hóa khi nền tảng hỗ trợ;
- private file dùng quyền owner-only ở hệ điều hành hỗ trợ;
- write quan trọng ưu tiên atomic replacement;
- dữ liệu có giới hạn kích thước/số lượng;
- schema được validate khi đọc lại;
- nội dung nhạy cảm không được đưa vào audit/trace.

Windows không cung cấp semantics permission bit POSIX giống Linux/macOS; ứng dụng không nên diễn giải mode bit trên Windows như bằng chứng bảo mật.

## Checklist cho người dùng

Trước khi cho phép hành động:

1. Đọc mô tả tool và tác động.
2. Mở **Chi tiết kỹ thuật** nếu command/path chưa rõ.
3. Không duyệt command đọc secret hoặc thư mục ngoài phạm vi công việc.
4. Dùng `read-only` cho repository lạ.
5. Commit hoặc sao lưu thay đổi quan trọng trước khi dùng quyền ghi.
6. Thu hồi API key nếu nghi ngờ output hoặc log đã làm lộ credential.

## Giới hạn hiện tại

- Windows chưa có sandbox an toàn cho agent command trong `workspace-write`.
- Cron không đánh thức ứng dụng đã đóng.
- Một provider hoặc MCP server độc hại vẫn nhìn thấy dữ liệu bạn chủ động cho phép gửi tới nó.
- Full parity với mọi client/provider không phải mục tiêu đã hoàn thành.

Xem [bảng đối chiếu và roadmap](reference-client-parity.md) để biết các khoảng trống đã được xác nhận từ mã nguồn.
