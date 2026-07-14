import type { AgentEvaluation, AgentEvaluationReport } from '../domain/entities/agentEvaluation';
import { useAgentEvaluations } from '../application/hooks/useAgentEvaluations';

export function EvaluationView() {
  const { reports, running, notice, refresh, run, exportReport } = useAgentEvaluations();
  return <div className="flex-1 overflow-y-auto px-6 py-8"><div className="max-w-[1000px] mx-auto">
    <header className="flex justify-between gap-4 border-b border-outline-variant pb-5 mb-6"><div><p className="text-ui-label-caps uppercase text-secondary">Verifier before learner</p><h2 className="font-display-serif text-[30px] text-primary">Agent Evaluation</h2><p className="text-[13px] text-on-surface-variant">Deterministic runtime regression: session, tools, policy, file changes, trajectory and retrieval. Không gọi model/API thật.</p></div><div className="flex gap-2"><button onClick={() => void refresh()} className="settings-action">Làm mới</button><button disabled={running} onClick={() => void run()} className="px-3 py-1.5 rounded bg-primary text-on-primary text-[13px]">{running ? 'Đang chạy…' : 'Chạy runtime suite'}</button></div></header>
    {reports.length === 0 ? <p className="text-[13px] text-on-surface-variant">Chưa có evaluation report.</p> : <div className="space-y-4">{reports.map((report) => <ReportCard key={report.runId} report={report} onExport={() => void exportReport(report.runId)} />)}</div>}
    {notice && <p className="text-[13px] text-secondary mt-4">{notice}</p>}
  </div></div>;
}

function ReportCard({ report, onExport }: { report: AgentEvaluationReport; onExport: () => void }) {
  const byKind = report.evaluations.reduce<Record<string, AgentEvaluation[]>>((groups, evaluation) => {
    (groups[evaluation.kind] ??= []).push(evaluation);
    return groups;
  }, {});
  return <article className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5"><div className="flex justify-between gap-3"><div><div className="flex items-center gap-2"><span className={`${report.passed ? 'bg-[#2e7d32]' : 'bg-error'} text-white text-[10px] uppercase rounded px-2 py-0.5`}>{report.passed ? 'passed' : 'failed'}</span><strong className="text-[16px]">{(report.aggregateScore * 100).toFixed(1)}%</strong><span className="text-[11px] text-on-surface-variant">{report.suiteId}@{report.suiteVersion}</span></div><p className="font-code-base text-[10px] text-on-surface-variant mt-2">{report.runId} · {new Date(report.createdAt).toLocaleString()}</p></div><button onClick={onExport} className="settings-action">Export JSON</button></div><div className="grid grid-cols-6 gap-2 mt-4">{Object.entries(byKind).map(([kind, evaluations]) => { const score = evaluations!.reduce((sum, item) => sum + item.score, 0) / evaluations!.length; return <div key={kind} className="rounded-lg bg-surface-container p-2 text-center"><p className="text-[10px] uppercase truncate">{kind.replace('_', ' ')}</p><p className="font-semibold text-[14px] mt-1">{(score * 100).toFixed(0)}%</p><p className="text-[9px] text-on-surface-variant">v{evaluations![0].provenance.evaluatorVersion}</p></div>; })}</div></article>;
}
