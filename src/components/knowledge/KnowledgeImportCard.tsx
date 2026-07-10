type KnowledgeImportCardProps = {
  isImporting: boolean;
  isSyncing: boolean;
  isWatching: boolean;
  notice: string;
  onImport: () => void;
  onToggleWorkspaceSync: () => void;
};

export function KnowledgeImportCard({ isImporting, isSyncing, isWatching, notice, onImport, onToggleWorkspaceSync }: KnowledgeImportCardProps) {
  return <section className="rounded-2xl border border-dashed border-outline bg-surface-container-low p-6"><div className="flex h-full flex-col"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-on-secondary shadow-sm"><span className="material-symbols-outlined">upload_file</span></div><h3 className="mt-5 font-display-serif text-[25px] text-primary">Nạp nguồn</h3><p className="mt-2 text-[13px] leading-5 text-on-surface-variant">Chọn Markdown, TXT, JSON, CSV, HTML, YAML, SQL và mã nguồn văn bản.</p><button onClick={onImport} disabled={isImporting || isSyncing} className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-ui-label-bold text-[13px] text-on-primary transition hover:bg-primary/90 disabled:opacity-60"><span className={`material-symbols-outlined text-[18px] ${isImporting ? 'animate-spin' : ''}`}>{isImporting ? 'sync' : 'add'}</span>{isImporting ? 'Đang lập chỉ mục' : 'Thêm tài liệu'}</button><button onClick={onToggleWorkspaceSync} disabled={isImporting || isSyncing} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-3 font-ui-label-bold text-[13px] text-primary transition hover:bg-surface-container disabled:opacity-60"><span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>{isWatching ? 'sync_disabled' : 'sync'}</span>{isWatching ? 'Dừng đồng bộ workspace' : isSyncing ? 'Đang đồng bộ' : 'Đồng bộ workspace'}</button><p className="mt-3 text-center font-code-base text-[10px] text-on-surface-variant">tối đa 5 MB / tệp</p>{notice && <p className="mt-4 rounded-lg bg-surface px-3 py-2 text-[12px] leading-5 text-on-surface-variant">{notice}</p>}</div></section>;
}
