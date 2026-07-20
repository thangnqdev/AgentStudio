import type { KnowledgeLibrary } from '../../application/hooks/useKnowledgeBase';

export function KnowledgeHero({ library }: { library: KnowledgeLibrary }) {
  return <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-primary-container px-7 py-8 text-on-primary-container shadow-[0_16px_40px_var(--theme-shadow)] sm:px-10">
    <div className="absolute -right-14 -top-20 h-64 w-64 rounded-full bg-secondary/40 blur-3xl" />
    <div className="relative max-w-2xl">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-on-primary-container/20 bg-on-primary-container/10 px-3 py-1 font-code-base text-[11px] tracking-[0.14em] text-secondary-fixed uppercase"><span className="h-1.5 w-1.5 rounded-full bg-secondary-fixed" />Hybrid RAG local-first</div>
      <h2 className="font-display-serif text-[35px] leading-[1.02] tracking-tight sm:text-[45px]">Tri thức có nguồn,<br />không chỉ là context.</h2>
      <p className="mt-4 max-w-xl text-[14px] leading-6 text-primary-fixed">Phân đoạn theo cấu trúc, BM25 + semantic embeddings, reciprocal-rank fusion và MMR. Mỗi câu trả lời có thể trích về đúng đoạn tài liệu.</p>
    </div>
    <div className="relative mt-8 grid max-w-xl grid-cols-3 gap-2 border-t border-on-primary-container/15 pt-5">
      <Metric label="Tài liệu" value={library.documents.length} /><Metric label="Đoạn tri thức" value={library.totalChunks} /><Metric label="Retrieval" value={library.semanticReady ? 'Hybrid' : 'BM25'} />
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><p className="font-code-base text-[10px] uppercase tracking-wider text-primary-fixed">{label}</p><p className="mt-1 font-display-serif text-[22px] text-on-primary">{value}</p></div>;
}
