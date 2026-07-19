import type { ChatMessage, Message } from '../../domain/entities/agent.js';
import { formatAgentNotificationContext } from './agentNotificationContext.js';

const COMPLETION_INSTRUCTION = [
  'All background agents for the current user request have now settled.',
  'Continue the original task now: reconcile their findings, resolve conflicts, perform any required integration and verification, then give the user one final evidence-based answer.',
  'Do not ask the user what to do while waiting and do not merely repeat the worker reports.',
].join(' ');

export function buildAgentCollaborationContinuation(results: readonly Message[]): ChatMessage[] {
  if (results.length === 0) return [];
  return [
    { role: 'system', content: formatAgentNotificationContext(results) },
    { role: 'user', content: COMPLETION_INSTRUCTION },
  ];
}
