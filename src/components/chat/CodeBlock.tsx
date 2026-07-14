import { useState } from 'react';
import { useFileWriter } from '../../application/hooks/useFileWriter';

export function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const { isWriting, writeWorkspaceFile } = useFileWriter();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const handleApply = async () => {
    const targetPath = window.prompt('Áp dụng code vào file nào? Nhập đường dẫn tương đối trong workspace:');
    if (!targetPath) return;

    try {
      await writeWorkspaceFile(targetPath, code);
      window.alert(`Đã áp dụng vào ${targetPath}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Apply code thất bại.');
    }
  };


  return (
    <div className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a] shadow-sm">
      <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.03] px-4 py-2.5">
        <span className="font-code-base text-[11px] text-white/50 tracking-wider uppercase">{language || 'text'}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="h-7 px-2.5 rounded-md text-[11px] font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            title="Copy code"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleApply}
            disabled={isWriting}
            className="h-7 px-2.5 rounded-md text-[11px] font-medium text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-colors"
            title="Apply code vào file"
          >
            Apply
          </button>
        </div>
      </div>
      <pre className="max-h-[500px] overflow-auto p-4 text-[13px] leading-[1.6] text-[#e4e4e7] font-code-base bg-[#0a0a0a]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
