import fs from 'node:fs/promises';
import path from 'node:path';
import { generateKnowledgeEvalCandidates } from '../electron/application/services/knowledgeEvalCaseGeneration.js';
import { RunKnowledgeEvaluation } from '../electron/application/usecases/RunKnowledgeEvaluation.js';
import type { KnowledgeStore } from '../electron/domain/entities/knowledge.js';
import type { KnowledgeEvalDataset, KnowledgeEvalReport } from '../electron/domain/entities/knowledgeEvaluation.js';
import { InMemoryKnowledgeRetriever } from '../electron/infrastructure/knowledge/InMemoryKnowledgeRetriever.js';

async function main() {
  const [command, inputPath, outputPath] = process.argv.slice(2);
  if (!command || !inputPath || !['run', 'generate'].includes(command)) {
    throw new Error('Usage: npm run eval:knowledge -- <generate|run> <input.json> [output.json]');
  }
  const input = JSON.parse(await fs.readFile(path.resolve(inputPath), 'utf8')) as unknown;
  if (command === 'generate') {
    const store = readKnowledgeStore(input);
    const dataset: KnowledgeEvalDataset = {
      name: path.basename(inputPath, path.extname(inputPath)),
      documents: store.documents,
      chunks: store.chunks,
      cases: generateKnowledgeEvalCandidates(store.chunks),
    };
    await writeResult(dataset, outputPath);
    return;
  }

  const dataset = readDataset(input);
  const report = await new RunKnowledgeEvaluation([
    new InMemoryKnowledgeRetriever({ version: 2, documents: dataset.documents, chunks: dataset.chunks }),
  ]).execute(dataset);
  await writeResult(report, outputPath);
  printSummary(report);
}

function readKnowledgeStore(value: unknown): KnowledgeStore {
  if (!isObject(value) || !Array.isArray(value.documents) || !Array.isArray(value.chunks)) {
    throw new Error('Input must contain documents[] and chunks[].');
  }
  return { version: typeof value.version === 'number' ? value.version : 2, documents: value.documents as KnowledgeStore['documents'], chunks: value.chunks as KnowledgeStore['chunks'] };
}

function readDataset(value: unknown): KnowledgeEvalDataset {
  const store = readKnowledgeStore(value);
  if (!isObject(value) || !Array.isArray(value.cases)) throw new Error('Evaluation dataset must contain cases[].');
  return { name: typeof value.name === 'string' ? value.name : 'knowledge-evaluation', ...store, cases: value.cases as KnowledgeEvalDataset['cases'] };
}

async function writeResult(value: unknown, outputPath?: string) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (outputPath) await fs.writeFile(path.resolve(outputPath), serialized, 'utf8');
  else process.stdout.write(serialized);
}

function printSummary(report: KnowledgeEvalReport) {
  for (const result of report.results) {
    const metrics = result.metrics;
    process.stderr.write(`${result.strategyId}: Recall@${result.limit}=${metrics.recallAtK.toFixed(3)} MRR=${metrics.meanReciprocalRank.toFixed(3)} nDCG=${metrics.ndcgAtK.toFixed(3)} p95=${metrics.latencyMs.p95.toFixed(2)}ms\n`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
