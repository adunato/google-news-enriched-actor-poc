export const LIMITS = Object.freeze({
  timeoutMs: 10000, maxRedirects: 5, prefixBytes: 512 * 1024,
  structuredBytes: 64 * 1024, maxDomElements: 10000,
  maxOutputChars: 100000, concurrency: 4, perHostDelayMs: 250,
  workerDeadlineMs: 5000, softStopMs: 780000, flushDeadlineMs: 840000, maxRows: 100,
});
