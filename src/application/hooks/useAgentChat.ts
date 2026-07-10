import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Message } from '../../domain/entities/message';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';

export function useAgentChat() {
  const addMessage = useAppStore((s) => s.addMessage);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const appendMessageContent = useAppStore((s) => s.appendMessageContent);
  const setIsAgentTyping = useAppStore((s) => s.setIsAgentTyping);
  const setActiveRequestId = useAppStore((s) => s.setActiveRequestId);
  const upsertAgentAction = useAppStore((s) => s.upsertAgentAction);
  const clearAgentActions = useAppStore((s) => s.clearAgentActions);
  const appendAgentThoughtChunk = useAppStore((s) => s.appendAgentThoughtChunk);
  const clearAgentThoughts = useAppStore((s) => s.clearAgentThoughts);
  const activeRequestId = useAppStore((s) => s.activeRequestId);
  const replaceUserMessageAndTrim = useAppStore((s) => s.replaceUserMessageAndTrim);
  const setResumableTask = useAppStore((s) => s.setResumableTask);
  const workspacePath = useAppStore((s) => s.settings.workspacePath);

  useEffect(() => {
    if (!AgentBridge.isAvailable || !workspacePath || workspacePath === 'chưa có dự án') return;
    AgentBridge.listResumableAgentTasks()
      .then((result) => {
        if (result.success && result.tasks[0]) {
          const task = result.tasks[0];
          setResumableTask({ id: task.id, title: task.title, completedSteps: task.completedSteps });
        }
      })
      .catch(() => undefined);
  }, [setResumableTask, workspacePath]);

  const startAgentResponse = async (messagesToSend: Message[], taskId?: string) => {
    clearAgentActions();
    clearAgentThoughts();
    setResumableTask(null);
    setIsAgentTyping(true);
    
    const agentMsgId = addMessage({ sender: 'agent', content: '', type: 'text', status: 'sending' });
    let hasStartedResponse = false;

    try {
      const { streamChatCompletion } = await import('../../services/ai');
      await streamChatCompletion(
        messagesToSend,
        (chunk) => {
          if (!hasStartedResponse) {
            hasStartedResponse = true;
          }
          setIsAgentTyping(false);
          appendMessageContent(agentMsgId, chunk);
        },
        () => {
          const finalActions = useAppStore.getState().agentActions;
          updateMessage(agentMsgId, { status: 'done', actions: finalActions });
          setIsAgentTyping(false);
          setActiveRequestId(null);
          clearAgentActions();
          clearAgentThoughts();
        },
        (error) => {
          const finalActions = useAppStore.getState().agentActions;
          updateMessage(agentMsgId, { content: `\n\n**Lỗi AI**: ${error}`, status: 'error', actions: finalActions });
          setIsAgentTyping(false);
          setActiveRequestId(null);
          clearAgentActions();
          clearAgentThoughts();
        },
        setActiveRequestId,
        (action) => {
          setIsAgentTyping(false);
          upsertAgentAction(action);
        },
        (thought, requestId) => {
          setIsAgentTyping(false);
          appendAgentThoughtChunk(requestId, thought);
        },
        (task) => {
          if (task.status === 'paused') {
            setResumableTask({ id: task.taskId, completedSteps: task.completedSteps });
          }
        },
        taskId,
      );
    } catch (error) {
      const finalActions = useAppStore.getState().agentActions;
      updateMessage(agentMsgId, { 
        content: `\n\n**Lỗi hệ thống**: ${error instanceof Error ? error.message : String(error)}`, 
        status: 'error', 
        actions: finalActions 
      });
      setIsAgentTyping(false);
      setActiveRequestId(null);
      clearAgentActions();
      clearAgentThoughts();
    }
  };

  const stopAgentResponse = async () => {
    if (!activeRequestId) return;
    const { stopChatCompletion } = await import('../../services/ai');
    stopChatCompletion(activeRequestId);
  };

  const handleRegenerate = (message: Message, content: string) => {
    const messagesToSend = replaceUserMessageAndTrim(message.id, content);
    startAgentResponse(messagesToSend);
  };

  const resumeAgentTask = (taskId: string) => startAgentResponse([], taskId);

  return {
    startAgentResponse,
    stopAgentResponse,
    handleRegenerate,
    resumeAgentTask,
  };
}
