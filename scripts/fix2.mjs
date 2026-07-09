import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// The original JSX inside the code block is messy because it contains raw { and }.
// We'll replace the entire code block with a clean string literal block, 
// maintaining the syntax highlighting span tags by escaping { as {"{"} and } as {"}"}

content = content.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, () => {
  return `<pre><code>
<span className="text-[#9C4326]">export</span> <span className="text-[#9C4326]">function</span> <span className="text-[#292724] font-medium">RequirePermission</span>(scope: <span className="text-[#615E5A]">PermissionScope</span>) {"{"}
  <span className="text-[#9C4326]">return</span> <span className="text-[#9C4326]">function</span> (
    target: <span className="text-[#615E5A]">any</span>,
    propertyKey: <span className="text-[#615E5A]">string</span>,
    descriptor: <span className="text-[#615E5A]">PropertyDescriptor</span>
  ) {"{"}
    <span className="text-[#9C4326]">const</span> originalMethod = descriptor.<span className="text-[#292724]">value</span>;

    descriptor.<span className="text-[#292724]">value</span> = <span className="text-[#9C4326]">async function</span> (...args: <span className="text-[#615E5A]">any</span>[]) {"{"}
      <span className="text-[#9C4326]">const</span> context = <span className="text-[#292724]">this</span>.<span className="text-[#292724]">context</span>;
      <span className="text-[#9C4326]">if</span> (!<span className="text-[#292724]">await</span> context.permissions.check(scope)) {"{"}
        <span className="text-[#9C4326]">throw new</span> <span className="text-[#292724] font-medium">SecurityError</span>(<span className="text-[#73250A]">\`Permission denied: \${"{"}scope{"}"}\`</span>);
      {"}"}
      <span className="text-[#9C4326]">return</span> originalMethod.<span className="text-[#292724]">apply</span>(<span className="text-[#292724]">this</span>, args);
    {"}"};
  {"}"};
{"}"}
</code></pre>`;
});

fs.writeFileSync('src/App.tsx', content);
