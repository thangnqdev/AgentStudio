export const AttachmentBridge = {
  async authorize(file: File) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.authorizeAttachment(file);
  },
};
