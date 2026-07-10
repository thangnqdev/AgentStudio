import { useKnowledgeBase } from '../application/hooks/useKnowledgeBase';
import { KnowledgeHero } from './knowledge/KnowledgeHero';
import { KnowledgeImportCard } from './knowledge/KnowledgeImportCard';
import { KnowledgeLibraryPanel } from './knowledge/KnowledgeLibraryPanel';

export function KnowledgeView() {
  const knowledge = useKnowledgeBase();
  return <div className="flex-1 overflow-y-auto"><div className="max-w-[1120px] mx-auto px-6 py-10 lg:py-14"><KnowledgeHero library={knowledge.library} /><div className="mt-7 max-w-[360px]"><KnowledgeImportCard isImporting={knowledge.isImporting} isSyncing={knowledge.isSyncing} isWatching={knowledge.library.watching} notice={knowledge.notice} onImport={() => void knowledge.importDocuments()} onToggleWorkspaceSync={() => void knowledge.toggleWorkspaceSync()} /></div><KnowledgeLibraryPanel documents={knowledge.library.documents} isLoading={knowledge.isLoading} onRefresh={() => void knowledge.refresh()} onRemove={(documentId) => void knowledge.removeDocument(documentId)} /></div></div>;
}
