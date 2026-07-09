import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Replace { and } inside <pre><code> block with {"{"} and {"}"}
content = content.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, (match, code) => {
  // First revert any previous hacks
  let cleaned = code.replace(/\{'\{'\}/g, '{').replace(/\{'\}'\}/g, '}');
  cleaned = cleaned.replace(/&#123;/g, '{').replace(/&#125;/g, '}');
  cleaned = cleaned.replace(/\{/g, '{"{"}').replace(/\}/g, '{"}"}');
  return `<pre><code>${cleaned}</code></pre>`;
});

fs.writeFileSync('src/App.tsx', content);
console.log('Fixed App.tsx');
