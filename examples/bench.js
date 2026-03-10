/**
 * ason-js — benchmark vs JSON.parse / JSON.stringify (inference-driven API)
 * Run: node examples/bench.js  (after npm run build)
 *
 * Benchmark semantics:
 *   "ASON untyped serialize"  → encode(obj)        — no schema arg; shorter output
 *   "ASON typed serialize"    → encodeTyped(obj)   — typed header; decode restores types
 *   "ASON deserialize"        → decode(text)        — reads embedded schema
 *   "BIN serialize"           → encodeBinary(obj)  — schema inferred internally
 *   "BIN deserialize"         → decodeBinary(data, schema) — schema required
 *
 * Mirrors ason-go/examples/bench and ason-py/examples/bench.
 */
import { encode, encodeTyped, decode, encodeBinary, decodeBinary } from '../dist/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run fn() `iters` times and return average ns per call */
function bench(fn, iters) {
  const start = performance.now();
  for (let i = 0; i < iters; i++) fn();
  const end = performance.now();
  return Math.round(((end - start) * 1e6) / iters); // ns per call
}

function fmtNs(ns) {
  if (ns >= 1_000_000) return `${(ns / 1_000_000).toFixed(2)} ms`;
  if (ns >= 1_000) return `${(ns / 1_000).toFixed(2)} µs`;
  return `${ns} ns`;
}

function printRow(label, ns, extra = '') {
  console.log(`  ${label.padEnd(32)} ${fmtNs(ns).padStart(12)}  ${extra}`);
}

function makeUsers(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `User${i}`,
    email: `u${i}@example.com`,
    score: i * 0.5,
    active: i % 2 === 0,
    dept: `Dept${i % 10}`,
    age: 20 + (i % 40),
    salary: 50000 + i * 100,
  }));
}

function makeAllTypes(n) {
  return Array.from({ length: n }, (_, i) => ({
    b: i % 2 === 0,
    n: -i,
    u: i,
    f: i * 1.25,
    s: `str${i}`,
    on: i % 3 === 0 ? null : i,
    of: i % 4 === 0 ? null : i * 0.5,
  }));
}

// Schema strings used only for decodeBinary (binary decode requires explicit schema)
const FLAT_SCHEMA_BIN = '[{id:int, name:str, email:str, score:float, active:bool, dept:str, age:int, salary:int}]';
const ALL_SCHEMA_BIN  = '[{b:bool, n:int, u:uint, f:float, s:str, on:int?, of:float?}]';

// ---------------------------------------------------------------------------
// Section 1: Flat struct (8 fields) — untyped vs typed vs JSON serialize
// ---------------------------------------------------------------------------
console.log('\n=== Section 1: Flat struct (8 fields) — untyped / typed / JSON serialize ===\n');
console.log('  ' + 'Label'.padEnd(32) + '  Time/call       Note');
console.log('  ' + '-'.repeat(70));

for (const n of [100, 500, 1000, 5000]) {
  const rows = makeUsers(n);
  const untypedText = encode(rows);
  const typedText   = encodeTyped(rows);
  const jsonText    = JSON.stringify(rows);
  const iters = n <= 1000 ? 200 : 50;

  const untypedSer = bench(() => encode(rows), iters);
  const typedSer   = bench(() => encodeTyped(rows), iters);
  const untypedDe  = bench(() => decode(untypedText), iters);
  const typedDe    = bench(() => decode(typedText), iters);
  const jsonSer    = bench(() => JSON.stringify(rows), iters);
  const jsonDe     = bench(() => JSON.parse(jsonText), iters);

  const savingUntyped = ((1 - untypedText.length / jsonText.length) * 100).toFixed(1);
  const savingTyped   = ((1 - typedText.length   / jsonText.length) * 100).toFixed(1);
  console.log(`\n  N=${n}  ASON untyped ${untypedText.length}B (${savingUntyped}% < JSON) | typed ${typedText.length}B (${savingTyped}% < JSON) | JSON ${jsonText.length}B`);
  printRow('ASON untyped serialize', untypedSer, `${(jsonSer / untypedSer).toFixed(2)}× vs JSON`);
  printRow('ASON typed   serialize', typedSer,   `${(jsonSer / typedSer).toFixed(2)}× vs JSON`);
  printRow('ASON untyped deserialize', untypedDe, `${(jsonDe / untypedDe).toFixed(2)}× vs JSON`);
  printRow('ASON typed   deserialize', typedDe,   `${(jsonDe / typedDe).toFixed(2)}× vs JSON`);
  printRow('JSON serialize',  jsonSer);
  printRow('JSON deserialize', jsonDe);
}

// ---------------------------------------------------------------------------
// Section 2: All-types struct (7 fields incl. optionals)
// ---------------------------------------------------------------------------
console.log('\n=== Section 2: All-types struct (7 fields, with optionals) ===\n');
console.log('  ' + 'Label'.padEnd(32) + '  Time/call       Note');
console.log('  ' + '-'.repeat(70));

for (const n of [100, 500]) {
  const rows = makeAllTypes(n);
  const typedText = encodeTyped(rows);
  const jsonText  = JSON.stringify(rows);
  const iters = 200;

  const typedSer = bench(() => encodeTyped(rows), iters);
  const typedDe  = bench(() => decode(typedText), iters);
  const jsonSer  = bench(() => JSON.stringify(rows), iters);
  const jsonDe   = bench(() => JSON.parse(jsonText), iters);

  const saving = ((1 - typedText.length / jsonText.length) * 100).toFixed(1);
  console.log(`\n  N=${n}  ASON typed ${typedText.length}B vs JSON ${jsonText.length}B  (${saving}% smaller)`);
  printRow('ASON typed serialize',   typedSer, `${(jsonSer / typedSer).toFixed(2)}× vs JSON`);
  printRow('ASON typed deserialize', typedDe,  `${(jsonDe  / typedDe).toFixed(2)}× vs JSON`);
  printRow('JSON serialize',  jsonSer);
  printRow('JSON deserialize', jsonDe);
}

// ---------------------------------------------------------------------------
// Section 3: Binary vs typed text vs JSON
// ---------------------------------------------------------------------------
console.log('\n=== Section 3: Binary vs typed text vs JSON ===\n');
console.log('  ' + 'Label'.padEnd(32) + '  Time/call       Size');
console.log('  ' + '-'.repeat(70));

for (const n of [100, 1000]) {
  const rows      = makeUsers(n);
  const typedText = encodeTyped(rows);
  const binData   = encodeBinary(rows);          // schema inferred internally
  const jsonText  = JSON.stringify(rows);
  const iters     = 100;

  const binSer   = bench(() => encodeBinary(rows), iters);
  const binDe    = bench(() => decodeBinary(binData, FLAT_SCHEMA_BIN), iters);
  const typedSer = bench(() => encodeTyped(rows), iters);
  const typedDe  = bench(() => decode(typedText), iters);
  const jsonSer  = bench(() => JSON.stringify(rows), iters);
  const jsonDe   = bench(() => JSON.parse(jsonText), iters);

  console.log(`\n  N=${n}`);
  printRow('BIN serialize',         binSer,   `${binData.length} B  (${((1 - binData.length / jsonText.length) * 100).toFixed(0)}% < JSON)`);
  printRow('BIN deserialize',       binDe,    `${(jsonDe / binDe).toFixed(2)}× vs JSON`);
  printRow('ASON typed serialize',  typedSer, `${typedText.length} B  (${((1 - typedText.length / jsonText.length) * 100).toFixed(0)}% < JSON)`);
  printRow('ASON typed deserialize',typedDe,  `${(jsonDe / typedDe).toFixed(2)}× vs JSON`);
  printRow('JSON serialize',  jsonSer, `${jsonText.length} B`);
  printRow('JSON deserialize', jsonDe);
}

// ---------------------------------------------------------------------------
// Section 4: Single-struct roundtrip — 10,000 iterations
// ---------------------------------------------------------------------------
console.log('\n=== Section 4: Single struct roundtrip (10 000 iters) ===\n');
{
  const obj  = { id: 1, name: 'Alice', score: 9.5, active: true };
  const typed = encodeTyped(obj);
  const data  = encodeBinary(obj);
  const schema = '{id:int, name:str, score:float, active:bool}';

  const typedSer  = bench(() => encodeTyped(obj), 10000);
  const typedDe   = bench(() => decode(typed), 10000);
  const binSer    = bench(() => encodeBinary(obj), 10000);
  const binDe     = bench(() => decodeBinary(data, schema), 10000);
  const untypedSer = bench(() => encode(obj), 10000);

  printRow('Typed text serialize',   typedSer);
  printRow('Typed text deserialize', typedDe);
  printRow('Untyped text serialize', untypedSer);
  printRow('Bin serialize',          binSer);
  printRow('Bin deserialize',        binDe);
}

// ---------------------------------------------------------------------------
// Section 5: Large payload (10 000 records)
// ---------------------------------------------------------------------------
console.log('\n=== Section 5: Large payload (10 000 records) ===\n');
{
  const rows = makeUsers(10000);
  const iters     = 10;
  const typedText = encodeTyped(rows);
  const jsonText  = JSON.stringify(rows);
  const binData   = encodeBinary(rows);

  const typedSer = bench(() => encodeTyped(rows), iters);
  const typedDe  = bench(() => decode(typedText), iters);
  const jsonSer  = bench(() => JSON.stringify(rows), iters);
  const jsonDe   = bench(() => JSON.parse(jsonText), iters);
  const binSer   = bench(() => encodeBinary(rows), iters);
  const binDe    = bench(() => decodeBinary(binData, FLAT_SCHEMA_BIN), iters);

  printRow('ASON typed serialize',  typedSer, `${typedText.length} B`);
  printRow('ASON typed deserialize',typedDe);
  printRow('BIN serialize',         binSer,   `${binData.length} B`);
  printRow('BIN deserialize',       binDe);
  printRow('JSON serialize',  jsonSer, `${jsonText.length} B`);
  printRow('JSON deserialize', jsonDe);
}

// ---------------------------------------------------------------------------
// Section 6: Throughput summary (typed text)
// ---------------------------------------------------------------------------
console.log('\n=== Section 6: Throughput summary (typed text) ===\n');
{
  const n     = 1000;
  const rows  = makeUsers(n);
  const text  = encodeTyped(rows);
  const iters = 100;

  const serNs  = bench(() => encodeTyped(rows), iters);
  const deNs   = bench(() => decode(text), iters);
  const jsonSer = bench(() => JSON.stringify(rows), iters);
  const jsonDeNs = bench(() => JSON.parse(JSON.stringify(rows)), iters);

  const serRps     = Math.round(n / (serNs / 1e9));
  const deRps      = Math.round(n / (deNs / 1e9));
  const jsonSerRps = Math.round(n / (jsonSer / 1e9));
  const jsonDeRps  = Math.round(n / (jsonDeNs / 1e9));

  console.log(`  Serialize:   ${(serRps / 1e6).toFixed(2)} M records/s  (${(serRps / jsonSerRps).toFixed(2)}× vs JSON)`);
  console.log(`  Deserialize: ${(deRps / 1e6).toFixed(2)} M records/s  (${(deRps / jsonDeRps).toFixed(2)}× vs JSON)`);
}

// ---------------------------------------------------------------------------
// Section 7: Binary throughput summary
// ---------------------------------------------------------------------------
console.log('\n=== Section 7: Binary throughput summary ===\n');
{
  const n     = 1000;
  const rows  = makeUsers(n);
  const data  = encodeBinary(rows);    // schema inferred
  const iters = 100;

  const binSerNs = bench(() => encodeBinary(rows), iters);
  const binDeNs  = bench(() => decodeBinary(data, FLAT_SCHEMA_BIN), iters);

  const binSerRps = Math.round(n / (binSerNs / 1e9));
  const binDeRps  = Math.round(n / (binDeNs / 1e9));

  console.log(`  Binary serialize:   ${(binSerRps / 1e6).toFixed(2)} M records/s`);
  console.log(`  Binary deserialize: ${(binDeRps / 1e6).toFixed(2)} M records/s`);
}

console.log('\n' + '='.repeat(50));
console.log('  Benchmark Complete');
console.log('='.repeat(50) + '\n');
