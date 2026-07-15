import type { AgentToolDefinition } from '../../domain/entities/tool.js';

export function searchDeferredTools(
  query: string,
  deferredTools: readonly AgentToolDefinition[],
  allTools: readonly AgentToolDefinition[],
  maxResults: number,
) {
  const direct = query.match(/^select:(.+)$/i);
  if (direct) return selectTools(direct[1], allTools, maxResults);
  const normalized = query.toLowerCase().trim();
  const exact = findTool(deferredTools, normalized) ?? findTool(allTools, normalized);
  if (exact) return [exact.name];
  const prefix = deferredTools.filter((tool) => tool.name.toLowerCase().startsWith(normalized));
  if ((normalized.startsWith('mcp_') || normalized.startsWith('mcp__')) && prefix.length) {
    return prefix.slice(0, maxResults).map((tool) => tool.name);
  }

  const terms = normalized.split(/\s+/).filter(Boolean);
  const required = terms.filter((term) => term.startsWith('+') && term.length > 1).map((term) => term.slice(1));
  const scoringTerms = terms.map((term) => term.startsWith('+') ? term.slice(1) : term).filter(Boolean);
  return deferredTools
    .map((tool, index) => ({ tool, index, searchable: searchableTool(tool) }))
    .filter(({ searchable }) => required.every((term) => includesTerm(searchable, term)))
    .map(({ tool, index, searchable }) => ({ name: tool.name, index, score: scoreTool(searchable, scoringTerms) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index || left.name.localeCompare(right.name))
    .slice(0, maxResults)
    .map((item) => item.name);
}

function selectTools(raw: string, tools: readonly AgentToolDefinition[], maximum: number) {
  const matches: string[] = [];
  for (const requested of raw.split(',').map((item) => item.trim()).filter(Boolean)) {
    const tool = findTool(tools, requested.toLowerCase());
    if (tool && !matches.includes(tool.name)) matches.push(tool.name);
    if (matches.length >= maximum) break;
  }
  return matches;
}

function findTool(tools: readonly AgentToolDefinition[], normalized: string) {
  return tools.find((tool) => tool.name.toLowerCase() === normalized);
}

type SearchableTool = { parts: string[]; full: string; description: string; hint: string; isMcp: boolean };

function searchableTool(tool: AgentToolDefinition): SearchableTool {
  const isMcp = tool.source?.kind === 'mcp' || tool.name.startsWith('mcp_');
  const parts = tool.name
    .replace(/^mcp_+/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase().split(/\s+/).filter(Boolean);
  return {
    parts, full: parts.join(' '), isMcp,
    description: tool.description.toLowerCase(), hint: tool.searchHint?.toLowerCase() ?? '',
  };
}

function includesTerm(tool: SearchableTool, term: string) {
  return tool.parts.includes(term) || tool.parts.some((part) => part.includes(term))
    || hasWord(tool.description, term) || hasWord(tool.hint, term);
}

function scoreTool(tool: SearchableTool, terms: string[]) {
  let score = 0;
  for (const term of terms) {
    if (tool.parts.includes(term)) score += tool.isMcp ? 12 : 10;
    else if (tool.parts.some((part) => part.includes(term))) score += tool.isMcp ? 6 : 5;
    if (tool.full.includes(term) && score === 0) score += 3;
    if (hasWord(tool.hint, term)) score += 4;
    if (hasWord(tool.description, term)) score += 2;
  }
  return score;
}

function hasWord(value: string, term: string) {
  if (!value || !term) return false;
  return value.split(/[^a-zA-Z0-9]+/).some((part) => part === term);
}
