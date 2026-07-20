# Lịch sử thay đổi

Các thay đổi đáng chú ý của AgentStudio được ghi lại trong tài liệu này.

## [0.6.0] - 2026-07-20

### Thay đổi

- Thay khung log tool thông thường bằng dòng trạng thái gọn, dùng nội dung tiếng Việt theo từng hành động.
- Gộp nhiều tool hoàn tất thành một dòng **Đã hoàn tất N bước** và ẩn JSON, command, output trong **Chi tiết kỹ thuật**.
- Giữ card nổi bật cho hành động cần phê duyệt và lỗi; lỗi có nút **Thử lại** chạy lại yêu cầu người dùng tương ứng.
- Bổ sung animation nhẹ cho dấu chấm đang chạy, `aria-live="polite"` và hỗ trợ `prefers-reduced-motion`.
- Viết lại README thành phần tổng quan ngắn bằng tiếng Việt và tách hướng dẫn sử dụng, kiến trúc, bảo mật, phát triển/phát hành thành tài liệu riêng.

## [0.5.0] - 2026-07-19

### Thêm mới

- Workspace tab cho tác vụ, terminal, trình duyệt nghiên cứu và trình duyệt tệp.
- Utility dock có thể thay đổi kích thước để xem hoạt động agent, chi tiết, tệp và kết quả đánh giá.
- Workspace launcher và bộ duyệt tệp đi qua use case/IPC có kiểm tra.
- Service theo dõi tiến độ, tiếp tục cộng tác và registry cho agent worker đang chạy.

### Thay đổi

- Tổ chức lại sidebar, top bar, terminal và khu vực chat theo bố cục workspace mới.
- Cải thiện control center, roster, inspector, timeline và phản hồi trạng thái của agent hỗ trợ.
- Chuẩn hóa hiển thị Markdown, code block, bước suy nghĩ và tiến độ tool trong chat.

## [0.4.0] - 2026-07-18

### Thêm mới

- Control center responsive cho nhiều agent với roster, số liệu trạng thái, inspector, approval, stop, worktree, kết quả, Activity và Mailbox.
- Worker bền vững chạy tách process, team messaging đã xác thực, durable task/mailbox, recovery checkpoint và giới hạn agent lồng nhau.
- Web fetch, LSP, notebook, MCP resource/authentication, cron, remote trigger, IDE context và deferred tool search sau cùng một ranh giới permission/audit.
- Attachment chat được người dùng cấp quyền qua picker, chat history có giới hạn, background-command sidecar và context compaction thủ công.
- Slash command cho model, quyền, resume, rename, context, status, hook và compaction.
- Lifecycle hook khai báo cho session, tool, permission, subagent, team, worktree, file change, background command, compaction và model.

### Thay đổi

- OpenAI-compatible streaming chuẩn hóa content, tool call, usage và cache metrics từ SSE chunk có giới hạn.
- Release theo Git tag tự tạo release note trước khi tải artifact Windows.

### Bảo mật

- Child agent nhận environment đã lọc và không thể vượt quyền, sandbox, plan, tool hoặc workspace kế thừa.
- Attachment, MCP, remote network, path và process dùng capability/validation do main process sở hữu.

[0.6.0]: https://github.com/thangnqdev/AgentStudio/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/thangnqdev/AgentStudio/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/thangnqdev/AgentStudio/releases/tag/v0.4.0
