# Hướng dẫn sử dụng AgentStudio

## 1. Thiết lập lần đầu

### Chọn dự án

AgentStudio làm việc theo một workspace cục bộ. Chọn thư mục dự án trước khi tạo tác vụ để lịch sử chat, quyền truy cập tệp, terminal và trạng thái agent cùng trỏ vào đúng phạm vi.

Khi đổi workspace, ứng dụng lưu lịch sử đang dùng trước khi chuyển. Danh sách tác vụ và tính năng tiếp tục phiên chỉ tra cứu trong workspace hiện tại.

### Kết nối model provider

Mở **Cài đặt** và thêm một provider tương thích OpenAI Chat Completions:

1. Đặt tên provider.
2. Nhập Base URL.
3. Nhập API key nếu provider yêu cầu.
4. Nhập danh sách model thủ công hoặc chọn **Lưu & quét model**.
5. Chọn model chính và, nếu cần, model dự phòng.

**Lưu** không cần gọi mạng nên phù hợp khi provider không có endpoint liệt kê model. **Lưu & quét model** sẽ kết nối tới catalog của provider; lỗi quét không ngăn bạn lưu cấu hình thủ công.

Nếu mở giao diện ngoài Electron hoặc preload không hoạt động, AgentStudio hiển thị lỗi **Không tìm thấy Electron bridge**. Đây không phải lỗi Base URL của provider.

## 2. Làm việc với tác vụ

Chọn **Tác vụ mới**, mô tả kết quả mong muốn bằng ngôn ngữ tự nhiên và gửi yêu cầu. Mỗi tác vụ có lịch sử riêng và xuất hiện trong danh sách dự án.

Một yêu cầu tốt nên nói rõ:

- kết quả cuối cùng cần đạt;
- thư mục hoặc phần mã nguồn liên quan;
- điều không được thay đổi;
- cách kiểm tra hoàn thành, nếu bạn đã biết.

Không cần mô tả lệnh terminal hoặc tên tool. Agent sẽ tự chọn công cụ phù hợp trong giới hạn quyền.

### Trạng thái tool

Hoạt động bình thường được trình bày gọn để không làm chat giống bảng log:

- dấu chấm chuyển động: tool đang chạy;
- dấu kiểm xanh: bước đã hoàn tất;
- **Đã hoàn tất N bước**: nhiều tool liên tiếp đã được gộp;
- card màu cam: cần bạn cho phép;
- card màu đỏ: có lỗi và có thể **Thử lại**.

Đối số, command, JSON và output thô được đóng mặc định trong **Chi tiết kỹ thuật**. Chỉ mở phần này khi cần chẩn đoán.

Animation tự tắt khi hệ điều hành bật chế độ giảm chuyển động. Thông báo tiến độ dùng vùng live mức `polite` để hỗ trợ trình đọc màn hình.

## 3. Chế độ quyền

### Chỉ xem

Phù hợp để review, giải thích và khảo sát. Agent không được ghi tệp hoặc chạy thao tác làm thay đổi dự án.

### Chỉnh sửa trong dự án

Agent có thể làm việc trong workspace. Thao tác ghi, thực thi hoặc truy cập mạng được đánh giá theo risk và quy tắc quyền; hành động nhạy cảm sẽ hiện card **Cho phép/Từ chối**.

Trên Windows, lệnh shell do agent yêu cầu trong chế độ này sẽ fail closed nếu không có sandbox workspace an toàn. Đổi sang **Toàn quyền dự án** chỉ khi bạn hiểu tác động và tin cậy dự án.

### Toàn quyền dự án

Cho phép đường dẫn và lệnh có phạm vi rộng hơn, đồng thời chạy command không sandbox. Quy tắc trung tâm `deny` hoặc `ask` vẫn được ưu tiên.

Không dùng chế độ này với repository lạ, file tải từ Internet hoặc yêu cầu chưa hiểu rõ.

## 4. Các bề mặt làm việc

Thanh bên chính cung cấp:

- **Tác vụ mới** và danh sách tác vụ của dự án;
- **Cơ sở tri thức** để nhập hoặc đồng bộ tài liệu;
- **Đánh giá agent** để chạy và xem bộ đánh giá cục bộ;
- **Tự động hóa** cho workflow có checkpoint;
- **Công cụ & kết nối** để xem capability hiện có;
- **Lịch sử hoạt động**, **Tối ưu an toàn**, **Kỹ năng đã học** và **Hồ sơ agent**;
- **Cài đặt** cho provider, model, MCP, web search, quyền và tích hợp.

Khu vực workspace có thể mở nhiều tab như tác vụ, terminal, trình duyệt nghiên cứu và trình duyệt tệp. Utility dock bên phải hiển thị hoạt động agent, chi tiết tác vụ, kết quả đánh giá hoặc tệp mà không rời cuộc trò chuyện.

## 5. Công cụ cục bộ

Nhóm công cụ nền tảng gồm:

- liệt kê, đọc, tìm kiếm và chỉnh sửa tệp;
- `glob` và `grep` có kết quả giới hạn;
- đọc ảnh, PDF và Jupyter notebook trong giới hạn định dạng;
- chạy command foreground hoặc background;
- tìm kiếm web qua connector đã cấu hình;
- tải skill đã được tin cậy và bật;
- các alias tương thích như `Read`, `Write`, `Edit`, `Bash`, `PowerShell` và `WebSearch`.

Tool chuyên biệt và tool MCP có thể được deferred. Agent dùng `ToolSearch` để nạp schema cần thiết ở lượt tiếp theo, giúp giảm context lặp lại.

## 6. Agent hỗ trợ và nhóm agent

Agent chính có thể tạo worker độc lập để xử lý phần việc riêng. Worker:

- kế thừa giới hạn quyền, sandbox, workspace và plan của agent cha;
- có transcript và trạng thái riêng;
- có thể chạy foreground hoặc background;
- không thể tự tăng quyền;
- có thể được tiếp tục từ checkpoint khi bị gián đoạn.

Nhóm agent bổ sung roster, mailbox và danh sách đầu việc dùng chung. Thành viên có thể nhận việc, gửi tin trực tiếp hoặc broadcast và báo trạng thái. Roster là phẳng: teammate không tự tạo thêm teammate có tên.

Control center và utility dock ưu tiên agent đang chờ bạn duyệt, đồng thời cho phép xem tool hiện tại, kết quả, lỗi, worktree và dừng agent.

## 7. Cơ sở tri thức

Bạn có thể thêm tài liệu riêng lẻ hoặc đồng bộ các tệp hỗ trợ từ workspace:

- thư mục dependency/build, `.env`, key và certificate phổ biến bị loại trừ;
- mã TypeScript/JavaScript được chia theo symbol AST khi có thể;
- định dạng khác dùng text chunking;
- embedding profile và phiên bản chunking được lưu cùng dữ liệu.

Khi đổi embedding endpoint hoặc model, hãy reindex thay vì trộn vector không tương thích.

## 8. MCP, skill, plugin và hook

- MCP server chỉ được thêm từ **Cài đặt**. Model, skill và file trong repository không được tự đăng ký server.
- Skill chỉ vào prompt sau khi được người dùng tin cậy và bật.
- Plugin cục bộ có thể cung cấp hook khai báo và LSP server; cấu hình từ workspace cần trust theo content hash.
- Hook trong `.agentstudio/hooks.json` chỉ có action khai báo được allow-list. Hook không thể tự cấp quyền, chạy shell, gọi model hoặc gửi HTTP.

Mọi tool từ MCP hoặc plugin vẫn đi qua policy, approval, audit và trace chung.

## 9. Lệnh nhanh trong composer

Gõ `/` để mở bảng lệnh. Các lệnh thường dùng:

| Lệnh | Tác dụng |
|---|---|
| `/model` | Chọn model đang dùng. |
| `/permissions` | Chọn chế độ quyền. |
| `/resume` hoặc `/continue` | Tìm phiên paused/failed trong workspace hiện tại. |
| `/rename` | Đổi tên tác vụ hiện tại. |
| `/context` | Xem ước lượng context đã dùng/còn lại. |
| `/status` | Xem phiên bản, provider, model, quyền, workspace và nhánh Git. |
| `/hooks` | Xem metadata hook hiệu lực đã được làm sạch. |
| `/compact` | Thu gọn lịch sử cũ bằng quy trình cục bộ có giới hạn. |
| `/plan` | Yêu cầu agent lập kế hoạch để bạn duyệt trước. |
| `/clear`, `/new` | Dọn hoặc tạo luồng công việc mới. |

## 10. Tác vụ nền, workflow và lịch

- Command nền có trạng thái và output bền vững; thông báo hoàn tất có thể đưa bạn về đúng chat.
- Workflow lưu checkpoint theo node và có thể dừng ở bước approval rồi tiếp tục mà không chạy lại bước đã thành công.
- Cron trong AgentStudio chỉ chạy khi ứng dụng và scope liên quan hoạt động. Ứng dụng không cài service hệ điều hành và không tự đánh thức máy khi đã đóng.
- Remote trigger phải được bật rõ ràng trong Cài đặt và vẫn chịu policy mạng.

## 11. Khi gặp lỗi

1. Mở **Chi tiết kỹ thuật** để xem phần output cần thiết.
2. Dùng **Thử lại** để chạy lại phản hồi từ yêu cầu người dùng gần nhất.
3. Kiểm tra provider/model và workspace trong `/status`.
4. Nếu là hành động bị chặn, kiểm tra chế độ quyền và `.agentstudio/permissions.json`.
5. Nếu renderer báo thiếu bridge, chạy bản desktop qua `npm run dev` hoặc bản đã cài đặt.

Xem thêm [bảo mật và dữ liệu](bao-mat.md) trước khi chẩn đoán bằng command có thể in thông tin nhạy cảm.
