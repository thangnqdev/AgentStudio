import { useAppStore } from '../../store/useAppStore';
import type { Message } from '../../domain/entities/message';
import { parseAgentContent } from '../../application/services/parseAgentContent';
import { ThinkStep } from './ThinkStep';
import { ToolStep } from './ToolStep';
import { CodeBlock } from './CodeBlock';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function TextBlock({ text }: { text: string }) {
  if (!text.trim()) return null;

  return (
    <div className="font-ui-body text-[15px] leading-[1.65] text-on-surface tracking-[0.01em]">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1 marker:text-on-surface-variant/50" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1 marker:text-on-surface-variant/50" {...props} />,
          li: ({node, ...props}) => <li className="" {...props} />,
          a: ({node, ...props}) => <a className="text-primary hover:underline font-medium transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
          strong: ({node, ...props}) => <strong className="font-semibold text-on-surface" {...props} />,
          code: ({node, className, children, ...props}) => {
            const isInline = !className;
            return isInline ? (
              <code className="bg-surface-container-high text-primary px-1.5 py-0.5 rounded-md text-[13px] font-code-base border border-outline-variant/50" {...props}>{children}</code>
            ) : (
              <code className={className} {...props}>{children}</code>
            );
          },
          table: ({node, ...props}) => <div className="overflow-x-auto mb-4"><table className="w-full text-left border-collapse" {...props} /></div>,
          th: ({node, ...props}) => <th className="border-b border-outline-variant py-2 px-3 bg-surface-container font-semibold text-on-surface text-[14px]" {...props} />,
          td: ({node, ...props}) => <td className="border-b border-outline-variant/50 py-2 px-3 text-on-surface-variant" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary/50 pl-4 py-1 italic text-on-surface-variant bg-primary/[0.05] rounded-r-lg mb-4" {...props} />
        }}
      >
        {text}
      </ReactMarkdown>
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
    <div className="group flex py-4 px-3 hover:bg-surface-container-low/30 rounded-2xl transition-colors duration-300">
      <div className="flex-1 min-w-0 pt-1">
        {parts.map((part, index) => {
          if (part.type === 'think') return <ThinkStep key={`think-${index}`} text={part.value} />;
          if (part.type === 'tool') {
            const action = actionsMap.get(part.actionId);
            return action ? <ToolStep key={`tool-${index}`} action={action} /> : null;
          }
          if (part.type === 'code') return <CodeBlock key={`code-${index}`} language={part.language} code={part.value} />;
          return <TextBlock key={`text-${index}`} text={part.value} />;
        })}
        <span className="text-[11px] text-on-surface-variant/50 mt-3 block font-code-base opacity-0 group-hover:opacity-100 transition-opacity">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
