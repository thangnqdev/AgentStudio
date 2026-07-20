triển khai đủ 3 chế độ System / Light / Dark, mặc định System. Nếu chỉ cần giao diện tối cố định thì có thể bỏ phần lưu lựa
  chọn và UI chuyển theme.

  ## Hiện trạng

  - src/index.css đã có semantic color tokens nhưng chỉ có palette sáng.
  - Khoảng 408 chỗ dùng màu literal hoặc white/black trên 50 file; tập trung ở Sidebar, TopAppBar, workspace, chat và Utility Dock.
  - Terminal và code block đã có palette tối riêng, nên giữ độc lập.
  - src/App.css không được import, có thể xóa trong đợt cleanup.
  - Không cần thêm IPC hoặc sửa electron/main.ts.

  ## Kế hoạch triển khai

  ### 1. Xây nền theme

  - Tạo type thuần: ThemePreference = 'system' | 'light' | 'dark'.
  - Viết pure function resolve system → light/dark, có unit test.
  - Tạo browser adapter chịu trách nhiệm:
      - Đọc/ghi preference trong localStorage.
      - Theo dõi matchMedia('(prefers-color-scheme: dark)').
      - Gắn data-theme="light|dark" và color-scheme lên <html>.

  - Khởi tạo theme trước createRoot() để tránh flash giao diện sáng.

  Tailwind v4 hỗ trợ đúng mô hình semantic CSS variables kết hợp selector data-theme, phù hợp hơn việc rải dark: khắp component. Tailwind
  theme variables (https://tailwindcss.com/docs/colors), Tailwind dark mode (https://tailwindcss.com/docs/dark-mode).

  ### 2. Chuẩn hóa design tokens

  Tách palette trong src/index.css:

  - Surface: background, workspace, sidebar, toolbar, panel, elevated surface.
  - Content: primary, secondary, muted, inverse.
  - Interaction: hover, selected, focus ring, disabled.
  - Border, divider, overlay và shadow.
  - Status: success, warning, error, info.
  - Khai báo hai bộ giá trị dưới :root và [data-theme='dark'].

  Các component chỉ dùng class semantic như bg-surface, text-on-surface-variant, border-outline-variant.

  ### 3. Thêm điều khiển giao diện

  - Tạo AppearanceSettingsPanel.tsx.
  - Thêm tab hoặc section “Giao diện” trong src/components/SettingsView.tsx.
  - Cung cấp ba lựa chọn System, Light, Dark.
  - State đi qua hook/provider; component không truy cập localStorage hoặc browser API trực tiếp.

  ### 4. Migration UI theo từng cụm

  Nên chia thành các PR nhỏ:

  1. App shell: App, Sidebar, TopAppBar, WorkspaceTabBar, WorkspaceLauncher.
  2. Chat: ChatArea, PromptComposer, message, picker, dialog, overlay.
  3. Utility Dock và các workspace Files/Browser/Evaluations.
  4. Settings và các màn hình Knowledge, Workflow, Agents, Optimizer.
  5. Cleanup các màu literal còn lại.

  Giữ cố định:

  - Màu traffic lights của macOS.
  - ANSI palette của terminal.
  - Palette code block.
  - Màu status có ý nghĩa, nhưng bổ sung biến thể tương phản cho dark mode.

  ### 5. Kiểm thử và QA

  - Unit test resolve theme, fallback khi storage sai và phản ứng khi system theme đổi.
  - Chạy npm test, npm run lint, npm run build.
  - QA cả ba chế độ trên:
      - Hover, selected, focus và disabled.
      - Modal, popup, tooltip, overlay.
      - Scrollbar, input, select.
      - Chat dài, markdown, code block.
      - Sidebar đóng/mở và Utility Dock responsive.

  - Kiểm tra text thường đạt contrast tối thiểu 4.5:1.

  ## Tiêu chí hoàn thành

  - Không còn nền sáng “lọt” trong dark mode.
  - Không có flash light theme khi khởi động.
  - Đổi system theme được phản ánh khi đang chạy.
  - Không thêm dark: rải rác nếu có thể biểu diễn bằng semantic token.
  - Màu literal chỉ còn ở terminal, code syntax, traffic lights hoặc trường hợp được ghi chú.
  - Không file nào vượt giới hạn trong .agent/FILE_SIZE_AND_SRP.md.

  Ước lượng hợp lý: 3–4 ngày phát triển và QA, nên chia thành 3–4 PR để review an toàn. Chưa có code nào được thay đổi ở bước lập kế hoạch
  này.