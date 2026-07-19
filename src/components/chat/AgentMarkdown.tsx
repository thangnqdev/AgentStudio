import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function AgentMarkdown({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="font-ui-body text-[14px] leading-[1.55] tracking-[0.005em] text-on-surface">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node: _node, ...props }) => <p className="mb-2.5 last:mb-0" {...props} />,
          h1: ({ node: _node, ...props }) => <h1 className="mb-2 mt-4 text-[19px] font-semibold first:mt-0" {...props} />,
          h2: ({ node: _node, ...props }) => <h2 className="mb-1.5 mt-3.5 text-[17px] font-semibold first:mt-0" {...props} />,
          h3: ({ node: _node, ...props }) => <h3 className="mb-1 mt-3 text-[15px] font-semibold first:mt-0" {...props} />,
          ul: ({ node: _node, ...props }) => <ul className="mb-2.5 list-disc space-y-0.5 pl-5 marker:text-on-surface-variant/50" {...props} />,
          ol: ({ node: _node, ...props }) => <ol className="mb-2.5 list-decimal space-y-0.5 pl-5 marker:text-on-surface-variant/50" {...props} />,
          a: ({ node: _node, ...props }) => <a className="font-medium text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
          strong: ({ node: _node, ...props }) => <strong className="font-semibold text-on-surface" {...props} />,
          code: ({ node: _node, className, children, ...props }) => className
            ? <code className={className} {...props}>{children}</code>
            : <code className="rounded border border-outline-variant/50 bg-surface-container-high px-1 py-0.5 font-code-base text-[12px] text-primary" {...props}>{children}</code>,
          table: ({ node: _node, ...props }) => <div className="mb-3 overflow-x-auto"><table className="w-full border-collapse text-left text-[13px]" {...props} /></div>,
          th: ({ node: _node, ...props }) => <th className="border-b border-outline-variant bg-surface-container px-2.5 py-1.5 font-semibold" {...props} />,
          td: ({ node: _node, ...props }) => <td className="border-b border-outline-variant/50 px-2.5 py-1.5 text-on-surface-variant" {...props} />,
          blockquote: ({ node: _node, ...props }) => <blockquote className="mb-2.5 rounded-r border-l-2 border-primary/40 bg-primary/[0.04] py-1 pl-3 text-on-surface-variant" {...props} />,
          hr: ({ node: _node, ...props }) => <hr className="my-3 border-outline-variant/60" {...props} />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
