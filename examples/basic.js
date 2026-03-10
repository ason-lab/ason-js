/**
 * ason-js — basic usage examples (inference-driven API)
 * Run: node examples/basic.js  (after npm run build)
 *
 * API used:
 *   encode(obj)         → untyped schema text  (shorter, decode gives strings)
 *   encodeTyped(obj)    → typed schema text    (full round-trip fidelity)
 *   encodePretty(obj)   → pretty + untyped
 *   encodePrettyTyped(obj) → pretty + typed
 *   encodeBinary(obj)   → Uint8Array (schema inferred internally)
 *   decode(text)        → object | object[]
 *   decodeBinary(data, schema) → object | object[] (schema required for binary)
 */
import {
  encode, encodeTyped, encodePretty, encodePrettyTyped,
  decode, encodeBinary, decodeBinary,
} from '../dist/index.js';

let passed = 0;
function check(label, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`  [${ok ? 'OK' : 'FAIL'}] ${label}`);
  if (!ok) { console.log('    got:     ', got); console.log('    expected:', expected); }
  if (ok) passed++;
}

console.log('\n=== ason-js basic examples ===\n');

// ---------------------------------------------------------------------------
// 1. Single struct — typed round-trip via encodeTyped
// ---------------------------------------------------------------------------
console.log('1. Single struct (typed round-trip)');
{
  const user = { id: 1, name: 'Alice', active: true };
  const text = encodeTyped(user);
  console.log('   encoded:', JSON.stringify(text));
  check('roundtrip', decode(text), user);
}

// ---------------------------------------------------------------------------
// 2. Slice of structs — typed round-trip via encodeTyped
// ---------------------------------------------------------------------------
console.log('2. Slice of structs (typed round-trip)');
{
  const users = [
    { id: 1, name: 'Alice', active: true },
    { id: 2, name: 'Bob',   active: false },
    { id: 3, name: 'Carol', active: true },
  ];
  const text = encodeTyped(users);
  console.log('   encoded:\n' + text);
  check('slice roundtrip', decode(text), users);
}

// ---------------------------------------------------------------------------
// 3. encode() — untyped schema: shorter output, types become strings on decode
// ---------------------------------------------------------------------------
console.log('3. encode() — untyped schema (shorter text)');
{
  const users = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
  const text = encode(users);
  console.log('   untyped text:\n' + text);
  // NOTE: untyped decode returns all values as strings
  const decoded = decode(text);
  check('untyped slice header', text.startsWith('[{id,name}]:'), true);
  // id comes back as string '1' without type; use encodeTyped for full fidelity
  check('str name roundtrip', decoded[0].name, 'Alice');
}

// ---------------------------------------------------------------------------
// 4. Float and negative numbers
// ---------------------------------------------------------------------------
console.log('4. Float and negative integers');
{
  const rec = { score: 9.5, delta: -0.25, count: -42 };
  check('float/neg roundtrip', decode(encodeTyped(rec)), rec);
}

// ---------------------------------------------------------------------------
// 5. Optional fields (inferred as str?)
// ---------------------------------------------------------------------------
console.log('5. Optional fields (null → inferred str?)');
{
  const a = { id: 1, tag: 'hello' };
  const b = { id: 2, tag: null   };
  // For optional fields: note that null infers to str?; encode then decode
  // b.tag will be null in both typed and untyped forms
  const ta = encodeTyped(a);
  const tb = encodeTyped(b);
  check('optional present header', ta.includes('tag:str'), true);
  check('optional null header',    tb.includes('tag:str?'), true);
  // typed round-trip for non-null:
  check('optional present value', decode(ta).tag, a.tag);
  check('optional null value',    decode(tb).tag, null);
}

// ---------------------------------------------------------------------------
// 6. String quoting (typed round-trip)
// ---------------------------------------------------------------------------
console.log('6. String quoting');
{
  for (const name of ['Alice', 'Smith, John', 'f(x)', '', 'true', '42', 'C:\\path']) {
    check(`quote: ${JSON.stringify(name)}`, decode(encodeTyped({ name })).name, name);
  }
}

// ---------------------------------------------------------------------------
// 7. encodePrettyTyped (typed + pretty, full round-trip)
// ---------------------------------------------------------------------------
console.log('7. encodePrettyTyped');
{
  const rows = [
    { id: 1, name: 'Alice', score: 9.5 },
    { id: 2, name: 'Bob',   score: 7.2 },
  ];
  const pretty = encodePrettyTyped(rows);
  console.log('   pretty:\n' + pretty);
  check('pretty typed roundtrip', decode(pretty), rows);
}

// ---------------------------------------------------------------------------
// 8. encodeBinary / decodeBinary (schema inferred for encode, required for decode)
// ---------------------------------------------------------------------------
console.log('8. Binary encode/decode');
{
  const rows = [
    { id: 1, name: 'Alice', score: 9.5,  active: true  },
    { id: 2, name: 'Bob',   score: 7.125, active: false },
  ];
  const data = encodeBinary(rows);
  console.log(`   binary size: ${data.length} bytes`);
  // schema required for decodeBinary (binary wire has no embedded types)
  const schema = '[{id:int, name:str, score:float, active:bool}]';
  check('binary roundtrip', decodeBinary(data, schema), rows);
}

// ---------------------------------------------------------------------------
// 9. Size comparison vs JSON
// ---------------------------------------------------------------------------
console.log('9. Size comparison vs JSON');
{
  const rows = Array.from({ length: 100 }, (_, i) => ({
    id: i, name: `User${i}`, score: i * 0.5, active: i % 2 === 0,
  }));
  const asonText = encode(rows);       // untyped: shortest output
  const asonTyped = encodeTyped(rows); // typed: still much shorter than JSON
  const json = JSON.stringify(rows);
  const savingUntyped = (1 - asonText.length / json.length) * 100;
  const savingTyped   = (1 - asonTyped.length / json.length) * 100;
  console.log(`   ASON untyped: ${asonText.length} B, ASON typed: ${asonTyped.length} B, JSON: ${json.length} B`);
  console.log(`   Saving untyped: ${savingUntyped.toFixed(1)}%,  typed: ${savingTyped.toFixed(1)}%`);
  check('untyped saving > 20%', savingUntyped > 20, true);
  check('typed  saving > 20%', savingTyped  > 20, true);
}

console.log(`\nResult: ${passed} passed`);
