const IGNORED_DIRECTORIES = new Set([
  '.git', '.next', '.nuxt', '.turbo', '.vite', 'build', 'coverage', 'dist', 'dist-electron', 'node_modules', 'out', 'target', 'vendor',
]);

const INDEXABLE_EXTENSIONS = new Set([
  '.cjs', '.cs', '.csv', '.go', '.htm', '.html', '.java', '.js', '.json', '.jsonl', '.jsx', '.log', '.md', '.mdx', '.mjs',
  '.php', '.py', '.rb', '.rs', '.rst', '.sql', '.ts', '.tsx', '.tsv', '.txt', '.xml', '.yaml', '.yml',
]);

const SENSITIVE_FILE_SUFFIXES = ['.cer', '.key', '.pem', '.p12', '.pfx'];

export function shouldIgnoreWorkspacePath(relativePath: string) {
  const segments = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
  return segments.some((segment) => IGNORED_DIRECTORIES.has(segment));
}

export function shouldIndexWorkspaceFile(relativePath: string) {
  if (shouldIgnoreWorkspacePath(relativePath)) return false;
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const fileName = normalizedPath.split('/').at(-1)?.toLowerCase() ?? '';
  if (!fileName || fileName === '.env' || fileName.startsWith('.env.') || SENSITIVE_FILE_SUFFIXES.some((suffix) => fileName.endsWith(suffix))) {
    return false;
  }
  const extension = fileName.includes('.') ? `.${fileName.split('.').at(-1)}` : '';
  return INDEXABLE_EXTENSIONS.has(extension);
}
