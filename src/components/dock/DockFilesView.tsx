import { useState } from 'react';
import { useWorkspaceFiles } from '../../application/hooks/useWorkspaceFiles';

export function DockFilesView() {
  const [query, setQuery] = useState('');
  const { directory, entries, selectedFile, loading, error, loadDirectory, openEntry, goUp } = useWorkspaceFiles();
  const filtered = entries.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="shrink-0 border-b border-black/[0.07] p-3">
        <div className="flex items-center gap-1">
          <button type="button" disabled={directory === '.'} onClick={goUp} className="dock-icon-button disabled:opacity-30" title="Lên một thư mục"><span className="material-symbols-outlined text-[16px]">arrow_upward</span></button>
          <button type="button" onClick={() => void loadDirectory(directory)} className="dock-icon-button" title="Làm mới"><span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span></button>
          <span className="min-w-0 flex-1 truncate px-1 font-mono text-[9px] text-[#777]">{directory}</span>
        </div>
        <label className="mt-2 flex h-8 items-center gap-2 rounded-lg border border-black/[0.08] bg-[#fafafa] px-2.5"><span className="material-symbols-outlined text-[15px] text-[#999]">search</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] outline-none" placeholder="Tìm trong thư mục…" /></label>
      </div>
      <div className={`${selectedFile ? 'max-h-[44%]' : 'flex-1'} min-h-0 overflow-y-auto border-b border-black/[0.07] p-1.5`}>
        {filtered.map((entry) => <button key={entry.path} type="button" onClick={() => void openEntry(entry)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-[#444] hover:bg-black/[0.05]"><span className="material-symbols-outlined text-[15px] text-[#777]">{entry.kind === 'directory' ? 'folder' : 'draft'}</span><span className="min-w-0 flex-1 truncate">{entry.name}</span></button>)}
        {!loading && !filtered.length && <p className="px-3 py-8 text-center text-[10px] text-[#999]">Không có tệp phù hợp.</p>}
      </div>
      {error && <p className="m-3 rounded-lg bg-red-50 p-3 text-[10px] text-red-700">{error}</p>}
      {selectedFile && <section className="flex min-h-0 flex-1 flex-col"><p className="shrink-0 truncate border-b border-black/[0.07] px-3 py-2 font-mono text-[9px] text-[#777]">{selectedFile.path}</p><pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[10px] leading-4 text-[#333]"><code>{selectedFile.content}</code></pre></section>}
    </div>
  );
}
