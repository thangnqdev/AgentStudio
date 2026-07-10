import { useKnowledgeBase } from '../application/hooks/useKnowledgeBase';
import { KnowledgeHero } from './knowledge/KnowledgeHero';
import { KnowledgeImportCard } from './knowledge/KnowledgeImportCard';
import { KnowledgeLibraryPanel } from './knowledge/KnowledgeLibraryPanel';
import { KnowledgeSearchPanel } from './knowledge/KnowledgeSearchPanel';

export function KnowledgeView() {
  const knowledge = useKnowledgeBase();
  return <div className="flex-1 overflow-y-auto"><div className="max-w-[1120px] mx-auto px-6 py-10 lg:py-14"><KnowledgeHero library={knowledge.library} /><div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><KnowledgeSearchPanel semanticReady={knowledge.library.semanticReady} result={knowledge.result} onSearch={(query) => void knowledge.search(query)} /><KnowledgeImportCard isImporting={knowledge.isImporting} notice={knowledge.notice} onImport={() => void knowledge.importDocuments()} /></div><KnowledgeLibraryPanel documents={knowledge.library.documents} isLoading={knowledge.isLoading} onRefresh={() => void knowledge.refresh()} onRemove={(documentId) => void knowledge.removeDocument(documentId)} /></div></div>;
}
