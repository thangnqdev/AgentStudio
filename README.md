# AgentStudio

AgentStudio là ứng dụng desktop giúp người dùng giao việc cho AI agent trong một dự án mã nguồn mà không phải thao tác trực tiếp với terminal hay API. Ứng dụng tập trung vào trải nghiệm dễ hiểu, kiểm soát quyền rõ ràng và khả năng theo dõi những gì agent đang thực hiện.

## AgentStudio làm được gì?

- Kết nối các nhà cung cấp tương thích OpenAI API, chọn model chính và model dự phòng.
- Trao đổi với agent theo từng tác vụ, lưu lịch sử cục bộ và tiếp tục phiên bị gián đoạn.
- Cho phép agent đọc, tìm kiếm, chỉnh sửa tệp, chạy lệnh và nghiên cứu web trong phạm vi được cấp.
- Hiển thị tiến độ tool bằng ngôn ngữ dễ hiểu; yêu cầu xác nhận riêng cho hành động nhạy cảm.
- Phân công agent hỗ trợ, quản lý nhóm agent, đầu việc, mailbox và tiến độ song song.
- Quản lý cơ sở tri thức, MCP server, skill, workflow, đánh giá, trace và tối ưu an toàn.
- Duyệt tệp, mở terminal và theo dõi hoạt động ngay trong workspace của ứng dụng.

AgentStudio hiện phát hành chính thức cho Windows. Các giới hạn tương thích và phần chưa hoàn thiện được ghi rõ trong [bảng đối chiếu tính năng](docs/reference-client-parity.md).

## Bắt đầu nhanh

Yêu cầu môi trường phát triển:

- Node.js 22
- npm
- Windows 10/11 để đóng gói và kiểm tra bản cài chính thức

```bash
npm install
npm run dev
```

Các lệnh kiểm tra thường dùng:

```bash
npm run lint
npm test
npm run build
```

Sau khi mở ứng dụng, vào **Cài đặt** để:

1. Thêm provider, Base URL và API key.
2. Nhập model thủ công hoặc chọn **Lưu & quét model**.
3. Chọn workspace và chế độ quyền phù hợp.
4. Tạo một tác vụ mới rồi mô tả kết quả bạn muốn.

## Ba chế độ quyền

| Chế độ | Phạm vi |
|---|---|
| Chỉ xem | Agent chỉ được đọc và phân tích. |
| Chỉnh sửa trong dự án | Cho phép thay đổi trong workspace; hành động ghi/chạy lệnh có thể cần xác nhận. |
| Toàn quyền dự án | Cho phép phạm vi rộng hơn và chạy lệnh không sandbox; chỉ dùng với dự án đáng tin cậy. |

Quy tắc `deny` và `ask` của người dùng hoặc workspace vẫn có thể siết quyền thêm. Xem [mô hình bảo mật](docs/bao-mat.md) trước khi dùng chế độ toàn quyền.

## Tài liệu

- [Mục lục tài liệu](docs/README.md)
- [Hướng dẫn sử dụng](docs/huong-dan-su-dung.md)
- [Kiến trúc hệ thống](docs/kien-truc.md)
- [Bảo mật và dữ liệu](docs/bao-mat.md)
- [Phát triển và phát hành](docs/phat-trien-va-phat-hanh.md)
- [Lịch sử thay đổi](CHANGELOG.md)
- [Bảng đối chiếu tính năng và roadmap](docs/reference-client-parity.md)

## Công nghệ chính

Electron 43, React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Zustand 5 và Vitest 4.

## Trạng thái dự án

AgentStudio đang được phát triển tích cực. Đây là công cụ có khả năng đọc tệp, gửi dữ liệu tới model provider và thực thi lệnh khi được cấp quyền; hãy dùng workspace thử nghiệm và sao lưu mã nguồn quan trọng trước khi trao quyền ghi hoặc toàn quyền.
