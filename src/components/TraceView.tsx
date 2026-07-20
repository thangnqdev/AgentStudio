import type { AgentSpan, AgentTraceSummary, TraceStatus } from '../domain/entities/agentTrace';
import { useAgentTraces } from '../application/hooks/useAgentTraces';

export function TraceView() {
  const { traces, details, loading, notice, refresh, select, exportTrace } = useAgentTraces();
  return (
    <div className="flex-1 overflow-hidden flex flex-col px-6 py-8">
      <header className="max-w-[1100px] w-full mx-auto flex items-start justify-between mb-6">
        <div><p className="text-ui-label-caps uppercase text-secondary">Chẩn đoán cục bộ</p><h2 className="font-display-serif text-[30px] text-primary">Lịch sử hoạt động</h2><p className="text-[13px] text-on-surface-variant">Theo dõi các bước agent đã thực hiện. Nội dung nhạy cảm và thông tin đăng nhập không được ghi lại.</p></div>
        <button onClick={() => void refresh()} className="settings-action">Làm mới</button>
      </header>
      <div className="max-w-[1100px] w-full mx-auto min-h-0 flex-1 grid grid-cols-[340px_1fr] gap-4">
        <section className="overflow-y-auto border border-outline-variant rounded-xl bg-surface-container-lowest p-3">
          {loading && <p className="p-3 text-[13px] text-on-surface-variant">Đang tải…</p>}
          {!loading && traces.length === 0 && <p className="p-3 text-[13px] text-on-surface-variant">Chưa có agent trace.</p>}
          {traces.map((trace) => <TraceRow key={trace.traceId} trace={trace} active={details?.trace.traceId === trace.traceId} onClick={() => void select(trace.traceId)} />)}
        </section>
        <section className="overflow-y-auto border border-outline-variant rounded-xl bg-surface-container-lowest p-5">
          {!details ? <p className="text-[13px] text-on-surface-variant">Chọn một trace để xem trajectory.</p> : <>
            <div className="flex justify-between gap-3 border-b border-outline-variant pb-4 mb-4"><div><div className="flex gap-2 items-center"><Status value={details.trace.status} /><span className="font-code-base text-[12px]">{details.trace.traceId}</span></div><p className="text-[12px] mt-2 text-on-surface-variant">Task {details.trace.taskId} · {details.spans.length} spans</p></div><button onClick={() => void exportTrace(details.trace.traceId)} className="settings-action">Export JSONL</button></div>
            <div className="space-y-2">{details.spans.map((span) => <SpanRow key={span.spanId} span={span} />)}</div>
          </>}
        </section>
      </div>
      {notice && <p className="max-w-[1100px] w-full mx-auto text-[12px] mt-3 text-secondary">{notice}</p>}
    </div>
  );
}

function TraceRow({ trace, active, onClick }: { trace: AgentTraceSummary; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`w-full text-left rounded-lg p-3 mb-2 border ${active ? 'border-secondary bg-secondary/5' : 'border-outline-variant hover:bg-surface-container'}`}><div className="flex justify-between"><Status value={trace.status} /><span className="text-[11px] text-on-surface-variant">{trace.spanCount} spans</span></div><p className="font-code-base text-[11px] truncate mt-2">{trace.traceId}</p><p className="text-[11px] text-on-surface-variant mt-1">{new Date(trace.updatedAt).toLocaleString()}</p></button>;
}

function SpanRow({ span }: { span: AgentSpan }) {
  const detail = span.kind === 'model_call'
    ? [span.model, span.usage ? formatModelUsage(span.usage) : 'usage unknown'].filter(Boolean).join(' · ')
    : span.kind === 'tool_call' || span.kind === 'approval' ? span.toolName : span.kind === 'retrieval' ? `${span.mode} · ${span.resultCount} results` : span.kind === 'checkpoint' ? `${span.checkpointStatus} · ${span.completedSteps} steps` : span.evaluatorId;
  return <div className="grid grid-cols-[130px_1fr_auto] items-center gap-3 border border-outline-variant rounded-lg px-3 py-2"><div><span className="text-[11px] uppercase font-semibold">{span.kind.replace('_', ' ')}</span><p className="text-[10px] text-on-surface-variant">step {span.step ?? '—'}</p></div><div className="min-w-0"><p className="text-[12px] truncate">{detail || '—'}</p><p className="font-code-base text-[10px] text-on-surface-variant truncate">{span.spanId}</p></div><div className="text-right"><Status value={span.status} /><p className="text-[10px] text-on-surface-variant mt-1">{span.durationMs} ms</p></div></div>;
}

function formatModelUsage(usage: NonNullable<AgentSpan['usage']>) {
  const cache = [
    usage.cachedInputTokens ? `${usage.cachedInputTokens} cache hit` : '',
    usage.cacheCreationInputTokens ? `${usage.cacheCreationInputTokens} cache write` : '',
  ].filter(Boolean).join(' · ');
  return `${usage.inputTokens} in · ${usage.outputTokens} out${cache ? ` · ${cache}` : ''}`;
}

function Status({ value }: { value: TraceStatus }) {
  const color = value === 'succeeded' ? 'bg-success text-on-success' : value === 'failed' || value === 'denied' ? 'bg-error text-on-error' : value === 'paused' ? 'bg-secondary text-on-secondary' : 'bg-primary text-on-primary';
  return <span className={`${color} rounded px-2 py-0.5 text-[10px] uppercase`}>{value}</span>;
}
