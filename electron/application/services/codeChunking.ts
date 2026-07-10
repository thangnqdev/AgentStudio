import * as ts from 'typescript';

export type CodeChunkSection = {
  title: string;
  symbol?: string;
  content: string;
};

export function splitCodeIntoSections(content: string, sourceName: string, extension: string, maxChars: number): CodeChunkSection[] {
  const sourceFile = ts.createSourceFile(sourceName, content, ts.ScriptTarget.Latest, true, scriptKindFor(extension));
  const sections: CodeChunkSection[] = [];
  let setup: string[] = [];

  const flushSetup = () => {
    const setupContent = setup.join('\n').trim();
    if (setupContent) sections.push(...toSizedSections('Module setup', undefined, setupContent, maxChars));
    setup = [];
  };

  for (const statement of sourceFile.statements) {
    const section = sectionForStatement(statement, sourceFile, maxChars);
    if (section) {
      flushSetup();
      sections.push(...section);
    } else {
      setup.push(statement.getFullText(sourceFile).trim());
    }
  }
  flushSetup();
  return sections.length > 0 ? sections : toSizedSections('Module source', undefined, content, maxChars);
}

function sectionForStatement(statement: ts.Statement, sourceFile: ts.SourceFile, maxChars: number) {
  const text = statement.getFullText(sourceFile).trim();
  if (!text) return [];
  if (ts.isClassDeclaration(statement)) return membersOrWhole('Class', statement.name?.text ?? 'anonymous class', statement.members, text, sourceFile, maxChars);
  if (ts.isInterfaceDeclaration(statement)) return membersOrWhole('Interface', statement.name.text, statement.members, text, sourceFile, maxChars);
  if (ts.isFunctionDeclaration(statement)) return toSizedSections('Function', statement.name?.text ?? 'anonymous function', text, maxChars);
  if (ts.isEnumDeclaration(statement)) return toSizedSections('Enum', statement.name.text, text, maxChars);
  if (ts.isTypeAliasDeclaration(statement)) return toSizedSections('Type', statement.name.text, text, maxChars);
  if (ts.isModuleDeclaration(statement)) return toSizedSections('Namespace', statement.name.getText(sourceFile), text, maxChars);
  if (ts.isVariableStatement(statement)) {
    const names = statement.declarationList.declarations.map((declaration) => declaration.name.getText(sourceFile));
    return toSizedSections('Variable', names.join(', ') || 'declaration', text, maxChars);
  }
  return undefined;
}

function membersOrWhole(
  kind: 'Class' | 'Interface',
  name: string,
  members: ts.NodeArray<ts.Node>,
  text: string,
  sourceFile: ts.SourceFile,
  maxChars: number,
) {
  if (text.length <= maxChars || members.length === 0) return toSizedSections(kind, name, text, maxChars);
  return members.flatMap((member, index) => {
    const memberText = member.getFullText(sourceFile).trim();
    const memberName = readMemberName(member, sourceFile) || `member ${index + 1}`;
    return toSizedSections(`${kind} ${name}`, `${name}.${memberName}`, `// ${kind} ${name}\n${memberText}`, maxChars);
  });
}

function readMemberName(member: ts.Node, sourceFile: ts.SourceFile) {
  return (member as ts.NamedDeclaration).name?.getText(sourceFile) ?? '';
}

function toSizedSections(kind: string, symbol: string | undefined, content: string, maxChars: number): CodeChunkSection[] {
  const title = symbol ? `${kind}: ${symbol}` : kind;
  return splitCodeText(content, maxChars).map((part) => ({ title, symbol, content: part }));
}

function splitCodeText(content: string, maxChars: number) {
  if (content.length <= maxChars) return [content];
  const sections: string[] = [];
  let current = '';
  for (const line of content.split('\n')) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) sections.push(current);
    current = line;
    while (current.length > maxChars) {
      sections.push(current.slice(0, maxChars));
      current = current.slice(maxChars);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function scriptKindFor(extension: string) {
  switch (extension.toLowerCase()) {
    case '.ts': return ts.ScriptKind.TS;
    case '.tsx': return ts.ScriptKind.TSX;
    case '.jsx': return ts.ScriptKind.JSX;
    default: return ts.ScriptKind.JS;
  }
}
