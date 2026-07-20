# Phát triển và phát hành AgentStudio

## Môi trường

Môi trường CI phát hành dùng:

- Windows runner;
- Node.js 22;
- npm với `package-lock.json`;
- GitHub Actions và GitHub Releases.

Máy phát triển nên dùng Node.js 22 để giảm khác biệt với workflow phát hành.

## Cài đặt

```bash
npm install
```

Dùng `npm ci` trong môi trường sạch hoặc CI.

## Lệnh dự án

| Lệnh | Mục đích |
|---|---|
| `npm run dev` | Chạy Vite và Electron với reload. |
| `npm run lint` | Chạy Oxlint. |
| `npm test` | Chạy toàn bộ Vitest một lượt. |
| `npm run build` | Type-check và build renderer, main, preload, worker process. |
| `npm run preview` | Preview renderer đã build; không thay thế Electron bridge. |
| `npm run package` | Build và tạo bộ cài Windows cục bộ, không publish. |
| `npm run release` | Build, đóng gói và publish bằng electron-builder. |
| `npm run eval:knowledge` | Tạo/chạy bộ đánh giá knowledge retrieval. |
| `npm run eval:agent` | Chạy golden agent runtime suite. |

Vì renderer phụ thuộc preload bridge, `npm run preview` đơn thuần sẽ hiển thị màn hình chẩn đoán bridge. Dùng `npm run dev` để kiểm tra luồng desktop thật.

## Quality gate

Trước khi coi thay đổi hoàn thành:

```bash
npm run lint
npm test
npm run build
```

Ưu tiên chạy test tập trung cho file vừa thay đổi trước full suite.

Một số test hạ tầng hiện có giả định semantics POSIX cho permission bit, symlink, signal và newline. Trên Windows, các test đó có thể thất bại dù TypeScript/build và test logic liên quan đạt. Không được che lỗi hoặc tuyên bố full suite xanh; cần ghi rõ số lượng/khoanh vùng lỗi và tách công việc tương thích nền tảng.

## Quy tắc kiến trúc bắt buộc

Đọc [`AGENTS.md`](../AGENTS.md) trước khi sửa mã. Các nguyên tắc quan trọng:

- domain không import application/infrastructure/UI;
- component React không gọi `window.agentStudio` trực tiếp;
- IPC controller validate payload và chỉ gọi use case;
- không thêm handler mới vào `electron/main.ts`;
- command nhận input động phải dùng executable và mảng argument;
- process con của agent chỉ nhận environment theo allow-list;
- logic thuần cần nằm trong domain/application và có test độc lập;
- file vượt ngưỡng trong `.agent/FILE_SIZE_AND_SRP.md` phải được tách trước khi hoàn thành.

Tài liệu chi tiết:

- `.agent/CLEAN_ARCHITECTURE.md`;
- `.agent/IPC_CONTRACT.md`;
- `.agent/REACT_COMPONENT_STANDARDS.md`;
- `.agent/SECURITY_CHECKLIST.md`;
- `.agent/FILE_SIZE_AND_SRP.md`;
- `.agent/PR_CHECKLIST.md`.

## Thêm tính năng

Thứ tự triển khai chuẩn:

1. Xác định domain.
2. Thêm entity hoặc port thuần.
3. Viết use case/application service.
4. Cài đặt port trong infrastructure.
5. Nối controller IPC hoặc hook renderer.
6. Cập nhật type bridge trong `src/types/electron.d.ts`.
7. Viết test cho quy tắc và validation.
8. Cập nhật tài liệu người dùng/bảo mật/kiến trúc phù hợp.

## Phiên bản

AgentStudio dùng semantic versioning:

- **patch**: sửa lỗi tương thích, không thêm hành vi đáng kể;
- **minor**: thêm tính năng hoặc thay đổi UX tương thích;
- **major**: thay đổi contract hoặc dữ liệu không tương thích.

Nguồn phiên bản phát hành:

- `package.json`;
- hai trường version cấp root trong `package-lock.json`;
- client info của MCP tại `electron/infrastructure/mcp/McpConnectionRegistry.ts`;
- mục phát hành trong `CHANGELOG.md`.

Trước khi tạo tag, kiểm tra không còn phiên bản cũ ngoài fixture/protocol độc lập:

```bash
rg "0\\.5\\.0|v0\\.5\\.0" --glob "!node_modules/**" --glob "!dist*/**" --glob "!release/**"
```

Thay số trong lệnh bằng phiên bản đang nâng.

## Tạo bản cài cục bộ

```bash
npm run package
```

Artifact được tạo dưới `release/` với tên:

```text
AgentStudio-Setup-<version>.exe
```

Builder đóng gói `dist/`, `dist-electron/`, dependency runtime và `package.json`; `node-pty` được unpack khỏi ASAR.

## Phát hành GitHub

Workflow `.github/workflows/release.yml` chạy khi push tag `v*`:

1. checkout repository;
2. cài Node.js 22;
3. chạy `npm ci`;
4. tạo đúng một GitHub Release cho tag;
5. chạy `npm run release`;
6. tải installer và `latest.yml` lên release.

Quy trình đề xuất:

```bash
# Sau khi đã cập nhật version, changelog và chạy quality gate
git add package.json package-lock.json CHANGELOG.md README.md docs electron/infrastructure/mcp/McpConnectionRegistry.ts
git commit -m "chore: release 0.6.0"
git tag v0.6.0
git push origin master --follow-tags
```

Không tạo tag nếu quality gate hoặc tài liệu phát hành chưa được xác nhận.

Để publish cục bộ, đặt `GH_TOKEN` có quyền phù hợp rồi chạy:

```bash
npm run release
```

Auto-update của electron-updater cần repository phát hành công khai hoặc một cơ chế xác thực riêng. Client chỉ nhận version lớn hơn version đang cài.

## Changelog

`CHANGELOG.md` dùng cấu trúc:

- **Thêm mới** cho capability mới;
- **Thay đổi** cho UX/contract tương thích;
- **Sửa lỗi** cho hành vi sai;
- **Bảo mật** cho thay đổi trust boundary;
- link tag ở cuối file.

Không đưa roadmap chưa triển khai vào changelog của bản phát hành.
