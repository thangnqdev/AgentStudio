import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';

/**
 * Hook adapter cho terminal IPC bridge.
 * Tách biệt TerminalView component khỏi AgentBridge trực tiếp.
 *
 * Note: terminal operations (createTerminal, onData, onExit...) cần tham chiếu ổn định
 * nên hook trả về bridge trực tiếp — không dùng state vì terminal lifecycle đã được
 * quản lý trong TerminalView effect với disposed flag.
 */
export function useTerminalBridge() {
  return AgentBridge;
}
