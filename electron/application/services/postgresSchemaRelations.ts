export type PostgresForeignKey = {
  constraintName: string;
  fromColumns: string;
  fromTable: string;
  toColumns: string;
  toTable: string;
};

export function readPostgresForeignKeys(source: string): PostgresForeignKey[] {
  const foreignKeys: PostgresForeignKey[] = [];
  const pattern = /ALTER TABLE ONLY\s+([^\s]+)\s+ADD CONSTRAINT\s+([^\s]+)\s+FOREIGN KEY\s+\(([^)]+)\)\s+REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)[^;]*;/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    foreignKeys.push({
      fromTable: match[1],
      constraintName: match[2],
      fromColumns: normalizeColumns(match[3]),
      toTable: match[4],
      toColumns: normalizeColumns(match[5]),
    });
  }
  return foreignKeys;
}

function normalizeColumns(value: string) {
  return value.split(',').map((column) => column.trim()).filter(Boolean).join(', ');
}
