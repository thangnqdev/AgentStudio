import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

interface BranchManagerModalProps {
  onClose: () => void;
}

export function BranchManagerModal({ onClose }: BranchManagerModalProps) {
  const projectPath = useAppStore((s) => s.projectPath);
  const currentBranch = useAppStore((s) => s.currentBranch);
  const setCurrentBranch = useAppStore((s) => s.setCurrentBranch);
  
  const [branches, setBranches] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchBranches = async () => {
    if (!projectPath || !window.agentStudio?.gitGetBranches) return;
    setIsLoading(true);
    try {
      const res = await window.agentStudio.gitGetBranches(projectPath);
      if (res.success && res.branches) {
        setBranches(res.branches);
        if (res.current) setCurrentBranch(res.current);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [projectPath]);

  const handleCheckout = async (branchName: string) => {
    if (!projectPath || !window.agentStudio?.gitCheckout) return;
    setIsLoading(true);
    try {
      let target = branchName;
      if (target.startsWith('remotes/origin/')) {
        target = target.replace('remotes/origin/', '');
      }
      const res = await window.agentStudio.gitCheckout(projectPath, target);
      if (res.success) {
        await fetchBranches();
      } else {
        alert('Lỗi khi chuyển nhánh: ' + res.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!projectPath || !newBranchName.trim() || !window.agentStudio?.gitCreateBranch) return;
    setIsLoading(true);
    try {
      const res = await window.agentStudio.gitCreateBranch(projectPath, newBranchName.trim());
      if (res.success) {
        setNewBranchName('');
        await fetchBranches();
      } else {
        alert('Lỗi khi tạo nhánh: ' + res.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePushBranch = async () => {
    if (!projectPath || !currentBranch || !window.agentStudio?.gitPushBranch) return;
    setIsLoading(true);
    try {
      const res = await window.agentStudio.gitPushBranch(projectPath, currentBranch);
      if (res.success) {
        alert('Push nhánh thành công!');
        await fetchBranches();
      } else {
        alert('Lỗi khi push nhánh: ' + res.error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBranches = branches.filter(b => b.toLowerCase().includes(searchQuery.toLowerCase()));
  const localBranches = filteredBranches.filter(b => !b.startsWith('remotes/'));
  const remoteBranches = filteredBranches.filter(b => b.startsWith('remotes/'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface w-[450px] max-h-[80vh] rounded-xl shadow-2xl border border-outline-variant flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-outline-variant bg-surface-container-lowest">
          <h2 className="font-ui-label-bold text-on-surface text-[15px] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">call_split</span>
            Quản lý Nhánh (Branches)
          </h2>
          <button 
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Create Branch Area */}
        <div className="p-4 border-b border-outline-variant bg-surface-container-lowest">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-on-surface-variant/50">add</span>
              <input 
                type="text" 
                placeholder="Tên nhánh mới..." 
                value={newBranchName}
                onChange={e => setNewBranchName(e.target.value)}
                className="w-full bg-surface border border-outline-variant rounded-lg pl-9 pr-3 py-2 text-[13px] font-code-base focus:outline-none focus:border-primary text-on-surface"
              />
            </div>
            <button 
              onClick={handleCreateBranch}
              disabled={!newBranchName.trim() || isLoading}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg text-[13px] font-ui-label-bold disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              Tạo mới
            </button>
          </div>
        </div>

        {/* Current Branch Info */}
        {currentBranch && (
          <div className="p-3 mx-4 mt-4 bg-primary-container/30 border border-primary/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
              <span className="text-[12px] text-on-surface-variant">Nhánh hiện tại:</span>
              <span className="font-code-base text-[13px] font-bold text-primary">{currentBranch}</span>
            </div>
            <button 
              onClick={handlePushBranch}
              disabled={isLoading}
              title="Push nhánh này lên remote"
              className="flex items-center justify-center w-7 h-7 bg-surface-container rounded hover:bg-surface-container-highest text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
            </button>
          </div>
        )}

        {/* Search */}
        <div className="px-4 mt-4 relative">
          <span className="absolute left-7 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-on-surface-variant/50">search</span>
          <input 
            type="text" 
            placeholder="Tìm nhánh..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-9 pr-3 py-1.5 text-[13px] font-ui-body focus:outline-none focus:border-primary text-on-surface"
          />
        </div>

        {/* Branch List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading && branches.length === 0 ? (
            <div className="flex justify-center items-center py-8 text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-[24px]">sync</span>
            </div>
          ) : (
            <>
              {/* Local Branches */}
              {localBranches.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-ui-label-bold text-on-surface-variant/70 uppercase mb-2 px-1">Local Branches</h3>
                  <div className="space-y-1">
                    {localBranches.map(b => (
                      <button
                        key={b}
                        onClick={() => handleCheckout(b)}
                        disabled={b === currentBranch || isLoading}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-[13px] font-code-base transition-colors ${
                          b === currentBranch 
                            ? 'bg-secondary-container/40 text-primary cursor-default' 
                            : 'text-on-surface hover:bg-surface-container-high'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px] opacity-70">commit</span>
                        <span className="flex-1 truncate">{b}</span>
                        {b === currentBranch && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">Active</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Remote Branches */}
              {remoteBranches.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-ui-label-bold text-on-surface-variant/70 uppercase mb-2 px-1">Remote Branches</h3>
                  <div className="space-y-1">
                    {remoteBranches.map(b => (
                      <button
                        key={b}
                        onClick={() => handleCheckout(b)}
                        disabled={isLoading}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-[13px] font-code-base text-on-surface hover:bg-surface-container-high transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px] opacity-70">cloud</span>
                        <span className="flex-1 truncate">{b.replace('remotes/', '')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
