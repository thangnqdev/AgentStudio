import type { ViewId } from '../store/useAppStore';

interface ViewConfig {
  icon: string;
  title: string;
  description: string;
}

const VIEW_CONFIGS: Record<Exclude<ViewId, 'tasks' | 'settings'>, ViewConfig> = {
  workspace: {
    icon: 'folder_open',
    title: 'Workspace',
    description: 'Open a project folder to browse your codebase, manage files, and configure agent context.',
  },
  knowledge: {
    icon: 'menu_book',
    title: 'Knowledge Base',
    description: 'Store documents, notes, and references that the agent can use as context when working on tasks.',
  },
  files: {
    icon: 'description',
    title: 'File Explorer',
    description: 'Browse and manage files within your active workspace. Navigate your project structure with ease.',
  },
  agents: {
    icon: 'smart_toy',
    title: 'Agents',
    description: 'Configure specialized agents, manage active sessions, and monitor agent activity across tasks.',
  },
};

export function PlaceholderView({ view }: { view: Exclude<ViewId, 'tasks' | 'settings'> }) {
  const config = VIEW_CONFIGS[view];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-12">
      <div className="w-20 h-20 rounded-2xl bg-surface-container border border-outline-variant flex items-center justify-center mb-2">
        <span
          className="material-symbols-outlined text-[40px] text-secondary"
          style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
        >
          {config.icon}
        </span>
      </div>

      <div>
        <h2 className="font-display-serif text-[28px] leading-tight text-primary mb-2">{config.title}</h2>
        <p className="font-ui-body text-ui-body text-on-surface-variant max-w-sm leading-relaxed">
          {config.description}
        </p>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface-variant font-ui-body text-ui-body cursor-not-allowed opacity-60">
          <span className="material-symbols-outlined text-[16px]">construction</span>
          Coming soon
        </div>
      </div>
    </div>
  );
}
