import { describe, it, expect } from 'vitest';
import { encode, encodeTyped, encodePretty, encodePrettyTyped, decode,
         encodeBinary, decodeBinary, AsonError } from '../src/index.js';

// ---------------------------------------------------------------------------
// Design note:
//   encode(obj)      → untyped schema  {id,name,active}:...  (fields default to str on decode)
//   encodeTyped(obj) → typed schema   {id:int,name:str,...}: (correct types preserved on decode)
//
// For a true value-type round-trip, use encodeTyped + decode.
// encode + decode round-trips the string representation correctly for str fields;
// numeric/bool fields come back as strings unless the typed form is used.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1. encode / decode — schema header format
// ---------------------------------------------------------------------------

describe('encode / decode — schema header', () => {
  it('encode produces untyped schema header', () => {
    const obj = { id: 1, name: 'Alice', active: true };
    const text = encode(obj);
    expect(text).toMatch(/^\{id,name,active\}:/);
  });

  it('encodeTyped produces typed schema header', () => {
    const obj = { id: 1, name: 'Alice', active: true };
    const text = encodeTyped(obj);
    expect(text).toMatch(/^\{id:int,name:str,active:bool\}:/);
  });

  it('encodeTyped slice produces typed array header', () => {
    const rows = [{ id: 1, name: 'Alice', active: true }];
    const text = encodeTyped(rows);
    expect(text).toMatch(/^\[\{id:int,name:str,active:bool\}\]:/);
  });

  it('encode slice produces untyped array header', () => {
    const rows = [{ id: 1, name: 'Alice', active: true }];
    const text = encode(rows);
    expect(text).toMatch(/^\[\{id,name,active\}\]:/);
  });

  it('empty array encodes', () => {
    const text = encode([]);
    expect(decode(text)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. encodeTyped + decode — full value-type round-trips
// ---------------------------------------------------------------------------

describe('encodeTyped + decode — typed roundtrip', () => {
  it('roundtrips a simple struct', () => {
    const obj = { id: 1, name: 'Alice', active: true };
    expect(decode(encodeTyped(obj))).toEqual(obj);
  });

  it('roundtrips float fields', () => {
    const obj = { x: 3.14, y: -0.5 };
    expect(decode(encodeTyped(obj))).toEqual(obj);
  });

  it('roundtrips zero / negative integers', () => {
    const obj = { a: 0, b: -100, c: 2147483647 };
    expect(decode(encodeTyped(obj))).toEqual(obj);
  });

  it('roundtrips a slice of structs', () => {
    const rows = [
      { id: 1, name: 'Alice', active: true },
      { id: 2, name: 'Bob', active: false },
    ];
    expect(decode(encodeTyped(rows))).toEqual(rows);
  });

  it('roundtrips a single-element slice', () => {
    const rows = [{ x: 42, y: 7 }];
    expect(decode(encodeTyped(rows))).toEqual(rows);
  });
});

// ---------------------------------------------------------------------------
// 3. Type inference rules
// ---------------------------------------------------------------------------

describe('type inference', () => {
  it('integer number → int', () => {
    expect(encodeTyped({ n: 42 })).toContain('n:int');
  });

  it('fractional number → float', () => {
    expect(encodeTyped({ v: 3.14 })).toContain('v:float');
  });

  it('boolean → bool', () => {
    expect(encodeTyped({ f: false })).toContain('f:bool');
  });

  it('string → str', () => {
    expect(encodeTyped({ s: 'hello' })).toContain('s:str');
  });

  it('null value → str? (optional str)', () => {
    expect(encodeTyped({ tag: null })).toContain('tag:str?');
  });
});

// ---------------------------------------------------------------------------
// 4. String escaping (works with both encode and encodeTyped)
// ---------------------------------------------------------------------------

describe('string quoting', () => {
  it('quotes strings with commas', () => {
    const obj = { name: 'Smith, John' };
    expect(decode(encodeTyped(obj))).toEqual(obj);
  });

  it('quotes strings with parentheses', () => {
    const obj = { name: 'f(x)' };
    expect(decode(encodeTyped(obj))).toEqual(obj);
  });

  it('quotes empty strings', () => {
    const obj = { tag: '' };
    expect(decode(encodeTyped(obj))).toEqual(obj);
  });

  it('quotes bool-like strings', () => {
    const obj = { flag: 'true' };
    expect(decode(encodeTyped(obj))).toEqual(obj);
  });

  it('handles backslash in strings', () => {
    const obj = { path: 'C:\\Users\\Bob' };
    expect(decode(encodeTyped(obj))).toEqual(obj);
  });

  it('handles newline in strings', () => {
    const obj = { msg: 'line1\nline2' };
    expect(decode(encodeTyped(obj))).toEqual(obj);
  });

  it('unquoted plain string field is emitted without quotes', () => {
    expect(encode({ name: 'Alice' })).toContain('(Alice)');
  });
});

// ---------------------------------------------------------------------------
// 5. Float formatting
// ---------------------------------------------------------------------------

describe('float formatting', () => {
  it('integer float gets .0 suffix', () => {
    expect(encodeTyped({ v: 1.0 })).toContain('1');
  });

  it('negative float roundtrips', () => {
    expect(decode(encodeTyped({ v: -9.99 }))).toEqual({ v: -9.99 });
  });
});

// ---------------------------------------------------------------------------
// 6. encodePretty / encodePrettyTyped / decode roundtrip
// ---------------------------------------------------------------------------

describe('encodePretty / encodePrettyTyped / decode', () => {
  it('pretty untyped single struct has newline', () => {
    const obj = { id: 1, name: 'Alice', score: 9.5 };
    const pretty = encodePretty(obj);
    expect(pretty).toContain('\n');
  });

  it('pretty typed single struct roundtrips', () => {
    const obj = { id: 1, name: 'Alice', score: 9.5 };
    const pretty = encodePrettyTyped(obj);
    expect(pretty).toContain(':int');
    expect(pretty).toContain(':str');
    expect(decode(pretty)).toEqual(obj);
  });

  it('pretty typed slice roundtrips', () => {
    const rows = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    expect(decode(encodePrettyTyped(rows))).toEqual(rows);
  });
});

// ---------------------------------------------------------------------------
// 7. encodeBinary (schema-free) / decodeBinary (schema required)
// ---------------------------------------------------------------------------

describe('encodeBinary / decodeBinary', () => {
  it('roundtrips a single struct', () => {
    const obj = { id: 1, name: 'Alice', active: true };
    const schema = '{id:int, name:str, active:bool}';
    const data = encodeBinary(obj);
    expect(data).toBeInstanceOf(Uint8Array);
    expect(decodeBinary(data, schema)).toEqual(obj);
  });

  it('roundtrips a float field', () => {
    const obj = { x: 3.14 };
    const schema = '{x:float}';
    expect(decodeBinary(encodeBinary(obj), schema)).toEqual(obj);
  });

  it('roundtrips a slice', () => {
    const rows = [
      { id: 1, name: 'Alice', score: 9.5 },
      { id: 2, name: 'Bob', score: 7.2 },
    ];
    const schema = '[{id:int, name:str, score:float}]';
    expect(decodeBinary(encodeBinary(rows), schema)).toEqual(rows);
  });

  it('roundtrips empty slice binary', () => {
    const schema = '[{id:int}]';
    expect(decodeBinary(encodeBinary([]), schema)).toEqual([]);
  });

  it('rejects trailing bytes', () => {
    const obj = { x: 1 };
    const schema = '{x:int}';
    const data = encodeBinary(obj);
    const extra = new Uint8Array(data.length + 1);
    extra.set(data);
    extra[data.length] = 0xFF;
    expect(() => decodeBinary(extra, schema)).toThrow(AsonError);
  });

  it('binary and encodeTyped+decode produce same values', () => {
    const rows = [
      { id: 1, name: 'Alice', score: 9.5 },
      { id: 2, name: 'Bob', score: 7.25 },
    ];
    const schema = '[{id:int, name:str, score:float}]';
    const fromText = decode(encodeTyped(rows));
    const fromBin = decodeBinary(encodeBinary(rows), schema);
    expect(fromBin).toEqual(fromText);
  });
});

// ---------------------------------------------------------------------------
// 8. Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('throws on trailing data in single-struct decode', () => {
    const text = encodeTyped({ id: 1 }) + 'extra';
    expect(() => decode(text)).toThrow(AsonError);
  });

  it('throws on binary trailing bytes', () => {
    const data = encodeBinary({ x: 1 });
    const padded = new Uint8Array(data.length + 2);
    padded.set(data);
    expect(() => decodeBinary(padded, '{x:int}')).toThrow(AsonError);
  });

  it('throws on unknown type in decodeBinary schema', () => {
    expect(() => decodeBinary(new Uint8Array(8), '{x:bignum}')).toThrow(AsonError);
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
  it('1000-element slice encodeTyped+decode roundtrip', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      id: i, name: `User${i}`, score: i * 0.1, active: i % 2 === 0,
    }));
    const decoded = decode(encodeTyped(rows)) as typeof rows;
    expect(decoded.length).toBe(1000);
    expect(decoded[999]!.id).toBe(rows[999]!.id);
    expect(decoded[999]!.name).toBe(rows[999]!.name);
  });
});

// ---------------------------------------------------------------------------
// 11. Format validation
// ---------------------------------------------------------------------------

describe('format validation', () => {
  it('rejects {schema}: with multiple tuples', () => {
    const bad = '{id:int, name:str}:\n  (1, Alice),\n  (2, Bob)';
    expect(() => decode(bad)).toThrow(AsonError);
  });

  it('accepts [{schema}]: with multiple tuples', () => {
    const text = '[{id:int, name:str}]:\n  (1, Alice),\n  (2, Bob),\n  (3, Carol)';
    const result = decode(text) as { id: number; name: string }[];
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: 1, name: 'Alice' });
  });

  it('accepts {schema}: with exactly one tuple', () => {
    const result = decode('{id:int, name:str}:(1,Alice)') as { id: number; name: string };
    expect(result).toEqual({ id: 1, name: 'Alice' });
  });

  it('accepts [{schema}]: with single tuple', () => {
    const result = decode('[{id:int, name:str}]:(1,Alice)') as { id: number; name: string }[];
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 1, name: 'Alice' });
  });
});

// ---------------------------------------------------------------------------
// 12. Field names with special characters
// ---------------------------------------------------------------------------

describe('field names with special characters', () => {
  it('decodes field names with + and -', () => {
    const text = '{a+b:int, c-d:str}:(42,hello)';
    const out = decode(text) as Record<string, unknown>;
    expect(out['a+b']).toBe(42);
    expect(out['c-d']).toBe('hello');
  });

  it('decodes field names with underscore', () => {
    const text = '{user_name:str, is_active:bool}:(Alice,true)';
    const out = decode(text) as Record<string, unknown>;
    expect(out['user_name']).toBe('Alice');
    expect(out['is_active']).toBe(true);
  });

  it('encodeTyped + decode roundtrip with special names', () => {
    const obj = { user_name: 'Alice', is_active: true };
    expect(decode(encodeTyped(obj))).toEqual(obj);
  });
});
