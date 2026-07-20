import { useState } from 'react';
import { useWorkspaceFiles } from '../../application/hooks/useWorkspaceFiles';

export function FilesWorkspaceView() {
  const [query, setQuery] = useState('');
  const { directory, entries, selectedFile, loading, error, loadDirectory, openEntry, goUp } = useWorkspaceFiles();
  const filteredEntries = entries.filter((entry) => entry.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-1 min-h-0 bg-surface">
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-outline-variant/60 bg-surface-container-low">
        <div className="border-b border-outline-variant/60 p-3">
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={directory === '.'} onClick={goUp} className="flex h-7 w-7 items-center justify-center rounded text-on-surface-variant hover:bg-interactive-hover disabled:opacity-30" title="Lên một thư mục">
              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
            </button>
            <button type="button" onClick={() => void loadDirectory(directory)} className="flex h-7 w-7 items-center justify-center rounded text-on-surface-variant hover:bg-interactive-hover" title="Làm mới">
              <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
            <span className="min-w-0 flex-1 truncate pl-1 font-mono text-[10px] text-on-surface-variant">{directory}</span>
          </div>
          <label className="mt-2 flex h-8 items-center gap-2 rounded-lg border border-outline-variant/60 bg-surface px-2.5">
            <span className="material-symbols-outlined text-[15px] text-on-surface-variant">search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-on-surface-variant" placeholder="Lọc tệp…" />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {filteredEntries.map((entry) => (
            <button key={entry.path} type="button" onClick={() => void openEntry(entry)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-on-surface hover:bg-interactive-hover">
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{entry.kind === 'directory' ? 'chevron_right' : 'draft'}</span>
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              {entry.kind === 'file' && <span className="text-[9px] text-on-surface-variant">{formatSize(entry.size)}</span>}
            </button>
          ))}
          {!loading && filteredEntries.length === 0 && <p className="px-3 py-5 text-center text-[11px] text-on-surface-variant">Không có tệp phù hợp.</p>}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center border-b border-outline-variant/60 px-4 font-mono text-[11px] text-on-surface-variant">
          {selectedFile?.path ?? 'Chọn một tệp để xem trước'}
        </div>
        {error ? (
          <div className="m-5 rounded-lg border border-error/20 bg-error/5 p-4 text-[12px] text-error">{error}</div>
        ) : selectedFile ? (
          <pre className="flex-1 overflow-auto p-5 font-mono text-[12px] leading-5 text-on-surface"><code>{selectedFile.content}</code></pre>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined mb-3 text-[30px]">description</span>
            <p className="text-[12px]">Chọn tệp ở cột bên trái</p>
          </div>
        )}
      </section>
    </div>
  );
}

function formatSize(size?: number): string {
  if (size === undefined) return '';
  if (size < 1_000) return `${size} B`;
  return `${(size / 1_000).toFixed(size < 10_000 ? 1 : 0)} KB`;
}
