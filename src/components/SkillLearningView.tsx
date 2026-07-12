import { useState } from 'react';
import type { SkillCandidate } from '../domain/entities/skillLearning';
import { useSkillLearning } from '../application/hooks/useSkillLearning';

export function SkillLearningView() {
  const learning = useSkillLearning(); const [traceId, setTraceId] = useState('');
  return (
    <main className="flex-1 min-h-0 overflow-y-auto p-8 bg-surface">
      <header className="flex justify-between gap-4 border-b border-outline-variant pb-5 mb-6">
        <div>
          <p className="text-ui-label-caps uppercase text-secondary">Tự phát triển qua phê duyệt</p>
          <h2 className="font-display-serif text-[30px] text-primary">Học Kỹ Năng</h2>
          <p className="text-[13px] text-on-surface-variant">Nhật ký thành công → Đề xuất → Tạo test → Phê duyệt → Kỹ năng mới.</p>
        </div>
        <button disabled={learning.busy} onClick={() => void learning.refresh()} className="settings-action">Làm mới</button>
      </header>
      <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5 mb-5">
        <h3 className="font-semibold mb-2">Học từ nhật ký thành công</h3>
        <p className="text-[11px] text-on-surface-variant mb-3">Chỉ dùng tên/thứ tự công cụ và metadata; không bao gồm prompt, tham số, kết quả và nội dung file.</p>
        <div className="flex gap-2">
          <select value={traceId} onChange={(event) => setTraceId(event.target.value)} className="settings-input flex-1">
            <option value="">Chọn nhật ký thành công…</option>
            {learning.traces.map((trace) => (
              <option key={trace.traceId} value={trace.traceId}>{trace.traceId} · {trace.spanCount} bước</option>
            ))}
          </select>
          <button disabled={learning.busy || !traceId} onClick={() => void learning.create(traceId)} className="settings-action">Tạo đề xuất</button>
        </div>
      </section>
      <div className="space-y-4">
        {learning.candidates.map((candidate) => (
          <CandidateCard key={candidate.id} candidate={candidate} busy={learning.busy} evaluate={() => void learning.evaluate(candidate.id)} decide={(approved) => void learning.decide(candidate.id, approved)} promote={() => void learning.promote(candidate.id)} />
        ))}
      </div>
      {learning.notice && <p className="text-[13px] text-error mt-4">{learning.notice}</p>}
    </main>
  );
}

function CandidateCard({ candidate, busy, evaluate, decide, promote }: { candidate: SkillCandidate; busy: boolean; evaluate: () => void; decide: (approved: boolean) => void; promote: () => void }) {
  const statusText = candidate.status === 'promoted' ? 'Đã phát hành' : candidate.status === 'approved' ? 'Đã duyệt' : candidate.status === 'rejected' ? 'Từ chối' : 'Chờ xử lý';
  return (
    <article className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
      <div className="flex justify-between gap-4">
        <div>
          <span className={`${candidate.status === 'promoted' || candidate.status === 'approved' ? 'bg-[#2e7d32]' : candidate.status === 'rejected' ? 'bg-error' : 'bg-secondary'} text-white text-[9px] uppercase rounded px-2 py-0.5`}>
            {statusText}
          </span>
          <strong className="ml-2 text-[14px]">{candidate.name}@{candidate.skillVersion}</strong>
          <p className="text-[11px] text-on-surface-variant mt-2">Nhật ký: {candidate.sourceTraceId} · Công cụ: {candidate.toolSequence.join(' → ')}</p>
        </div>
        <div className="flex gap-2">
          <button disabled={busy || candidate.status === 'approved' || candidate.status === 'promoted'} onClick={evaluate} className="settings-action">Chạy test</button>
          <button disabled={busy || !candidate.evaluation?.passed || candidate.status === 'promoted'} onClick={() => decide(false)} className="settings-action text-error">Từ chối</button>
          <button disabled={busy || !candidate.evaluation?.passed || candidate.status === 'approved' || candidate.status === 'promoted'} onClick={() => decide(true)} className="settings-action">Phê duyệt</button>
          <button disabled={busy || candidate.status !== 'approved'} onClick={promote} className="settings-action">Ký & Phát hành</button>
        </div>
      </div>
      <pre className="font-code-base text-[10px] whitespace-pre-wrap rounded-lg bg-surface-container p-3 mt-4 max-h-44 overflow-auto">{candidate.instructions}</pre>
      {candidate.evaluation && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {candidate.evaluation.results.map((result) => (
            <div key={result.testId} className={`rounded p-2 text-[10px] ${result.passed ? 'bg-[#e8f5e9] text-[#1b5e20]' : 'bg-error-container text-error'}`}>
              {result.testId}: {result.passed ? 'đạt' : 'lỗi'}
            </div>
          ))}
        </div>
      )}
      {candidate.promotion && <p className="font-code-base text-[10px] text-on-surface-variant mt-3">{candidate.promotion.algorithm} · {candidate.promotion.signature}</p>}
    </article>
  );
}
