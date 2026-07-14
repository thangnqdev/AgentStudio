import { useOptimizer } from '../application/hooks/useOptimizer';
import type { OptimizationCandidate, RuntimeOptimizationConfig } from '../domain/entities/optimizer';

export function OptimizerView() {
  const optimizer = useOptimizer();
  const active = optimizer.state?.active;

  return (
    <main className="flex-1 min-h-0 overflow-y-auto p-8 bg-surface">
      <header className="flex justify-between gap-4 border-b border-outline-variant pb-5 mb-6">
        <div>
          <p className="text-ui-label-caps uppercase text-secondary">Evaluation gated</p>
          <h2 className="font-display-serif text-[30px] text-primary">Safe Optimizer</h2>
          <p className="text-[13px] text-on-surface-variant">
            Candidate chỉ được promote khi benchmark mang đúng configuration digest và vượt baseline.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            disabled={optimizer.busy || !optimizer.state?.history.length}
            onClick={() => void optimizer.rollback()}
            className="settings-action"
          >
            Rollback
          </button>
          <button disabled={optimizer.busy} onClick={() => void optimizer.refresh()} className="settings-action">
            Làm mới
          </button>
        </div>
      </header>

      {active && (
        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 mb-5">
          <div className="flex justify-between">
            <h3 className="font-semibold">Active revision {optimizer.state?.revision}</h3>
            <button
              disabled={optimizer.busy || active.retrievalTopK >= 20}
              onClick={() => void optimizer.create({ retrievalTopK: active.retrievalTopK + 1 })}
              className="settings-action"
            >
              Candidate top-K +1
            </button>
          </div>
          <Config config={active} />
        </section>
      )}

      <p className="text-[11px] text-on-surface-variant mb-3">
        Evaluate tự chạy golden suite một lần với active config và một lần với candidate config.
        Report cũ không có runtime evidence sẽ bị từ chối.
      </p>
      <div className="space-y-3">
        {optimizer.state?.candidates.map((candidate) => (
          <Candidate
            key={candidate.id}
            candidate={candidate}
            busy={optimizer.busy}
            onEvaluate={() => void optimizer.benchmark(candidate.id)}
            onPromote={() => void optimizer.promote(candidate.id)}
          />
        ))}
      </div>
      {optimizer.notice && <p className="text-[13px] text-error mt-4">{optimizer.notice}</p>}
    </main>
  );
}

function Config({ config }: { config: RuntimeOptimizationConfig }) {
  return (
    <div className="grid grid-cols-4 gap-2 mt-4">
      {Object.entries(config).map(([key, value]) => (
        <div key={key} className="rounded-lg bg-surface-container p-2">
          <p className="text-[9px] uppercase text-on-surface-variant">{key}</p>
          <p className="font-code-base text-[12px] mt-1">{String(value)}</p>
        </div>
      ))}
    </div>
  );
}

function Candidate({ candidate, busy, onEvaluate, onPromote }: {
  candidate: OptimizationCandidate;
  busy: boolean;
  onEvaluate: () => void;
  onPromote: () => void;
}) {
  const badge = candidate.status === 'evaluated'
    ? 'bg-[#2e7d32]'
    : candidate.status === 'rejected' ? 'bg-error' : 'bg-secondary';
  return (
    <article className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex justify-between gap-3">
        <div>
          <span className={`${badge} text-white text-[9px] uppercase rounded px-2 py-0.5`}>{candidate.status}</span>
          <span className="font-code-base text-[10px] ml-2">{candidate.id}</span>
          <p className="text-[11px] mt-2">Thay đổi: {candidate.changedKeys.join(', ')}</p>
          {candidate.evaluation && (
            <p className="text-[11px] text-on-surface-variant mt-1">
              {candidate.evaluation.baselineScore.toFixed(3)} → {candidate.evaluation.candidateScore.toFixed(3)} · {candidate.evaluation.configurationDigest}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button disabled={busy || candidate.status === 'promoted'} onClick={onEvaluate} className="settings-action">
            {busy ? 'Đang chạy…' : 'Evaluate'}
          </button>
          <button disabled={busy || candidate.status !== 'evaluated'} onClick={onPromote} className="settings-action">
            Promote
          </button>
        </div>
      </div>
    </article>
  );
}
