import { describe, it, expect } from 'vitest';
import { encode, decode, encodePretty, encodeBinary, decodeBinary, AsonError } from '../src/index.js';

// ---------------------------------------------------------------------------
// 1. encode / decode — basic roundtrip
// ---------------------------------------------------------------------------

describe('encode / decode — single struct', () => {
  it('roundtrips a simple struct', () => {
    const obj = { id: 1, name: 'Alice', active: true };
    const schema = '{id:int, name:str, active:bool}';
    const text = encode(obj, schema);
    expect(decode(text)).toEqual(obj);
  });

  it('encodes with correct schema header format', () => {
    const text = encode({ id: 1, name: 'Alice', active: true }, '{id:int, name:str, active:bool}');
    expect(text).toMatch(/^\{id:int, name:str, active:bool\}:/);
  });

  it('roundtrips float fields', () => {
    const obj = { x: 3.14, y: -0.5, z: 1.0 };
    expect(decode(encode(obj, '{x:float, y:float, z:float}'))).toEqual(obj);
  });

  it('round-trips zero / negative integers', () => {
    const obj = { a: 0, b: -100, c: 2147483647 };
    expect(decode(encode(obj, '{a:int, b:int, c:int}'))).toEqual(obj);
  });

  it('roundtrips uint fields', () => {
    const obj = { n: 9007199254740991 }; // Number.MAX_SAFE_INTEGER
    expect(decode(encode(obj, '{n:uint}'))).toEqual(obj);
  });
});

// ---------------------------------------------------------------------------
// 2. encode / decode — slice
// ---------------------------------------------------------------------------

describe('encode / decode — slice', () => {
  it('roundtrips a slice of structs', () => {
    const rows = [
      { id: 1, name: 'Alice', active: true },
      { id: 2, name: 'Bob', active: false },
    ];
    const schema = '[{id:int, name:str, active:bool}]';
    expect(decode(encode(rows, schema))).toEqual(rows);
  });

  it('single-element slice', () => {
    const rows = [{ x: 42, y: 7 }];
    expect(decode(encode(rows, '[{x:int, y:int}]'))).toEqual(rows);
  });

  it('empty slice encodes / decodes', () => {
    const text = encode([], '[{id:int}]');
    expect(decode(text)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Optional fields
// ---------------------------------------------------------------------------

describe('optional fields', () => {
  it('encodes null as empty field', () => {
    const obj = { id: 1, note: null };
    const schema = '{id:int, note:str?}';
    const text = encode(obj, schema);
    expect(text).toContain('(1,)');
    expect(decode(text)).toEqual({ id: 1, note: null });
  });

  it('encodes present optional value', () => {
    const obj = { id: 2, note: 'hello' };
    expect(decode(encode(obj, '{id:int, note:str?}'))).toEqual(obj);
  });

  it('optional float null and present', () => {
    const rows = [{ v: null }, { v: 3.14 }];
    expect(decode(encode(rows, '[{v:float?}]'))).toEqual(rows);
  });

  it('optional int null', () => {
    const obj = { x: null };
    expect(decode(encode(obj, '{x:int?}'))).toEqual({ x: null });
  });
});

// ---------------------------------------------------------------------------
// 4. String escaping
// ---------------------------------------------------------------------------

describe('string quoting', () => {
  it('quotes strings with commas', () => {
    const obj = { name: 'Smith, John' };
    expect(decode(encode(obj, '{name:str}'))).toEqual(obj);
  });

  it('quotes strings with parentheses', () => {
    const obj = { name: 'f(x)' };
    expect(decode(encode(obj, '{name:str}'))).toEqual(obj);
  });

  it('quotes empty strings', () => {
    const obj = { tag: '' };
    expect(decode(encode(obj, '{tag:str}'))).toEqual(obj);
  });

  it('quotes bool-like strings', () => {
    const obj = { flag: 'true' };
    expect(decode(encode(obj, '{flag:str}'))).toEqual(obj);
  });

  it('quotes numeric-looking strings', () => {
    const obj = { code: '42' };
    expect(decode(encode(obj, '{code:str}'))).toEqual(obj);
  });

  it('handles backslash in strings', () => {
    const obj = { path: 'C:\\Users\\Bob' };
    expect(decode(encode(obj, '{path:str}'))).toEqual(obj);
  });

  it('handles newline in strings', () => {
    const obj = { msg: 'line1\nline2' };
    expect(decode(encode(obj, '{msg:str}'))).toEqual(obj);
  });

  it('unquoted plain strings pass through', () => {
    const obj = { name: 'Alice' };
    const text = encode(obj, '{name:str}');
    expect(text).toContain('(Alice)');
  });
});

// ---------------------------------------------------------------------------
// 5. Float formatting
// ---------------------------------------------------------------------------

describe('float formatting', () => {
  it('integer float gets .0 suffix', () => {
    const text = encode({ v: 1.0 }, '{v:float}');
    expect(text).toContain('1.0');
  });

  it('one decimal place fast path', () => {
    const text = encode({ v: 3.5 }, '{v:float}');
    expect(text).toContain('3.5');
  });

  it('negative float roundtrips', () => {
    expect(decode(encode({ v: -9.99 }, '{v:float}'))).toEqual({ v: -9.99 });
  });
});

// ---------------------------------------------------------------------------
// 6. encodePretty / decode roundtrip
// ---------------------------------------------------------------------------

describe('encodePretty / decode', () => {
  it('pretty single struct roundtrips', () => {
    const obj = { id: 1, name: 'Alice', score: 9.5 };
    const pretty = encodePretty(obj, '{id:int, name:str, score:float}');
    expect(pretty).toContain('\n');
    expect(decode(pretty)).toEqual(obj);
  });

  it('pretty slice roundtrips', () => {
    const rows = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const pretty = encodePretty(rows, '[{id:int, name:str}]');
    expect(decode(pretty)).toEqual(rows);
  });
});

// ---------------------------------------------------------------------------
// 7. encodeBinary / decodeBinary
// ---------------------------------------------------------------------------

describe('encodeBinary / decodeBinary', () => {
  it('roundtrips a single struct', () => {
    const obj = { id: 1, name: 'Alice', active: true };
    const schema = '{id:int, name:str, active:bool}';
    const data = encodeBinary(obj, schema);
    expect(data).toBeInstanceOf(Uint8Array);
    expect(decodeBinary(data, schema)).toEqual(obj);
  });

  it('roundtrips a float field', () => {
    const obj = { x: 3.14 };
    const schema = '{x:float}';
    expect(decodeBinary(encodeBinary(obj, schema), schema)).toEqual(obj);
  });

  it('roundtrips a slice', () => {
    const rows = [
      { id: 1, name: 'Alice', score: 9.5 },
      { id: 2, name: 'Bob', score: 7.2 },
    ];
    const schema = '[{id:int, name:str, score:float}]';
    expect(decodeBinary(encodeBinary(rows, schema), schema)).toEqual(rows);
  });

  it('roundtrips optional null str', () => {
    const obj = { id: 1, tag: null };
    const schema = '{id:int, tag:str?}';
    expect(decodeBinary(encodeBinary(obj, schema), schema)).toEqual(obj);
  });

  it('roundtrips optional present str', () => {
    const obj = { id: 1, tag: 'hello' };
    const schema = '{id:int, tag:str?}';
    expect(decodeBinary(encodeBinary(obj, schema), schema)).toEqual(obj);
  });

  it('roundtrips empty slice binary', () => {
    const schema = '[{id:int}]';
    expect(decodeBinary(encodeBinary([], schema), schema)).toEqual([]);
  });

  it('rejects trailing bytes', () => {
    const obj = { x: 1 };
    const schema = '{x:int}';
    const data = encodeBinary(obj, schema);
    const extra = new Uint8Array(data.length + 1);
    extra.set(data);
    extra[data.length] = 0xFF;
    expect(() => decodeBinary(extra, schema)).toThrow(AsonError);
  });

  it('binary and text produce same values', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `User${i}`, score: i * 1.5 }));
    const schema = '[{id:int, name:str, score:float}]';
    const fromText = decode(encode(rows, schema));
    const fromBin = decodeBinary(encodeBinary(rows, schema), schema);
    expect(fromBin).toEqual(fromText);
  });
});

// ---------------------------------------------------------------------------
// 8. Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('throws on unknown type in schema', () => {
    expect(() => encode({ x: 1 }, '{x:bignum}')).toThrow(AsonError);
  });

  it('throws on malformed schema (missing {)', () => {
    expect(() => encode({ x: 1 }, 'id:int')).toThrow(AsonError);
  });

  it('throws on trailing data in single-struct decode', () => {
    const text = encode({ id: 1 }, '{id:int}') + 'extra';
    expect(() => decode(text)).toThrow(AsonError);
  });

  it('throws on binary trailing bytes', () => {
    const data = encodeBinary({ x: 1 }, '{x:int}');
    const padded = new Uint8Array(data.length + 2);
    padded.set(data);
    expect(() => decodeBinary(padded, '{x:int}')).toThrow(AsonError);
  });
});

// ---------------------------------------------------------------------------
// 9. decode — comments and multiline format
// ---------------------------------------------------------------------------

describe('decode — whitespace and comments', () => {
  it('ignores block comments in header', () => {
    const text = '/* user list */\n[{id:int, name:str}]:\n(1,Alice),\n(2,Bob)\n';
    const result = decode(text) as { id: number; name: string }[];
    expect(result).toEqual([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
  });

  it('handles multiline slice', () => {
    const text = '[{id:int, name:str}]:\n  (1, Alice),\n  (2, Bob)\n';
    expect(decode(text)).toEqual([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
  });
});

// ---------------------------------------------------------------------------
// 10. Large-scale roundtrip
// ---------------------------------------------------------------------------

describe('large-scale', () => {
  it('1000-element slice roundtrip', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      id: i, name: `User${i}`, score: i * 0.1, active: i % 2 === 0,
    }));
    const schema = '[{id:int, name:str, score:float, active:bool}]';
    const text = encode(rows, schema);
    const decoded = decode(text) as typeof rows;
    expect(decoded.length).toBe(1000);
    expect(decoded[999]).toEqual(rows[999]);
  });
});

// ---------------------------------------------------------------------------
// 11. Format validation: {schema}: vs [{schema}]:
//   - [{schema}]: (r1),(r2),(r3)  ✔ correct (array, multiple)
//   - {schema}: (r1)             ✔ correct (single struct, one tuple)
//   - [{schema}]: (r1)           ✔ correct (array, single element)
//   - {schema}: (r1),(r2),(r3)   ✘ wrong  (single struct schema, multiple tuples)
// ---------------------------------------------------------------------------

describe('format validation', () => {
  const BAD_FMT  = '{id:int, name:str}:\n  (1, Alice),\n  (2, Bob),\n  (3, Carol)';
  const GOOD_FMT = '[{id:int, name:str}]:\n  (1, Alice),\n  (2, Bob),\n  (3, Carol)';

  // Scenario 4 (incorrect): single struct schema with multiple tuples
  it('rejects {schema}: with multiple tuples decoded as array', () => {
    expect(() => decode(BAD_FMT) as unknown[]).toThrow(AsonError);
  });

  it('rejects {schema}: with two tuples for single struct decode', () => {
    const bad = '{id:int,name:str}:(10,Dave),(11,Eve)';
    expect(() => decode(bad)).toThrow(AsonError);
  });

  it('rejects {schema}: without [] wrapper for array inputs', () => {
    const bad = '{id,name}:(1,A),(2,B),(3,C),(4,D),(5,E)';
    expect(() => decode(bad)).toThrow(AsonError);
  });

  // Scenario 1 (correct): array schema with multiple tuples
  it('accepts [{schema}]: with multiple tuples', () => {
    const result = decode(GOOD_FMT) as { id: number; name: string }[];
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: 1, name: 'Alice' });
    expect(result[2]).toEqual({ id: 3, name: 'Carol' });
  });

  // Scenario 2 (correct): single struct schema with one tuple
  it('accepts {schema}: with exactly one tuple', () => {
    const result = decode('{id:int, name:str}:(1,Alice)') as { id: number; name: string };
    expect(result).toEqual({ id: 1, name: 'Alice' });
  });

  // Scenario 3 (correct): array schema with single element
  it('accepts [{schema}]: with single tuple', () => {
    const result = decode('[{id:int, name:str}]:(1,Alice)') as { id: number; name: string }[];
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 1, name: 'Alice' });
  });

  // Roundtrip encode -> decode consistency
  it('encode/decode roundtrip for single struct matches scenario 2', () => {
    const obj = { id: 42, name: 'Bob' };
    const text = encode(obj, '{id:int, name:str}');
    expect(text).toMatch(/^\{id:int, name:str\}:/);
    expect(decode(text)).toEqual(obj);
  });

  it('encode/decode roundtrip for single-element array matches scenario 3', () => {
    const rows = [{ id: 7, name: 'Carol' }];
    const text = encode(rows, '[{id:int, name:str}]');
    expect(text).toMatch(/^\[\{id:int, name:str\}\]:/);
    const decoded = decode(text) as typeof rows;
    expect(decoded).toEqual(rows);
  });
});
