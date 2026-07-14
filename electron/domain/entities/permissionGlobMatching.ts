import { normalizePermissionPath } from './permissionArgumentMatching.js';

export function matchesPermissionGlob(pattern: string, candidate: string): boolean {
  let patternIndex = 0;
  let candidateIndex = 0;
  let starIndex = -1;
  let retryIndex = 0;

  while (candidateIndex < candidate.length) {
    if (patternIndex < pattern.length && (pattern[patternIndex] === '?' || pattern[patternIndex] === candidate[candidateIndex])) {
      patternIndex += 1;
      candidateIndex += 1;
    } else if (patternIndex < pattern.length && pattern[patternIndex] === '*') {
      starIndex = patternIndex;
      retryIndex = candidateIndex;
      patternIndex += 1;
    } else if (starIndex >= 0) {
      patternIndex = starIndex + 1;
      retryIndex += 1;
      candidateIndex = retryIndex;
    } else {
      return false;
    }
  }
  while (patternIndex < pattern.length && pattern[patternIndex] === '*') patternIndex += 1;
  return patternIndex === pattern.length;
}

export function isWorkspaceSearch(toolName: string) {
  return toolName === 'glob' || toolName === 'grep';
}

export function searchMayReachPathGlob(toolName: string, args: Record<string, unknown>, rawRuleGlob: string) {
  const ruleGlob = normalizePermissionPath(rawRuleGlob);
  const root = normalizePermissionPath(typeof args.path === 'string' ? args.path : '.');
  const rawSearchGlob = toolName === 'glob'
    ? (typeof args.pattern === 'string' ? args.pattern : '**/*')
    : (typeof args.glob === 'string' ? args.glob : '**/*');
  const searchGlob = normalizePermissionPath(rawSearchGlob);
  if (!hasWildcard(searchGlob)) {
    const candidate = normalizePermissionPath(root === '.' ? searchGlob : `${root}/${searchGlob}`);
    return matchesPermissionGlob(ruleGlob, candidate);
  }
  const restrictedPrefix = staticGlobPrefix(ruleGlob);
  const patternPrefix = staticGlobPrefix(searchGlob);
  const searchPrefix = normalizePermissionPath([root === '.' ? '' : root, patternPrefix].filter(Boolean).join('/'));
  if (!restrictedPrefix || restrictedPrefix === '.' || searchPrefix === '.') return true;
  return isPathPrefix(restrictedPrefix, searchPrefix) || isPathPrefix(searchPrefix, restrictedPrefix);
}

function staticGlobPrefix(pattern: string) {
  const index = pattern.search(/[?*]/);
  return normalizePermissionPath((index < 0 ? pattern : pattern.slice(0, index)).replace(/\/$/, ''));
}

function hasWildcard(value: string) { return /[?*]/.test(value); }
function isPathPrefix(prefix: string, value: string) { return value === prefix || value.startsWith(`${prefix}/`); }
