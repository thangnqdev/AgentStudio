type SchemaTable = {
  name: string;
  definition: string;
};

/**
 * Produces a schema-only Markdown representation of PostgreSQL DDL. Keeping data
 * blocks out of the index makes table-level retrieval both safer and more useful.
 */
export function formatPostgresSchemaDocument(source: string) {
  const tables = readTables(source);
  if (tables.length === 0) return source;

  const comments = readTableComments(source);
  const constraints = readStatementsByTable(source, /ALTER TABLE ONLY\s+([^\s]+)[\s\S]*?;/gi);
  const indexes = readStatementsByTable(source, /CREATE (?:UNIQUE )?INDEX\s+[\s\S]*?;/gi, (statement) => {
    return /\bON\s+(?:ONLY\s+)?([^\s(]+)/i.exec(statement)?.[1];
  });

  return [
    '# PostgreSQL schema',
    '',
    'Schema-only extraction from SQL DDL. Table data and COPY blocks are intentionally excluded.',
    '',
    ...tables.flatMap((table) => formatTable(table, comments.get(table.name), constraints.get(table.name), indexes.get(table.name))),
  ].join('\n');
}

function readTables(source: string): SchemaTable[] {
  const tables: SchemaTable[] = [];
  const pattern = /\bCREATE TABLE\s+(?:IF NOT EXISTS\s+)?([^\s(]+)\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const openingParen = source.indexOf('(', match.index);
    const closingParen = findMatchingParen(source, openingParen);
    if (closingParen === -1) continue;
    const semicolon = source.indexOf(';', closingParen);
    if (semicolon === -1) continue;
    tables.push({
      name: match[1],
      definition: source.slice(match.index, semicolon + 1).trim(),
    });
    pattern.lastIndex = semicolon + 1;
  }
  return tables;
}

function findMatchingParen(source: string, openingParen: number) {
  let depth = 0;
  let quote = '';
  for (let index = openingParen; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) {
        if (quote === "'" && source[index + 1] === "'") {
          index += 1;
        } else {
          quote = '';
        }
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
    } else if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function readTableComments(source: string) {
  const comments = new Map<string, string>();
  const pattern = /COMMENT ON TABLE\s+([^\s]+)\s+IS\s+'((?:''|[^'])*)';/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) comments.set(match[1], match[2].replace(/''/g, "'"));
  return comments;
}

function readStatementsByTable(source: string, pattern: RegExp, tableNameForStatement: (statement: string) => string | undefined = (statement) => {
  return /ALTER TABLE ONLY\s+([^\s]+)/i.exec(statement)?.[1];
}) {
  const statements = new Map<string, string[]>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const statement = match[0].trim();
    const tableName = tableNameForStatement(statement);
    if (!tableName) continue;
    const entries = statements.get(tableName) ?? [];
    entries.push(statement);
    statements.set(tableName, entries);
  }
  return statements;
}

function formatTable(table: SchemaTable, comment: string | undefined, constraints: string[] | undefined, indexes: string[] | undefined) {
  const blocks = [
    `## ${table.name}`,
    comment ? `Description: ${comment}` : '',
    '',
    'Table definition:',
    '```sql',
    table.definition,
    '```',
  ];
  if (constraints?.length) blocks.push('', 'Constraints:', '```sql', ...constraints, '```');
  if (indexes?.length) blocks.push('', 'Indexes:', '```sql', ...indexes, '```');
  return [...blocks, ''];
}
