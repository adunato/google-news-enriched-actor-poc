import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const root = dirname(fileURLToPath(import.meta.url));
const started = Date.now();
const deadlineMs = 60_000;
const maxInputBytes = 256 * 1024;
const perFixtureTimeoutMs = 5_000;
const wordTokens = (value) => (value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
const uniqueTokens = (value) => new Set(wordTokens(value));
const stripMarkup = (value) => value
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'");

function metrics(text, expectedBody, shouldRead) {
  const outputTokens = uniqueTokens(text);
  const expectedTokens = uniqueTokens(expectedBody);
  let overlap = 0;
  for (const token of outputTokens) if (expectedTokens.has(token)) overlap += 1;
  const wordCount = wordTokens(text).length;
  const recall = expectedTokens.size ? overlap / expectedTokens.size : 0;
  const precision = outputTokens.size ? overlap / outputTokens.size : 0;
  const readable = shouldRead && wordCount >= 100 && recall >= 0.55 && precision >= 0.80;
  const falsePositive = !shouldRead && wordCount >= 100 && recall >= 0.55 && precision >= 0.80;
  return {
    wordCount,
    expectedTokenRecall: Number(recall.toFixed(3)),
    expectedTokenPrecision: Number(precision.toFixed(3)),
    readable,
    falsePositive,
  };
}

function candidate(html, id) {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./extract-worker.mjs', import.meta.url), {
      workerData: { html, syntheticUrl: `https://fixture.invalid/${id}` },
    });
    let finished = false;
    const timer = setTimeout(async () => {
      if (finished) return;
      finished = true;
      await worker.terminate();
      resolve({ errorClass: 'TimeoutError' });
    }, perFixtureTimeoutMs);
    worker.once('message', async (message) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      await worker.terminate();
      resolve(message);
    });
    worker.once('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ errorClass: error?.name || 'WorkerError' });
    });
  });
}

const expected = JSON.parse(await readFile(join(root, 'fixtures', 'expected.json'), 'utf8'));
const rows = [];
for (const fixture of expected) {
  if (Date.now() - started > deadlineMs) throw new Error('Overall evaluation deadline exceeded');
  const html = await readFile(join(root, 'fixtures', fixture.file), 'utf8');
  const htmlBytes = Buffer.byteLength(html);
  if (htmlBytes > maxInputBytes) throw new Error(`Fixture ${fixture.id} exceeds the input cap`);
  const extracted = await candidate(html, fixture.id);
  const candidateMetrics = extracted.errorClass
    ? { errorClass: extracted.errorClass, wordCount: 0, expectedTokenRecall: 0, expectedTokenPrecision: 0, readable: false, falsePositive: false }
    : metrics(stripMarkup(extracted.content ?? ''), fixture.expectedBody, fixture.shouldRead);

  const semanticMatch = html.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)\s*>/i);
  const baselineText = semanticMatch ? stripMarkup(semanticMatch[1]) : '';
  const baselineMetrics = semanticMatch
    ? metrics(baselineText, fixture.expectedBody, fixture.shouldRead)
    : { available: false, wordCount: 0, expectedTokenRecall: 0, expectedTokenPrecision: 0, readable: false, falsePositive: false };

  rows.push({ id: fixture.id, shouldRead: fixture.shouldRead, htmlBytes, candidate: candidateMetrics, semanticBaseline: baselineMetrics });
}

const results = {
  package: '@extractus/article-extractor@9.0.1',
  nodeVersion: process.version,
  fixtureCount: rows.length,
  limits: { maxInputBytes, perFixtureTimeoutMs, deadlineMs },
  elapsedMs: Date.now() - started,
  rows,
};
await writeFile(join(root, 'results.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(results, null, 2));
