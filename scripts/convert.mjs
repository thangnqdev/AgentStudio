import fs from 'fs';

const htmlContent = fs.readFileSync('../code.html', 'utf-8');

// Extract the body content
const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
let bodyInner = bodyMatch ? bodyMatch[1] : '';

// Convert class= to className=
bodyInner = bodyInner.replace(/class=/g, 'className=');

// Convert style attributes if any (not strictly needed if no complex styles are there, but wait, there is style="font-variation-settings: 'FILL' 1;")
bodyInner = bodyInner.replace(/style="([^"]*)"/g, (match, styleString) => {
    return 'style={{ ' + styleString.split(';').filter(Boolean).map(s => {
        let [key, val] = s.split(':');
        if (!key) return '';
        key = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
        return `${key}: "${val.trim().replace(/'/g, "\\'")}"`;
    }).join(', ') + ' }}';
});

// Convert HTML comments to JSX comments
bodyInner = bodyInner.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');

// The App.tsx template
const appTsx = `import React from 'react';

function App() {
  return (
    <div className="bg-surface-container-low min-h-screen flex items-center justify-center p-8 text-on-surface font-ui-body">
      ${bodyInner}
    </div>
  );
}

export default App;
`;

fs.writeFileSync('src/App.tsx', appTsx);
console.log('Successfully converted code.html to App.tsx');
