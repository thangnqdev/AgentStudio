# Implementation Plan: Dark / Light / System Theme

> Trạng thái: Hoàn thành ngày 2026-07-20. Automated checks: 670 tests pass, lint sạch,
> production build thành công. Visual QA đã thực hiện cho light/dark/system, cold restart,
> Settings, workspace launcher, chat/markdown/code block và Utility Dock.

## Tổng quan

Triển khai ba chế độ giao diện `System / Light / Dark` cho AgentStudio bằng semantic CSS
tokens và thuộc tính `data-theme` trên `<html>`. Không rải `dark:` variants trong component.

Audit hiện tại ghi nhận khoảng 408 lần dùng màu literal hoặc `white`/`black` trên 50 file.
Con số này bao gồm cả token definitions và các màu cố ý giữ riêng như terminal ANSI và macOS
traffic lights; mục tiêu không phải xóa máy móc toàn bộ literal mà là loại bỏ literal phụ thuộc
light theme khỏi UI thông thường.

## Các điều chỉnh sau review

Plan ban đầu đúng về hướng tổng thể nhưng cần sửa các điểm sau trước khi triển khai:

1. Tailwind v4 cần giữ `@theme inline` ở top-level để sinh utility, còn giá trị light/dark đặt
   trong regular CSS variables dưới `:root` và `[data-theme='dark']`.
2. `useTheme` không import concrete browser/IPC adapter. Hook phụ thuộc port và adapter được
   inject tại composition root `src/main.tsx`.
3. Theme preference được lưu trong settings phía Electron thay vì chỉ dùng `localStorage`.
   Nhờ vậy splash và `BrowserWindow.backgroundColor` biết theme trước khi renderer mount.
4. Success/warning/info là semantic tokens có palette riêng cho light/dark; không giữ các màu
   status literal vì contrast trên nền tối không được bảo đảm.
5. User message dùng token riêng, không dùng cặp `primary-container/on-primary-container` hiện
   tại vì cặp đó không mô tả đúng vai trò và không bảo đảm contrast.
6. Không khẳng định trước số lượng test hiện có; completion gate là toàn bộ suite hiện tại pass.

---

## Phase 1 — Domain và pure logic

### Renderer

#### [NEW] `src/domain/entities/theme.ts`

- `ThemePreference = 'system' | 'light' | 'dark'`
- `ResolvedTheme = 'light' | 'dark'`

#### [NEW] `src/domain/ports/theme.ts`

- `ThemePreferencePort`: load/save preference.
- `ThemeEnvironmentPort`: đọc system scheme, subscribe thay đổi và apply resolved theme.

#### [NEW] `src/application/services/theme.ts`

- `resolveTheme(preference, systemIsDark)` là pure function.
- `isThemePreference(value)` validate dữ liệu ở biên.

#### [NEW] `src/application/services/theme.test.ts`

- System theo OS.
- Light/dark explicit override OS.
- Giá trị không hợp lệ được nhận diện để fallback an toàn.

### Electron main process

#### [NEW] `electron/domain/entities/theme.ts`

- Type thuần tương ứng cho main runtime; không import code runtime từ renderer.

#### [NEW] `electron/application/services/themePreference.ts`

- Normalize stored theme preference.
- Resolve preference với `nativeTheme.shouldUseDarkColors` cho splash/main window.
- Có unit test pure, không cần Electron runtime.

---

## Phase 2 — Persistence, IPC và browser adapters

### [MODIFY] `electron/domain/entities/settings.ts`

- Thêm `themePreference` vào `StoredSettings` với default `system`.

### [MODIFY] `electron/infrastructure/JsonSettingsRepository.ts`

- Normalize field cũ/thiếu/sai về `system`.
- Giữ backward compatibility với settings.json hiện tại.

### [NEW] `electron/application/usecases/ManageThemePreference.ts`

- Load và save riêng theme preference qua `ISettingsRepository`.
- Không thêm concern theme vào `ManageProviderSettings`.

### [NEW] `electron/ipc/registerThemeIpc.ts`

- `theme:load` và `theme:save`.
- Validate input tại main.
- Response theo `IpcResult<T>` shape.
- Handler mỏng, chỉ gọi use-case.

### [MODIFY] `electron/preload.ts` và `src/types/electron.d.ts`

- Expose/type đầy đủ `loadThemePreference` và `saveThemePreference`.

### [NEW] `src/infrastructure/ipc/themePreferenceBridge.ts`

- Là nơi duy nhất renderer gọi `window.agentStudio` cho theme preference.

### [NEW] `src/infrastructure/browser/browserThemeEnvironment.ts`

- `matchMedia('(prefers-color-scheme: dark)')`.
- Subscribe/unsubscribe system changes.
- Apply `data-theme` và CSS `color-scheme` lên `document.documentElement`.

---

## Phase 3 — Bootstrap và reactive theme state

### [NEW] Theme context modules

- `src/application/hooks/themeContext.ts` giữ context contract.
- `src/application/hooks/ThemeProvider.tsx` nhận hai port từ composition root.
- `src/application/hooks/useTheme.ts` chỉ expose hook đọc context.
- Quản lý `{ preference, resolvedTheme, setPreference, isSaving }`.
- Theo dõi system theme chỉ khi cần và cleanup listener.
- UI update ngay; rollback preference nếu persistence thất bại.
- Component không truy cập IPC/browser API trực tiếp.

### [MODIFY] `src/main.tsx`

- Load preference và apply resolved theme trước `createRoot()`.
- Inject adapters vào `ThemeProvider`.
- Bridge unavailable thì fallback `system`, không chặn renderer.

### [MODIFY] `electron/main.ts`

- Chỉ wiring `registerThemeIpc()`; không thêm IPC callback trực tiếp.
- Resolve theme trước khi show splash/create main window.
- Dùng background tương ứng cho `BrowserWindow` để không lóe màu đối nghịch.

### [MODIFY] `electron/infrastructure/SplashWindow.ts`

- Render palette light hoặc dark theo resolved startup theme.
- Giữ nguyên trách nhiệm quản lý splash; không truy cập settings trực tiếp.

---

## Phase 4 — CSS design tokens

### [MODIFY] `src/index.css`

Khai báo primitive variables theo theme:

```css
:root {
  --theme-background: #ffffff;
  --theme-surface: #ffffff;
  --theme-on-surface: #242424;
}

[data-theme='dark'] {
  --theme-background: #18181a;
  --theme-surface: #1e1e21;
  --theme-on-surface: #e8e8ea;
}

@theme inline {
  --color-background: var(--theme-background);
  --color-surface: var(--theme-surface);
  --color-on-surface: var(--theme-on-surface);
}
```

Nhóm token cần có:

- Surfaces: background, workspace, sidebar, toolbar, panel, elevated/container levels.
- Content: on-surface, muted, inverse.
- Interaction: hover, selected, focus, disabled.
- Border, divider, overlay và shadow.
- Status: success, warning, error, info và container/on-container tương ứng.
- User message background/foreground riêng.

Base styles bổ sung `color-scheme`, selection, native controls và scrollbar theo token.

---

## Phase 5 — Migration component theo cụm

### 5.1 App shell và workspace navigation

- `src/App.tsx`
- `src/components/Sidebar.tsx`
- `src/components/TopAppBar.tsx`
- `src/components/workspace/WorkspaceTabBar.tsx`
- `src/components/workspace/WorkspaceLauncher.tsx`

### 5.2 Chat và composer

- `src/components/ChatArea.tsx`
- `src/components/PromptComposer.tsx`
- Các file trong `src/components/chat/`
- User bubble dùng `bg-user-message text-on-user-message`.
- Code block tiếp tục dùng palette dark chuyên biệt.

### 5.3 Utility Dock và workspace views

- Các file trong `src/components/dock/`.
- `TaskWorkspace`, `FilesWorkspaceView`, `BrowserWorkspaceView`.
- Terminal/ANSI palette giữ riêng; chỉ migrate chrome bao quanh terminal.

### 5.4 Settings và các domain views còn lại

- Các panel settings.
- Knowledge, Workflow, Capability, Trace, Evaluation, Optimizer, Skill Learning, Agent Profiles.
- Status literals được thay bằng semantic status tokens.

Các literal được phép giữ sau migration:

- macOS traffic lights.
- Terminal ANSI và code block palette cố định.
- Màu dữ liệu thật sự mang ý nghĩa riêng và có comment giải thích.

---

## Phase 6 — Appearance Settings UI

### [NEW] `src/components/settings/AppearanceSettingsPanel.tsx`

- Ba lựa chọn System / Light / Dark.
- Preview cho từng chế độ.
- Hiển thị trạng thái saving/error có thể truy cập bằng keyboard/screen reader.
- Chỉ gọi `useTheme()`.

### [MODIFY] `src/components/SettingsView.tsx`

- Thêm tab “Giao diện” với icon `contrast`.
- Render `AppearanceSettingsPanel`.

---

## Phase 7 — Cleanup và verification

### Cleanup

- Xóa `src/App.css` vì không được import.
- Audit lại literal colors và phân loại từng ngoại lệ còn lại.
- Kiểm tra line count theo `.agent/FILE_SIZE_AND_SRP.md`.

### Automated verification

- `npm test`
- `npm run lint`
- `npm run build`

### Visual QA

- System/light/dark khi cold start và khi đổi trong Settings.
- System theme đổi trong lúc app đang chạy.
- Sidebar, tabs, dock responsive, modal, popup, overlay, inputs và scrollbar.
- Chat empty/streaming/error/approval, markdown/table/code block.
- Contrast text thường tối thiểu 4.5:1; focus indicator nhìn rõ ở cả hai palette.
- Không có surface sáng bị lọt trong dark mode hoặc surface tối bị lọt trong light mode.

## Thứ tự triển khai

```text
Pure logic → persistence/IPC → bootstrap/provider → CSS tokens
           → app shell → chat → dock/workspaces → settings/domain views
           → appearance UI → cleanup → automated tests → visual QA
```

## Definition of Done

- Theme preference tồn tại qua restart và splash/main window khớp preference ngay từ startup.
- `system` phản ứng với thay đổi OS khi app đang chạy.
- Component không gọi `window.agentStudio`, `localStorage`, `matchMedia` hoặc `document` trực tiếp.
- Không thêm handler trực tiếp vào `electron/main.ts`.
- Không file mới/sửa vượt ngưỡng cứng.
- Test, lint và build pass; visual QA pass cho cả ba chế độ.
