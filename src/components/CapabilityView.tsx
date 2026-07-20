import type { CapabilitySnapshot } from '../domain/entities/capability';
import { useCapabilities } from '../application/hooks/useCapabilities';

export function CapabilityView() {
  const { capabilities, recommendations, loading, notice, refresh } = useCapabilities();
  const ranking = new Map(recommendations.map((item) => [item.capabilityId, item]));
  return <main className="flex-1 min-h-0 overflow-y-auto p-8 bg-surface">
    <div className="flex justify-between gap-4 mb-6"><div><p className="text-ui-label-caps uppercase text-secondary">Khả năng của agent</p><h2 className="font-display-serif text-[30px] text-primary">Công cụ & kết nối</h2><p className="text-[13px] text-on-surface-variant">Xem những công cụ, kỹ năng và nguồn dữ liệu agent có thể sử dụng. Thứ tự gợi ý không tự thay đổi quyền truy cập.</p></div><button onClick={() => void refresh()} className="settings-action">Làm mới</button></div>
    {loading && <p className="text-[13px] text-on-surface-variant">Đang tìm công cụ có sẵn…</p>}
    {!loading && <div className="grid grid-cols-2 gap-3">{capabilities.map((item) => <CapabilityCard key={item.id} item={item} rank={ranking.get(item.id)?.rank} />)}</div>}
    {notice && <p className="text-[13px] text-error mt-4">{notice}</p>}
  </main>;
}

function CapabilityCard({ item, rank }: { item: CapabilitySnapshot; rank?: number }) {
  const success = item.metrics.successRate === null ? 'chưa có mẫu' : `${(item.metrics.successRate * 100).toFixed(0)}% thành công`;
  return <article className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"><div className="flex justify-between gap-3"><div><div className="flex gap-2 items-center"><strong className="text-[14px]">{item.name}</strong>{rank && <span className="rounded bg-secondary text-on-secondary px-2 py-0.5 text-[9px]">gợi ý #{rank}</span>}</div><p className="text-[11px] text-on-surface-variant mt-1">{item.kind.replaceAll('_', ' ')}</p></div><span className={`${item.available ? 'text-success' : 'text-error'} text-[11px]`}>{item.available ? 'Sẵn sàng' : 'Chưa sẵn sàng'}</span></div><p className="text-[12px] mt-3">{item.description}</p><details className="mt-3 text-[10px] text-on-surface-variant"><summary className="cursor-pointer">Thông tin kỹ thuật</summary><div className="flex flex-wrap gap-2 mt-2"><span className="border rounded px-2 py-1">{item.sourceId}</span><span className="border rounded px-2 py-1">risk: {item.risk}</span><span className="border rounded px-2 py-1">{success}</span><span className="border rounded px-2 py-1">p95: {item.metrics.p95LatencyMs === null ? 'n/a' : `${item.metrics.p95LatencyMs}ms`}</span><span className="border rounded px-2 py-1">cost: {item.costEstimate.confidence}</span></div></details></article>;
}
