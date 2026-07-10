import { useState } from 'react';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';

export function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const handleApply = async () => {
    const targetPath = window.prompt('Áp dụng code vào file nào? Nhập đường dẫn tương đối trong workspace:');
    if (!targetPath) return;

    try {
      setIsApplying(true);
      if (!AgentBridge.isAvailable) throw new Error('Electron bridge is not available.');
      await AgentBridge.writeWorkspaceFile({ path: targetPath, content: code });
      window.alert(`Đã áp dụng vào ${targetPath}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Apply code thất bại.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-outline-variant bg-[#171717]">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-3 py-2">
        <span className="font-code-base text-[11px] text-white/60">{language || 'text'}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="h-7 px-2 rounded text-[11px] text-white/70 hover:bg-white/10"
            title="Copy code"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="h-7 px-2 rounded text-[11px] text-white/70 hover:bg-white/10 disabled:opacity-50"
            title="Apply code vào file"
          >
            Apply
          </button>
        </div>
      </div>
      <pre className="max-h-[420px] overflow-auto p-4 text-[12px] leading-5 text-[#f4f4f5] font-code-base">
        <code>{code}</code>
      </pre>
    </div>
  );
}
