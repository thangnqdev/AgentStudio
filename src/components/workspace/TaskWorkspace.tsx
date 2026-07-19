import { ChatArea } from '../ChatArea';
import { PromptComposer } from '../PromptComposer';

export function TaskWorkspace() {
  return (
    <div className="flex flex-1 min-h-0 bg-white">
      <section className="relative flex min-w-0 flex-1 flex-col">
        <ChatArea />
        <PromptComposer />
      </section>
    </div>
  );
}
