import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentQuestion, PendingAgentInteraction } from '../../domain/entities/agentInteraction';
import { useAgentInteraction } from '../../application/hooks/useAgentInteraction';
import { buildAgentQuestionResponse } from '../../application/services/agentInteractionAnswers';

const EMPTY_QUESTIONS: AgentQuestion[] = [];

export function AgentInteractionPanel() {
  const { interaction, respond } = useAgentInteraction();
  if (!interaction) return null;
  return (
    <section className="rounded-2xl border border-secondary/40 bg-surface-container-lowest p-5 shadow-lg" role="dialog" aria-label={interaction.title}>
      <header className="mb-4 flex items-start gap-3">
        <span className="material-symbols-outlined mt-0.5 text-[20px] text-secondary">contact_support</span>
        <div>
          <p className="font-ui-label-caps text-[10px] uppercase tracking-wider text-secondary">Cần phản hồi của bạn</p>
          <h3 className="font-display-serif text-[22px] text-primary">{interaction.title}</h3>
        </div>
      </header>
      {interaction.kind === 'questions' ? (
        <QuestionInteraction key={interaction.id} interaction={interaction} onRespond={respond} />
      ) : (
        <PlanInteraction interaction={interaction} onRespond={respond} />
      )}
    </section>
  );
}

function PlanInteraction({ interaction, onRespond }: {
  interaction: PendingAgentInteraction;
  onRespond: ReturnType<typeof useAgentInteraction>['respond'];
}) {
  const exiting = interaction.kind === 'plan_exit';
  return (
    <div className="space-y-4">
      {exiting ? (
        <>
          <p className="text-[13px] text-on-surface-variant">Agent đã hoàn tất kế hoạch. Hãy duyệt trước khi cho phép thay đổi code.</p>
          <div className="max-h-[360px] overflow-auto rounded-xl border border-outline-variant bg-surface-container-low p-4 font-ui-body text-[13px] leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{interaction.plan || '*Không có nội dung kế hoạch.*'}</ReactMarkdown>
          </div>
        </>
      ) : (
        <div className="space-y-2 text-[13px] text-on-surface-variant">
          <p>Agent muốn khám phá codebase và thiết kế phương án trước khi sửa code.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Đọc và tìm kiếm code hiện tại.</li>
            <li>So sánh các phương án và trade-off.</li>
            <li>Không sửa file hoặc chạy lệnh thay đổi trạng thái.</li>
            <li>Trình kế hoạch để bạn duyệt trước khi triển khai.</li>
          </ul>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant pt-4">
        <button type="button" onClick={() => onRespond({ accepted: false })} className="settings-action">
          {exiting ? 'Yêu cầu chỉnh sửa' : 'Không, triển khai ngay'}
        </button>
        <button type="button" onClick={() => onRespond({ accepted: true })} className="rounded-lg bg-secondary px-4 py-2 text-[12px] font-ui-label-bold text-on-secondary hover:bg-secondary-hover">
          {exiting ? 'Phê duyệt & bắt đầu code' : 'Đồng ý vào Plan Mode'}
        </button>
      </div>
    </div>
  );
}

function QuestionInteraction({ interaction, onRespond }: {
  interaction: PendingAgentInteraction;
  onRespond: ReturnType<typeof useAgentInteraction>['respond'];
}) {
  const questions = interaction.questions ?? EMPTY_QUESTIONS;
  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [otherValues, setOtherValues] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const canSubmit = useMemo(() => questions.every((_, index) => (
    (selections[index]?.length ?? 0) > 0 || Boolean(otherValues[index]?.trim())
  )), [otherValues, questions, selections]);

  const toggle = (question: AgentQuestion, questionIndex: number, label: string) => {
    setSelections((current) => {
      if (!question.multiSelect) return { ...current, [questionIndex]: [label] };
      const selected = current[questionIndex] ?? [];
      return { ...current, [questionIndex]: selected.includes(label) ? selected.filter((item) => item !== label) : [...selected, label] };
    });
    if (!question.multiSelect) setOtherValues((current) => ({ ...current, [questionIndex]: '' }));
  };

  const submit = () => {
    try {
      const response = buildAgentQuestionResponse(questions, { selections, otherValues, notes });
      onRespond({ accepted: true, ...response });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Câu trả lời chưa hợp lệ.');
    }
  };

  return (
    <div className="space-y-5">
      {questions.map((question, questionIndex) => {
        const selected = selections[questionIndex] ?? [];
        const preview = question.options.find((option) => selected.includes(option.label))?.preview;
        return (
          <fieldset key={question.question} className="space-y-3 border-b border-outline-variant pb-5 last:border-0">
            <legend className="w-full">
              <span className="mb-1 inline-flex rounded bg-surface-container-high px-2 py-0.5 font-code-base text-[10px] uppercase text-secondary">{question.header}</span>
              <span className="block font-ui-label-bold text-[14px] text-primary">{question.question}</span>
              {question.multiSelect && <span className="text-[11px] text-on-surface-variant">Có thể chọn nhiều phương án.</span>}
            </legend>
            <div className={preview ? 'grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : ''}>
              <div className="space-y-2">
                {question.options.map((option) => (
                  <label key={option.label} className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${selected.includes(option.label) ? 'border-secondary bg-secondary/5' : 'border-outline-variant hover:bg-surface-container-low'}`}>
                    <input type={question.multiSelect ? 'checkbox' : 'radio'} name={`question-${questionIndex}`} checked={selected.includes(option.label)} onChange={() => toggle(question, questionIndex, option.label)} className="mt-1 accent-secondary" />
                    <span><span className="block text-[13px] font-medium text-primary">{option.label}</span><span className="block text-[11px] text-on-surface-variant">{option.description}</span></span>
                  </label>
                ))}
                <label className="block rounded-lg border border-outline-variant p-3">
                  <span className="mb-1 block text-[12px] font-medium text-primary">Khác</span>
                  <input value={otherValues[questionIndex] ?? ''} maxLength={2_000} onChange={(event) => {
                    const value = event.target.value;
                    setOtherValues((current) => ({ ...current, [questionIndex]: value }));
                    if (value && !question.multiSelect) setSelections((current) => ({ ...current, [questionIndex]: [] }));
                  }} className="w-full rounded border border-outline-variant bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-secondary" placeholder="Nhập câu trả lời khác…" />
                </label>
              </div>
              {preview && <div className="rounded-lg border border-outline-variant bg-surface-container-low p-3 text-[12px]"><ReactMarkdown remarkPlugins={[remarkGfm]}>{preview}</ReactMarkdown></div>}
            </div>
            <textarea value={notes[questionIndex] ?? ''} maxLength={2_000} onChange={(event) => setNotes((current) => ({ ...current, [questionIndex]: event.target.value }))} className="min-h-16 w-full resize-y rounded-lg border border-outline-variant bg-surface px-3 py-2 text-[12px] outline-none focus:border-secondary" placeholder="Ghi chú thêm (tuỳ chọn)…" />
          </fieldset>
        );
      })}
      {error && <p className="text-[12px] text-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => onRespond({ accepted: false })} className="settings-action">Bỏ qua</button>
        <button type="button" disabled={!canSubmit} onClick={submit} className="rounded-lg bg-secondary px-4 py-2 text-[12px] font-ui-label-bold text-on-secondary disabled:cursor-not-allowed disabled:opacity-40">Gửi câu trả lời</button>
      </div>
    </div>
  );
}
