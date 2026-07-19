import { useAppStore } from '../../store/useAppStore';
import type { Message } from '../../domain/entities/message';
import { parseAgentContent } from '../../application/services/parseAgentContent';
import { buildAgentMessageBlocks } from '../../application/services/agentMessagePresentation';
import { ThinkStep } from './ThinkStep';
import { CodeBlock } from './CodeBlock';
import { AgentMarkdown } from './AgentMarkdown';
import { ToolProgressGroup } from './ToolProgressGroup';

export function AgentMessage({ msg }: { msg: Message }) {
  const activeActions = useAppStore((s) => s.agentActions);

  if (!msg.content && msg.status === 'sending') return null;

  const parts = parseAgentContent(msg.content);
  const actionsToDisplay = msg.status === 'sending' ? activeActions : (msg.actions || []);
  const blocks = buildAgentMessageBlocks(parts, actionsToDisplay);

  return (
    <div className="group flex rounded-xl px-1 py-2 transition-colors duration-200 hover:bg-surface-container-low/30">
      <div className="min-w-0 flex-1">
        {blocks.map((block, index) => {
          if (block.type === 'think') return <ThinkStep key={`think-${index}`} text={block.value} />;
          if (block.type === 'tool-group') return <ToolProgressGroup key={`tools-${index}`} actions={block.actions} />;
          if (block.type === 'code') return <CodeBlock key={`code-${index}`} language={block.language} code={block.value} />;
          return <AgentMarkdown key={`text-${index}`} text={block.value} />;
        })}
        <span className="mt-2 block font-code-base text-[10px] text-on-surface-variant/45 opacity-0 transition-opacity group-hover:opacity-100">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
