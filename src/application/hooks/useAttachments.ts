import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import type { Attachment } from '../../domain/entities/message';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';

export type PendingAttachment = Attachment & {
  error?: string;
};

export function useAttachments() {
  const [attachedFiles, setAttachedFiles] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleDroppedFiles = (event: Event) => {
      const files = (event as CustomEvent<File[]>).detail;
      if (Array.isArray(files)) {
        addFiles(files);
      }
    };

    window.addEventListener('agentstudio:add-files', handleDroppedFiles);
    return () => {
      window.removeEventListener('agentstudio:add-files', handleDroppedFiles);
    };
  }, []);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const validFiles = files.filter(file => {
      if (file.name.endsWith('.exe') || file.name.endsWith('.dll')) {
        alert(`Không hỗ trợ đính kèm file định dạng này: ${file.name}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const newAttachments: PendingAttachment[] = await Promise.all(validFiles.map(async file => {
      const type = file.type.startsWith('image/') ? 'image' :
        file.type.startsWith('audio/') ? 'audio' :
          file.type.startsWith('video/') ? 'video' : 'text';
      const filePath = AgentBridge.getFilePath(file) || '';
      return {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        filePath,
        mimeType: file.type,
        size: file.size,
        previewUrl: type === 'image' || type === 'audio' || type === 'video'
          ? URL.createObjectURL(file)
          : undefined,
        error: filePath ? undefined : 'Không lấy được đường dẫn tệp.',
      };
    }));

    setAttachedFiles(prev => [...prev, ...newAttachments]);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles(prev => {
      const removed = prev.find((file) => file.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const clearFiles = () => {
    setAttachedFiles(prev => {
      prev.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      return [];
    });
  };

  return {
    attachedFiles,
    fileInputRef,
    handleFileClick,
    handleFileChange,
    removeFile,
    clearFiles,
  };
}
