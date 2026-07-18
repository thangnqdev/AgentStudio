import { ipcMain } from 'electron';
import { parseAttachmentAuthorizationRequest } from '../application/services/attachmentAuthorizationValidation.js';
import { attachmentAuthorizations } from '../attachmentRuntime.js';

export function registerAttachmentIpc() {
  ipcMain.handle('attachments:authorize', async (_event, rawPayload: unknown) => {
    const payload = parseAttachmentAuthorizationRequest(rawPayload);
    if (!payload) return { success: false as const, error: 'Thông tin tệp đính kèm không hợp lệ.' };
    try {
      return { success: true as const, data: await attachmentAuthorizations.authorize(payload) };
    } catch (error) {
      return {
        success: false as const,
        error: error instanceof Error ? error.message : 'Không thể cấp quyền đọc tệp đính kèm.',
      };
    }
  });
}
