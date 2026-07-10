import { useEffect, useState, useCallback } from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { useAppStore } from '../store/useAppStore';

type GitStatusItem = {
  status: string;
  path: string;
};

export function SourceControlView() {
  const projectPath = useAppStore((s) => s.projectPath);
  const [modifiedFiles, setModifiedFiles] = useState<GitStatusItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffText, setDiffText] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Git Actions States
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchStatus = useCallback(() => {
    if (!projectPath || projectPath === 'chưa có dự án' || !window.agentStudio?.getGitStatus) {
      setModifiedFiles([]);
      return;
    }
    window.agentStudio.getGitStatus(projectPath).then((files) => {
      setModifiedFiles(files);
      // Auto-stage all modified files by default if stagedFiles is empty and files just loaded
      setStagedFiles(prev => {
        if (prev.size === 0 && files.length > 0) {
          return new Set(files.map(f => f.path));
        }
        // Remove files that are no longer modified
        const validPaths = new Set(files.map(f => f.path));
        const newStaged = new Set([...prev].filter(x => validPaths.has(x)));
        return newStaged;
      });
    });
  }, [projectPath]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (!selectedFile || !projectPath || !window.agentStudio?.getGitDiff) {
      setDiffText('');
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    window.agentStudio.getGitDiff(projectPath, selectedFile).then((diff) => {
      if (isMounted) {
        setDiffText(diff);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedFile, projectPath]);

  const toggleStaged = (path: string) => {
    const next = new Set(stagedFiles);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setStagedFiles(next);
  };

  const handleCommit = async () => {
    if (!projectPath || stagedFiles.size === 0 || !commitMessage.trim() || !window.agentStudio?.gitCommit) return;
    
    setIsCommitting(true);
    try {
      const res = await window.agentStudio.gitCommit(projectPath, Array.from(stagedFiles), commitMessage);
      if (res.success) {
        setCommitMessage('');
        setStagedFiles(new Set());
        fetchStatus();
        if (selectedFile && stagedFiles.has(selectedFile)) {
          setSelectedFile(null);
        }
      } else {
        alert('Commit failed: ' + res.error);
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePush = async () => {
    if (!projectPath || !window.agentStudio?.gitPush) return;
    setIsSyncing(true);
    try {
      const res = await window.agentStudio.gitPush(projectPath);
      if (!res.success) alert('Push failed: ' + res.error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePull = async () => {
    if (!projectPath || !window.agentStudio?.gitPull) return;
    setIsSyncing(true);
    try {
      const res = await window.agentStudio.gitPull(projectPath);
      if (!res.success) alert('Pull failed: ' + res.error);
      fetchStatus();
    } finally {
      setIsSyncing(false);
    }
  };

  const parseDiff = (rawDiff: string) => {
    const lines = rawDiff.split('\n');
    let oldValue = '';
    let newValue = '';
    let i = 0;
    while (i < lines.length && !lines[i].startsWith('@@ ')) i++;
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('@@ ')) {
        oldValue += '\n';
        newValue += '\n';
      } else if (line.startsWith('-')) {
        oldValue += line.substring(1) + '\n';
      } else if (line.startsWith('+')) {
        newValue += line.substring(1) + '\n';
      } else if (line.startsWith(' ')) {
        oldValue += line.substring(1) + '\n';
        newValue += line.substring(1) + '\n';
      } else {
        oldValue += line + '\n';
        newValue += line + '\n';
      }
    }
    return { oldValue, newValue };
  };

  const { oldValue, newValue } = parseDiff(diffText);

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return 'data_object';
    if (fileName.endsWith('.json')) return 'data_array';
    if (fileName.endsWith('.md')) return 'article';
    return 'insert_drive_file';
  };

  const getStatusColor = (status: string) => {
    if (status.includes('M')) return 'text-[#005fb8] bg-[#005fb8]/10';
    if (status.includes('A') || status.includes('?')) return 'text-[#1e8e3e] bg-[#1e8e3e]/10';
    if (status.includes('D')) return 'text-[#d93025] bg-[#d93025]/10';
    return 'text-orange-600 bg-orange-600/10';
  };

  const getStatusLabel = (status: string) => {
    if (status.includes('M')) return 'M';
    if (status.includes('A') || status.includes('?')) return 'A';
    if (status.includes('D')) return 'D';
    return status.trim().charAt(0) || 'U';
  };

  return (
    <div className="flex w-full h-full bg-surface">
      {/* Sidebar for Source Control */}
      <div className="w-[300px] border-r border-outline-variant flex flex-col h-full bg-surface-container-lowest shrink-0">
        
        {/* Header & Sync Actions */}
        <div className="p-4 border-b border-outline-variant">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-ui-label-bold text-on-surface">Mã Nguồn (Git)</h2>
            <div className="flex items-center gap-1">
              <button 
                onClick={handlePull} 
                disabled={isSyncing}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container-highest text-on-surface-variant transition-colors disabled:opacity-50" 
                title="Tải về (Pull)"
              >
                <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>
                  {isSyncing ? 'sync' : 'arrow_downward'}
                </span>
              </button>
              <button 
                onClick={handlePush} 
                disabled={isSyncing}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container-highest text-on-surface-variant transition-colors disabled:opacity-50" 
                title="Đẩy lên (Push)"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
            </div>
          </div>
          
          {/* Commit Area */}
          <div className="flex flex-col gap-2">
            <textarea
              className="w-full bg-surface-container border border-outline-variant rounded-lg p-2 text-[13px] font-ui-body resize-none focus:outline-none focus:border-primary text-on-surface placeholder:text-on-surface-variant/50"
              rows={2}
              placeholder="Tin nhắn thay đổi (Commit message)"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
            />
            <button
              onClick={handleCommit}
              disabled={isCommitting || stagedFiles.size === 0 || !commitMessage.trim()}
              className="w-full bg-primary text-on-primary py-1.5 rounded-lg text-[13px] font-ui-label-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              {isCommitting ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                  Đang Commit...
                </>
              ) : (
                `Commit ${stagedFiles.size} tệp`
              )}
            </button>
          </div>
        </div>
        
        {/* File List */}
        <div className="flex-1 overflow-y-auto py-2">
          {modifiedFiles.length > 0 && (
            <div className="px-3 py-1 mb-1 text-[11px] font-ui-label-bold text-on-surface-variant/70 uppercase">
              Thay đổi ({modifiedFiles.length})
            </div>
          )}
          
          {modifiedFiles.map((file) => {
            const isSelected = selectedFile === file.path;
            const isStaged = stagedFiles.has(file.path);
            const fileName = file.path.split('/').pop() || '';
            const dirPath = file.path.substring(0, file.path.lastIndexOf('/'));
            
            return (
              <div 
                key={file.path}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors relative cursor-pointer
                  ${isSelected ? 'bg-secondary-container/40' : 'hover:bg-surface-container-high'}
                `}
                onClick={() => setSelectedFile(file.path)}
              >
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary rounded-r-full" />}
                
                {/* Checkbox for staging */}
                <div 
                  className="flex items-center justify-center cursor-pointer p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStaged(file.path);
                  }}
                >
                  <span className={`material-symbols-outlined text-[18px] ${isStaged ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                    {isStaged ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                </div>
                
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant opacity-70">
                  {getFileIcon(fileName)}
                </span>
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <span className={`font-code-base text-[13px] truncate leading-tight ${isSelected ? 'text-primary font-medium' : 'text-on-surface'}`}>
                    {fileName}
                  </span>
                  {dirPath && (
                    <span className="text-[10px] text-on-surface-variant truncate opacity-70 leading-tight">
                      {dirPath}
                    </span>
                  )}
                </div>

                <div className={`w-[18px] h-[18px] rounded flex items-center justify-center font-code-base text-[10px] font-bold ${getStatusColor(file.status)}`}>
                  {getStatusLabel(file.status)}
                </div>
              </div>
            );
          })}
          
          {modifiedFiles.length === 0 && (
            <div className="flex flex-col items-center text-center mt-12 px-6 opacity-60">
              <span className="material-symbols-outlined text-[48px] mb-3 text-on-surface-variant">check_circle</span>
              <p className="text-sm font-ui-body text-on-surface-variant">Không có thay đổi nào.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Diff Viewer */}
      <div className="flex-1 h-full overflow-hidden bg-surface-container-lowest flex flex-col">
        {selectedFile ? (
          <>
            <div className="h-[52px] border-b border-outline-variant bg-surface flex items-center px-4 gap-3 shrink-0 shadow-sm z-10">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                {getFileIcon(selectedFile.split('/').pop() || '')}
              </span>
              <div className="flex items-center gap-1.5 font-code-base text-[13px]">
                <span className="text-on-surface-variant opacity-60">
                  {selectedFile.substring(0, selectedFile.lastIndexOf('/') + 1)}
                </span>
                <span className="text-on-surface font-medium">
                  {selectedFile.split('/').pop()}
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-surface-container-lowest">
              {isLoading ? (
                <div className="flex justify-center items-center h-full text-on-surface-variant gap-2">
                  <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                  <span className="font-ui-body text-sm">Đang tải thay đổi...</span>
                </div>
              ) : diffText ? (
                <div className="px-2 py-4">
                  <ReactDiffViewer
                    oldValue={oldValue.trim()}
                    newValue={newValue.trim()}
                    splitView={true}
                    useDarkTheme={false}
                    leftTitle="Cũ"
                    rightTitle="Mới"
                    styles={{
                      variables: {
                        light: {
                          diffViewerBackground: 'transparent',
                          addedBackground: '#e6ffed',
                          addedColor: '#24292e',
                          removedBackground: '#ffeef0',
                          removedColor: '#24292e',
                          wordAddedBackground: '#acf2bd',
                          wordRemovedBackground: '#fdb8c0',
                          addedGutterBackground: '#cdffd8',
                          removedGutterBackground: '#ffdce0',
                          gutterBackground: '#f6f8fa',
                          gutterBackgroundDark: '#f6f8fa',
                          highlightBackground: '#fffbdd',
                          highlightGutterBackground: '#fff5b1',
                        }
                      },
                      line: {
                        fontSize: '12px',
                        fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-on-surface-variant gap-2 opacity-60">
                  <span className="material-symbols-outlined text-[40px]">info</span>
                  <p className="font-ui-body text-sm">Không lấy được diff hoặc tệp rỗng.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-on-surface-variant opacity-50 gap-4">
            <span className="material-symbols-outlined text-[64px]" style={{ fontVariationSettings: "'wght' 200" }}>compare</span>
            <p className="font-ui-body text-[15px]">Chọn một tệp bên danh sách để xem sự khác biệt</p>
          </div>
        )}
      </div>
    </div>
  );
}
