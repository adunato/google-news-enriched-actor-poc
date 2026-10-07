import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("./main.mjs", import.meta.url), "utf8");
const a = source.indexOf("const R4_MAX_MARKERS_PER_ROW");
const b = source.indexOf("const R4_TRACE_BY_ROW");
const c = source.indexOf("function emitR4Record");
const d = source.indexOf("async function cancelResponseBody");
const lines = [];
const prefix = `const CONCURRENCY=4;${source.slice(a,b)}const R4_TRACE_BY_ROW=new Map();const r4RunStart=1000;const r4MarkerTotals={attempted:0,emitted:0,dropped:0,deduplicated:0,bytes:0};let r4WorkerJoins=0,r4RunSummaryLogged=false,r4GlobalOverflowLogged=false;`;
const context = vm.createContext({ Buffer, performance: { now: () => 1000 }, console: { log: (line) => lines.push(line), error() {} }, setTimeout: () => ({ unref() {} }), clearTimeout() {}, Map, Set, Math, JSON, RegExp });
vm.runInContext(prefix + source.slice(c,d), context);

vm.runInContext(`{ const t=createR4Trace("cap",1000); for(let n=1;n<=6;n++){t.attemptStarted(n,0);t.attemptEnded(n,{status:200,headers:{get:()=>"text/html"}})} t.attemptStarted(7,0); t.terminal(); }`, context);
let records = lines.map((line) => JSON.parse(line.slice("ISSUE41_R4 ".length)));
assert.equal(records.filter((record) => record.event === "row_overflow").length, 1);
const overflow = records.find((record) => record.event === "row_overflow");
assert.equal(overflow.state.reason, "request_attempt_marker_cap");
assert.equal(overflow.state.counters.dropped, 1);
assert.ok(Buffer.byteLength(lines.find((line) => line.includes('"event":"row_overflow"')), "utf8") + 1 <= 768);
let terminal = records.find((record) => record.event === "row_terminal");
const termLine = lines.find((line) => line.includes('"event":"row_terminal"'));
assert.equal(terminal.state.counters.bytes, lines.slice(0, lines.indexOf(termLine) + 1).reduce((n,line) => n + Buffer.byteLength(line,"utf8") + 1,0));
assert.equal(terminal.state.counters.emitted, records.length);
assert.equal(terminal.state.counters.attempted, records.length + 1);

lines.length = 0;
const byteCapContext = vm.createContext({ Buffer, performance: { now: () => 1000 }, console: { log: (line) => lines.push(line), error() {} }, setTimeout: () => ({ unref() {} }), clearTimeout() {}, Map, Set, Math, JSON, RegExp });
vm.runInContext(prefix + source.slice(c,d), byteCapContext);
vm.runInContext(`{ const t=createR4Trace("byte-cap",1000); t.record("body_read_entered",null,{oversized:"x".repeat(900)}); }`, byteCapContext);
records = lines.map((line) => JSON.parse(line.slice("ISSUE41_R4 ".length)));
assert.equal(records.filter((record) => record.event === "row_overflow").length, 1);
assert.equal(records.find((record) => record.event === "row_overflow").state.reason, "record_or_byte_cap");
assert.equal(records.filter((record) => record.event === "global_overflow").length, 1);

lines.length = 0;
const dedupeContext = vm.createContext({ Buffer, performance: { now: () => 1000 }, console: { log: (line) => lines.push(line), error() {} }, setTimeout: () => ({ unref() {} }), clearTimeout() {}, Map, Set, Math, JSON, RegExp });
vm.runInContext(prefix + source.slice(c,d), dedupeContext);
vm.runInContext(`{ const t=createR4Trace("dedupe",1000); t.record("reader_closed_settled"); t.record("reader_closed_settled"); t.terminal(); }`, dedupeContext);
records = lines.map((line) => JSON.parse(line.slice("ISSUE41_R4 ".length)));
terminal = records.find((record) => record.event === "row_terminal");
assert.equal(records.filter((record) => record.event === "reader_closed_settled").length, 1);
assert.equal(terminal.state.counters.deduplicated, 1);
assert.equal(terminal.state.counters.dropped, 0);

lines.length = 0;
const summaryContext = vm.createContext({ Buffer, performance: { now: () => 1000 }, console: { log: (line) => lines.push(line), error() {} }, setTimeout: () => ({ unref() {} }), clearTimeout() {}, Map, Set, Math, JSON, RegExp });
vm.runInContext(prefix + source.slice(c,d), summaryContext);
vm.runInContext("logR4Global('run_summary')", summaryContext);
const summaryLine = lines[0];
const summary = JSON.parse(summaryLine.slice("ISSUE41_R4 ".length));
assert.equal(summary.state.attempted, 1);
assert.equal(summary.state.emitted, 1);
assert.equal(summary.state.bytes, Buffer.byteLength(summaryLine,"utf8") + 1);

let failedCalls = 0;
const failingContext = vm.createContext({ Buffer, performance: { now: () => 1000 }, console: { log() { failedCalls += 1; throw new Error("synthetic logger failure"); }, error() {} }, setTimeout: () => ({ unref() {} }), clearTimeout() {}, Map, Set, Math, JSON, RegExp });
vm.runInContext(prefix + source.slice(c,d), failingContext);
vm.runInContext(`{ const t=createR4Trace("console-failure",1000); t.record("body_read_entered"); }`, failingContext);
assert.equal(failedCalls, 3, "row start, its one reserved overflow, and later marker are attempted without recursive overflow");

console.log("R4 offline logger checks passed: subcap/byte overflow, lifecycle dedup, terminal/summary totals, console-failure guard");
