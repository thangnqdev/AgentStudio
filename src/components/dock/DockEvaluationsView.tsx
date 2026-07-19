import { useAgentEvaluations } from '../../application/hooks/useAgentEvaluations';

export function DockEvaluationsView() {
  const { reports, running, notice, refresh, run, exportReport } = useAgentEvaluations();
  return (
    <div className="flex-1 overflow-y-auto bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h3 className="text-[13px] font-semibold text-[#292929]">Đánh giá kết quả</h3><p className="mt-1 text-[10px] leading-4 text-[#888]">Chạy bộ kiểm tra cục bộ trước khi dùng kết quả.</p></div>
        <button type="button" onClick={() => void refresh()} className="dock-icon-button" title="Làm mới"><span className="material-symbols-outlined text-[16px]">refresh</span></button>
      </div>
      <button type="button" disabled={running} onClick={() => void run()} className="mt-4 w-full rounded-lg bg-[#252525] px-3 py-2 text-[11px] font-medium text-white disabled:opacity-50">{running ? 'Đang kiểm tra…' : 'Chạy kiểm tra'}</button>
      <div className="mt-4 space-y-2">
        {reports.map((report) => (
          <article key={report.runId} className="rounded-lg border border-black/[0.08] p-3">
            <div className="flex items-center justify-between"><span className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${report.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{report.passed ? 'Đạt' : 'Chưa đạt'}</span><strong className="text-[13px] text-[#333]">{(report.aggregateScore * 100).toFixed(0)}%</strong></div>
            <p className="mt-2 truncate font-mono text-[9px] text-[#888]">{new Date(report.createdAt).toLocaleString('vi-VN')}</p>
            <button type="button" onClick={() => void exportReport(report.runId)} className="mt-2 text-[10px] font-medium text-[#555] hover:text-black">Xuất báo cáo JSON</button>
          </article>
        ))}
        {!reports.length && <p className="rounded-lg border border-dashed border-black/[0.1] px-4 py-8 text-center text-[10px] text-[#999]">Chưa có lần đánh giá nào.</p>}
      </div>
      {notice && <p className="mt-3 text-[10px] text-[#8b3b20]">{notice}</p>}
    </div>
  );
}
