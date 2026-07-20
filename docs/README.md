# Tài liệu AgentStudio

Tài liệu này mô tả trạng thái của mã nguồn hiện tại. Khi hành vi trong tài liệu khác với mã nguồn, contract domain, IPC và test trong repository là nguồn xác thực cuối cùng.

## Dành cho người sử dụng

| Tài liệu | Nội dung |
|---|---|
| [Hướng dẫn sử dụng](huong-dan-su-dung.md) | Thiết lập provider, workspace, tác vụ, quyền, tool và agent hỗ trợ. |
| [Bảo mật và dữ liệu](bao-mat.md) | Dữ liệu rời khỏi máy, quyền thực thi, lưu trữ cục bộ và các giới hạn an toàn. |
| [Lịch sử thay đổi](../CHANGELOG.md) | Những thay đổi theo từng phiên bản phát hành. |

## Dành cho người phát triển

| Tài liệu | Nội dung |
|---|---|
| [Kiến trúc hệ thống](kien-truc.md) | Hai tiến trình Electron, Clean Architecture, IPC và các subsystem chính. |
| [Phát triển và phát hành](phat-trien-va-phat-hanh.md) | Môi trường, lệnh kiểm tra, quy tắc code và quy trình phát hành Windows. |
| [Đối chiếu reference client](reference-client-parity.md) | Bằng chứng tính năng, khác biệt tương thích và roadmap còn lại. |
| [AGENTS.md](../AGENTS.md) | Quy tắc bắt buộc khi thay đổi mã nguồn. |

## Hồ sơ quyết định kiến trúc

Thư mục [`docs/adr/`](adr/) chứa các ADR từ quan sát agent, đánh giá, workflow và optimizer đến subagent, worktree, MCP, attachment, streaming và context compaction. ADR là hồ sơ quyết định kỹ thuật nên được giữ nguyên ngữ cảnh lịch sử; tài liệu tổng hợp ở trên phản ánh cách sử dụng hiện tại.

## Quy ước cập nhật

- README gốc chỉ giới thiệu tổng quan và đường dẫn bắt đầu.
- Hướng dẫn thao tác dành cho người dùng nằm trong `huong-dan-su-dung.md`.
- Thay đổi liên quan quyền, dữ liệu gửi ra ngoài hoặc lưu trữ bí mật phải cập nhật `bao-mat.md`.
- Thay đổi ranh giới tiến trình, lớp hoặc IPC phải cập nhật `kien-truc.md` và ADR tương ứng.
- Mỗi bản phát hành phải cập nhật `package.json`, `package-lock.json` và `CHANGELOG.md`.
