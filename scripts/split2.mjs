import fs from 'fs';
import path from 'path';

const lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

const writeComp = (name, start, end) => {
  const content = `export function ${name}() {
  return (
    <>
${lines.slice(start, end).join('\n')}
    </>
  );
}`;
  fs.writeFileSync(path.join('src/components', `${name}.tsx`), content);
};

if (!fs.existsSync('src/components')) {
  fs.mkdirSync('src/components');
}

writeComp('Sidebar', 8, 86);
writeComp('TopAppBar', 89, 112);
writeComp('ChatArea', 113, 231);
writeComp('PromptComposer', 232, 258);

const appLines = [
  ...lines.slice(0, 8),
  '      <Sidebar />',
  '      <main className="flex-1 flex flex-col bg-background canvas-glow relative">',
  '        <TopAppBar />',
  '        <ChatArea />',
  '        <PromptComposer />',
  '      </main>',
  ...lines.slice(259)
];

const appTsx = `import { Sidebar } from './components/Sidebar';
import { TopAppBar } from './components/TopAppBar';
import { ChatArea } from './components/ChatArea';
import { PromptComposer } from './components/PromptComposer';
${appLines.join('\n')}`;

fs.writeFileSync('src/App.tsx', appTsx);
console.log("Done");
