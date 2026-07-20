import type { Message } from '../../domain/entities/message';

export function UserMessage({ msg, onRegenerate }: { msg: Message; onRegenerate: (message: Message, content: string) => void }) {
  const handleEdit = () => {
    const nextContent = window.prompt('Sửa tin nhắn và regenerate:', msg.content);
    if (nextContent === null) return;
    if (!nextContent.trim()) return;
    onRegenerate(msg, nextContent.trim());
  };

  return (
    <div className="group flex justify-end">
      <div className="relative max-w-[80%] rounded-2xl bg-user-message px-3.5 py-2.5 text-on-user-message shadow-sm">
        <button
          onClick={handleEdit}
          className="absolute -left-9 top-2 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant opacity-0 group-hover:opacity-100 hover:bg-surface-container-high transition"
          title="Sửa và regenerate"
        >
          <span className="material-symbols-outlined text-[16px]">edit</span>
        </button>

        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {msg.attachments.map(att => (
              <div key={att.id}>
                {att.type === 'image' ? (
                  <div className="relative rounded-lg overflow-hidden border border-on-user-message/10 w-32 h-32">
                    {att.previewUrl || att.data ? (
                      <img src={att.previewUrl || att.data} alt={att.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-on-user-message/10">
                        <span className="material-symbols-outlined text-[22px] text-on-user-message/70">image</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 w-full bg-overlay text-on-user-message text-[10px] truncate px-1.5 py-0.5" title={att.name}>
                      {att.name}
                    </div>
                  </div>
                ) : att.type === 'video' ? (
                  <div className="rounded-lg overflow-hidden border border-on-user-message/10 w-48 h-32 bg-user-message">
                    {att.previewUrl || att.data ? (
                      <video src={att.previewUrl || att.data} controls className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-on-user-message/70">
                        <span className="material-symbols-outlined text-[22px]">video_file</span>
                      </div>
                    )}
                  </div>
                ) : att.type === 'audio' ? (
                  <div className="rounded-lg border border-on-user-message/10 bg-on-user-message/5 p-2 w-64">
                    {att.previewUrl || att.data ? (
                      <audio src={att.previewUrl || att.data} controls className="w-full h-8" />
                    ) : (
                      <div className="text-[12px] text-on-user-message/70 truncate">{att.name}</div>
                    )}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-code-base bg-on-user-message/10 text-on-user-message/80" title={att.name}>
                    <span className="material-symbols-outlined text-[15px]">description</span>
                    <span className="max-w-[160px] truncate">{att.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="whitespace-pre-wrap font-ui-body text-[14px] leading-[1.5]">
          {msg.content}
        </div>
        <span className="mt-1 block text-right text-[9px] text-on-user-message/40">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
