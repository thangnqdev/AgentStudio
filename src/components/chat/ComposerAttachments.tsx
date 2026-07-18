import type { PendingAttachment } from '../../application/hooks/useAttachments';

interface ComposerAttachmentsProps {
  files: PendingAttachment[];
  onRemove: (id: string) => void;
}

export function ComposerAttachments({ files, onRemove }: ComposerAttachmentsProps) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-2 px-2 pt-1">
      {files.map((file) => (
        <div key={file.id} className="inline-flex items-center gap-1.5 rounded border border-outline-variant/50 bg-surface-container px-2 py-0.5 font-code-base text-[11px] text-on-surface-variant">
          <span className={`material-symbols-outlined text-[12px] ${file.error ? 'text-error' : ''}`}>
            {attachmentIcon(file)}
          </span>
          <span className={file.error ? 'opacity-50' : ''} title={file.error || file.filePath}>
            {file.name}{file.error && ' (Lỗi)'}
          </span>
          <button type="button" onClick={() => onRemove(file.id)} className="ml-1 flex items-center justify-center transition-colors hover:text-error" title="Xóa tệp">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function attachmentIcon(file: PendingAttachment): string {
  if (file.error) return 'error';
  if (file.type === 'image') return 'image';
  if (file.type === 'audio') return 'audio_file';
  if (file.type === 'video') return 'video_file';
  return 'description';
}
