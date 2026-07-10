import type { KnowledgeDocument } from '../../domain/entities/knowledge';

export function KnowledgeLibraryPanel({ documents, isLoading, onRefresh, onRemove }: { documents: KnowledgeDocument[]; isLoading: boolean; onRefresh: () => void; onRemove: (documentId: string) => void }) {
  return <section className="mt-7 rounded-2xl border border-outline-variant bg-surface-container-low p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="font-ui-label-caps text-ui-label-caps uppercase tracking-wider text-secondary">Thư viện</p><h3 className="mt-1 font-display-serif text-[25px] text-primary">Nguồn đã lập chỉ mục</h3></div><button onClick={onRefresh} className="rounded-lg p-2 text-on-surface-variant transition hover:bg-surface-container-high" title="Làm mới"><span className={`material-symbols-outlined text-[19px] ${isLoading ? 'animate-spin' : ''}`}>refresh</span></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{documents.map((document) => <DocumentCard key={document.id} document={document} onRemove={onRemove} />)}{!isLoading && documents.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-outline-variant bg-surface px-5 py-10 text-center"><span className="material-symbols-outlined text-[28px] text-on-surface-variant">auto_stories</span><p className="mt-2 font-ui-label-bold text-[13px] text-primary">Thư viện đang trống</p><p className="mt-1 text-[12px] text-on-surface-variant">Thêm tài liệu để AgentStudio tự truy hồi và trích dẫn trong chat.</p></div>}</div></section>;
}

function DocumentCard({ document, onRemove }: { document: KnowledgeDocument; onRemove: (documentId: string) => void }) {
  return <article className="rounded-xl border border-outline-variant bg-surface p-4"><div className="flex items-start justify-between gap-3"><span className="material-symbols-outlined text-secondary">description</span><button onClick={() => onRemove(document.id)} className="rounded p-1 text-on-surface-variant transition hover:bg-error/10 hover:text-error" title={`Xóa ${document.name}`}><span className="material-symbols-outlined text-[18px]">delete</span></button></div><h4 className="mt-4 truncate font-ui-label-bold text-[14px] text-primary" title={document.sourcePath}>{document.name}</h4><div className="mt-2 flex items-center justify-between text-[11px] text-on-surface-variant"><span>{document.chunkCount} chunks</span><span>{formatSize(document.size)}</span></div><div className="mt-3 inline-flex rounded-full bg-surface-container px-2 py-1 font-code-base text-[10px] text-on-surface-variant">{document.indexingMode === 'hybrid' ? 'embedding + BM25' : 'BM25 index'}</div></article>;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
