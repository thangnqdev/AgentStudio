import { useAppStore } from '../../store/useAppStore';
import type { Message } from '../../domain/entities/message';
import { parseAgentContent } from '../../application/services/parseAgentContent';
import { ThinkStep } from './ThinkStep';
import { ToolStep } from './ToolStep';
import { CodeBlock } from './CodeBlock';

function TextBlock({ text }: { text: string }) {
  if (!text.trim()) return null;

  return (
    <div className="font-ui-body text-ui-body text-on-surface-variant leading-relaxed text-[15px] whitespace-pre-wrap">
      {text}
    </div>
  );
}

export function AgentMessage({ msg }: { msg: Message }) {
  const activeActions = useAppStore((s) => s.agentActions);

  if (!msg.content && msg.status === 'sending') return null;

  const parts = parseAgentContent(msg.content);
  const actionsToDisplay = msg.status === 'sending' ? activeActions : (msg.actions || []);
  const actionsMap = new Map(actionsToDisplay.map(a => [a.id, a]));

  return (
    <div className="grid grid-cols-[28px_1fr] gap-3 py-1">
      <div className="relative flex justify-center">
        <div className="absolute top-7 bottom-0 w-px bg-outline-variant" />
        <div className="relative z-10 mt-1 w-5 h-5 rounded-full bg-background border border-outline-variant flex items-center justify-center text-secondary">
          <span className="material-symbols-outlined text-[14px]">smart_toy</span>
        </div>
      </div>
      <div className="min-w-0 max-w-none pt-0.5">
        {parts.map((part, index) => {
          if (part.type === 'think') return <ThinkStep key={`think-${index}`} text={part.value} />;
          if (part.type === 'tool') {
            const action = actionsMap.get(part.actionId);
            return action ? <ToolStep key={`tool-${index}`} action={action} /> : null;
          }
          if (part.type === 'code') return <CodeBlock key={`code-${index}`} language={part.language} code={part.value} />;
          return <TextBlock key={`text-${index}`} text={part.value} />;
        })}
        <span className="text-[11px] text-on-surface-variant/50 mt-2 block">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
