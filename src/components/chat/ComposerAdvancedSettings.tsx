import type { AIModel } from '../../domain/entities/settings';

export function ComposerAdvancedSettings(props: {
  models: AIModel[];
  activeModelId: string | null;
  fallbackModelId: string | null;
  onFallbackModelChange: (value: string) => void;
}) {
  return (
    <details className="group relative">
      <summary className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded text-[#888] hover:bg-black/[0.04] hover:text-[#333]" title="Tùy chọn nâng cao">
        <span className="material-symbols-outlined text-[16px]">tune</span>
      </summary>
      <div className="absolute bottom-8 right-0 z-40 w-[260px] rounded-xl border border-black/10 bg-white p-3 shadow-[0_12px_36px_rgba(0,0,0,0.16)]">
        <p className="text-[11px] font-medium text-[#333]">Tùy chọn nâng cao</p>
        <label className="mt-3 block text-[10px] text-[#777]">Model dự phòng</label>
        <select value={props.fallbackModelId || ''} onChange={(event) => props.onFallbackModelChange(event.target.value)} className="mt-1 w-full rounded-md border border-black/10 bg-[#fafafa] px-2 py-1.5 text-[11px] text-[#444] outline-none">
          <option value="">Không dùng</option>
          {props.models.filter((model) => model.id !== props.activeModelId).map((model) => <option key={model.id} value={model.id}>{model.id}</option>)}
        </select>
        <p className="mt-2 text-[9px] leading-4 text-[#999]">Chỉ dùng khi model chính tạm thời không phản hồi.</p>
      </div>
    </details>
  );
}
