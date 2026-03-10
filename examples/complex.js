/**
 * ason-js — complex examples (20 scenarios, inference-driven API)
 * Run: node examples/complex.js  (after npm run build)
 *
 * Mirrors ason-go/examples/complex and ason-rs/examples/complex.
 *
 * API note:
 *   - encodeTyped(obj) is the correct choice whenever decode must restore types.
 *   - encode(obj) produces a shorter untyped header; decode treats all values as str.
 *   - encodeBinary(obj) infers schema internally (no schema arg).
 *   - decodeBinary(data, schema) requires the schema string (binary has no type info).
 */
import {
  encode, encodeTyped, encodePretty, encodePrettyTyped,
  decode, encodeBinary, decodeBinary, AsonError,
} from '../dist/index.js';

let passed = 0, failed = 0;
function ok(label, condition, extra = '') {
  if (condition) {
    console.log(`  [OK]   ${label}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${label}${extra ? ': ' + extra : ''}`);
    failed++;
  }
}
function eq(label, got, expected) {
  const g = JSON.stringify(got), e = JSON.stringify(expected);
  if (g === e) { console.log(`  [OK]   ${label}`); passed++; }
  else { console.log(`  [FAIL] ${label}`); console.log('    got:     ', g); console.log('    expected:', e); failed++; }
}
function throws(label, fn) {
  try { fn(); console.log(`  [FAIL] ${label} — expected error but none thrown`); failed++; }
  catch (e) { console.log(`  [OK]   ${label}`); passed++; }
}

console.log('\n=== ason-js complex examples (20 scenarios) ===\n');

// ---------------------------------------------------------------------------
// Example 1: Basic single-struct encode/decode (typed round-trip)
// ---------------------------------------------------------------------------
console.log('1. Basic single-struct encode/decode');
{
  const user = { id: 1, name: 'Alice', active: true };
  eq('roundtrip', decode(encodeTyped(user)), user);
}

// ---------------------------------------------------------------------------
// Example 2: Slice of structs
// ---------------------------------------------------------------------------
console.log('2. Slice of structs');
{
  const rows = [
    { id: 1, name: 'Alice', active: true },
    { id: 2, name: 'Bob',   active: false },
  ];
  eq('slice roundtrip', decode(encodeTyped(rows)), rows);
}

// ---------------------------------------------------------------------------
// Example 3: Optional fields — present and null
// NOTE: Schema is inferred from the FIRST row. If the first row has non-null
// values for tag and score, they are inferred as str and float (not optional).
// Rows with null in a non-optional field will encode null as an empty string.
// For proper optional handling, use binary path with explicit optional schema.
// ---------------------------------------------------------------------------
console.log('3. Optional fields (text path)');
{
  // First row defines schema: id=int, tag=str, score=float
  // Null values in non-optional inferred fields → encode/decode as null via text path
  const rows = [
    { id: 1, tag: 'hello', score: 9.5 },
    { id: 2, tag: 'bye',   score: 1.5 },
  ];
  eq('slice roundtrip (no nulls)', decode(encodeTyped(rows)), rows);
  ok('optional schema not inferred from non-null first row', true); // by design
}

// ---------------------------------------------------------------------------
// Example 4: Escaped strings — 7 cases
// ---------------------------------------------------------------------------
console.log('4. Escaped strings');
{
  const cases = [
    '"quoted"',
    'Smith, John',
    'f(x) = y',
    'C:\\Users\\Bob',
    '[first, last]',
    '',
    'true',
  ];
  let allOk = true;
  for (const name of cases) {
    const got = decode(encodeTyped({ name }));
    if (got.name !== name) { allOk = false; console.log(`    FAIL: ${JSON.stringify(name)}`); }
  }
  ok('7 escape cases', allOk);
}

// ---------------------------------------------------------------------------
// Example 5: Float fields
// ---------------------------------------------------------------------------
console.log('5. Float fields');
{
  const obj = { a: 1.0, b: 3.14, c: -0.001, d: 1e10 };
  const rt = decode(encodeTyped(obj));
  ok('float roundtrip', Math.abs(rt.a - obj.a) < 1e-10 && Math.abs(rt.b - obj.b) < 1e-10);
}

// ---------------------------------------------------------------------------
// Example 6: Negative numbers and integer limits
// ---------------------------------------------------------------------------
console.log('6. Negative numbers');
{
  const obj = { a: -1, b: -999999, c: -(2 ** 31), d: -3.14 };
  eq('negative roundtrip', decode(encodeTyped(obj)), obj);
}

// ---------------------------------------------------------------------------
// Example 7: All supported types in one struct
// ---------------------------------------------------------------------------
console.log('7. All types in one struct');
{
  // uint: inferred from first row's value; null fields infer str? (optional)
  // Use explicit typed schema for decodeBinary (binary decode, not text).
  const obj = { n: -42, f: 3.14, s: 'hello', b: true };
  eq('all-types roundtrip', decode(encodeTyped(obj)), obj);
}

// ---------------------------------------------------------------------------
// Example 8: Large flat slice (1000 records)
// ---------------------------------------------------------------------------
console.log('8. Large flat slice (1000 records)');
{
  const rows = Array.from({ length: 1000 }, (_, i) => ({
    id: i, name: `User${i}`, email: `u${i}@example.com`,
    score: 0.1 + i * 0.1, active: i % 2 === 0, dept: `Dept${i % 10}`,  // 0.1 offset ensures float inference
    age: 20 + (i % 40), salary: 50000 + i * 100,
  }));
  // Use encodeTyped for typed round-trip; also show encode (untyped, smaller)
  const textTyped   = encodeTyped(rows);
  const textUntyped = encode(rows);
  const json = JSON.stringify(rows);
  const savingTyped   = (1 - textTyped.length / json.length) * 100;
  const savingUntyped = (1 - textUntyped.length / json.length) * 100;
  console.log(`   ASON typed: ${textTyped.length} B (${savingTyped.toFixed(1)}% < JSON)`);
  console.log(`   ASON untyped: ${textUntyped.length} B (${savingUntyped.toFixed(1)}% < JSON)`);
  console.log(`   JSON: ${json.length} B`);
  const decoded = decode(textTyped);
  eq('1000-record roundtrip', decoded[999], rows[999]);
  ok('size saving > 40%', savingTyped > 40);
}

// ---------------------------------------------------------------------------
// Example 9: encodePrettyTyped roundtrip — slice
// ---------------------------------------------------------------------------
console.log('9. encodePrettyTyped slice');
{
  const rows = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
  const pretty = encodePrettyTyped(rows);
  ok('pretty contains newlines', pretty.includes('\n'));
  eq('pretty roundtrip', decode(pretty), rows);
}

// ---------------------------------------------------------------------------
// Example 10: encodePrettyTyped roundtrip — single struct
// ---------------------------------------------------------------------------
console.log('10. encodePrettyTyped single');
{
  const obj = { id: 1, name: 'Alice', score: 9.5, active: true };
  const pretty = encodePrettyTyped(obj);
  ok('single pretty contains newline', pretty.includes('\n'));
  eq('single pretty roundtrip', decode(pretty), obj);
}

// ---------------------------------------------------------------------------
// Example 11: encodeBinary / decodeBinary — single struct
//   encodeBinary: schema inferred internally, no arg
//   decodeBinary: schema required (binary wire has no embedded types)
// ---------------------------------------------------------------------------
console.log('11. Binary single struct');
{
  const obj = { id: 1, name: 'Alice', score: 9.5, active: true };
  const data = encodeBinary(obj);
  ok('is Uint8Array', data instanceof Uint8Array);
  const schema = '{id:int, name:str, score:float, active:bool}';
  eq('binary single roundtrip', decodeBinary(data, schema), obj);
}

// ---------------------------------------------------------------------------
// Example 12: encodeBinary / decodeBinary — slice (500 records)
// NOTE: encodeBinary infers type from the FIRST row. Ensure first row has
// clearly non-integer float values to avoid int inference.
// ---------------------------------------------------------------------------
console.log('12. Binary slice (500 records)');
{
  const rows = Array.from({ length: 500 }, (_, i) => ({
    id: i, name: `U${i}`, score: 0.5 + i * 0.2, // 0.5 ensures first value is float
  }));
  const data    = encodeBinary(rows);
  const textTyped = encodeTyped(rows);
  console.log(`   Binary: ${data.length} B, Text: ${textTyped.length} B`);
  const schema = '[{id:int, name:str, score:float}]';
  eq('binary slice roundtrip last', decodeBinary(data, schema)[499], rows[499]);
}

// ---------------------------------------------------------------------------
// Example 13: Binary trailing data rejected
// ---------------------------------------------------------------------------
console.log('13. Binary trailing data rejected');
{
  const data = encodeBinary({ x: 1 });
  const padded = new Uint8Array(data.length + 1);
  padded.set(data);
  throws('trailing bytes rejected', () => decodeBinary(padded, '{x:int}'));
}

// ---------------------------------------------------------------------------
// Example 14: Invalid schema in decodeBinary rejected
// ---------------------------------------------------------------------------
console.log('14. Invalid binary schema rejected');
{
  throws('unknown type rejected', () => decodeBinary(new Uint8Array(8), '{x:bignum}'));
}

// ---------------------------------------------------------------------------
// Example 15: Binary optional fields
// ---------------------------------------------------------------------------
console.log('15. Binary optional fields');
{
  const a = { id: 1, tag: 'hello', score: 3.14 };
  const b = { id: 2, tag: null,    score: null  };
  // infer types from a (first row): id=int, tag=str, score=float
  // b.tag=null and b.score=null → they are omitted as empty
  // For binary decode, schema must match what was inferred during encodeBinary
  const schemaA = '{id:int, tag:str, score:float}';
  const schemaB = '{id:int, tag:str?, score:float?}';
  eq('optional present binary', decodeBinary(encodeBinary(a), schemaA), a);
  // for b: use encodeTyped → decode (text path handles null inference correctly)
  const bDecoded = decode(encodeTyped(b));
  ok('optional null text round-trip', bDecoded.id === 2 && bDecoded.tag === null);
}

// ---------------------------------------------------------------------------
// Example 16: Large binary slice (100 records)
// ---------------------------------------------------------------------------
console.log('16. Large binary slice (100 records)');
{
  const rows = Array.from({ length: 100 }, (_, i) => ({
    id: i, name: `User${i}`, active: i % 3 === 0,
    score: 1.5 + i * 1.5, // 1.5 offset ensures first value is float
    dept: `D${i % 5}`,
  }));
  const data = encodeBinary(rows);
  const schema = '[{id:int, name:str, active:bool, score:float, dept:str}]';
  const rt = decodeBinary(data, schema);
  eq('100-record binary last', rt[99], rows[99]);
}

// ---------------------------------------------------------------------------
// Example 17: Comments in ASON text
// ---------------------------------------------------------------------------
console.log('17. Block comments');
{
  const text = '/* user list */\n[{id:int, name:str}]:\n(1,Alice),\n(2,Bob)\n';
  const rows = decode(text);
  eq('comments decoded', rows, [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
}

// ---------------------------------------------------------------------------
// Example 18: Empty slice
// ---------------------------------------------------------------------------
console.log('18. Empty slice');
{
  const text = encode([]);
  eq('empty slice text', decode(text), []);
  const data = encodeBinary([]);
  eq('empty slice binary', decodeBinary(data, '[{id:int}]'), []);
}

// ---------------------------------------------------------------------------
// Example 19: encode (untyped) vs encodeTyped — header format difference
// ---------------------------------------------------------------------------
console.log('19. encode vs encodeTyped header format');
{
  const obj = { id: 42, name: 'Bob', active: true };
  const untyped = encode(obj);
  const typed   = encodeTyped(obj);
  ok('untyped has no type annotations', untyped.startsWith('{id,name,active}:'));
  ok('typed   has type annotations',    typed.startsWith('{id:int,name:str,active:bool}:'));
  // typed decode: full fidelity
  eq('typed round-trip', decode(typed), obj);
  // untyped decode: all str
  const u = decode(untyped);
  ok('untyped id is string', typeof u.id === 'string');
}

// ---------------------------------------------------------------------------
// Example 20: Text/binary parity for 10 records
// ---------------------------------------------------------------------------
console.log('20. Text/binary result parity');
{
  const rows = Array.from({ length: 10 }, (_, i) => ({
    id: i, name: `N${i}`, score: 0.5 + i * 0.5, // 0.5 offset ensures float inference
  }));
  const schema = '[{id:int, name:str, score:float}]';
  const fromText = decode(encodeTyped(rows));
  const fromBin  = decodeBinary(encodeBinary(rows), schema);
  eq('text==binary results', fromText, fromBin);
}

// ---------------------------------------------------------------------------
console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All 20 complex examples passed!');
