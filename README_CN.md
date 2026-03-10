# ason-js

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/badge/npm-ason--js-blue)](https://www.npmjs.com/package/ason-js)

零依赖 JavaScript/TypeScript 库，用于 **ASON**（Array-Schema Object Notation）—— 一种面向 LLM 交互和大规模数据传输的 token 高效数据格式。

`ason-js` 是官方的 JS/TS 运行时包，同时适用于 JavaScript 和 TypeScript 用户。它在一个包内同时提供 ESM/CJS 构建产物和 `.d.ts` 类型声明，因此不需要再单独安装 `ason-ts`。

支持**浏览器**、**Node.js**、**Deno**、**Bun** 以及任何 JS 框架：**Vue**、**React**、**Svelte**、**SolidJS** 等。

[English Documentation](README.md)

---

## 什么是 ASON？

ASON 将**模式**与**数据**分离，消除 JSON 中重复的键名。模式只声明一次，数据行只携带值：

```text
JSON（100 tokens）：
{"users":[{"id":1,"name":"Alice","active":true},{"id":2,"name":"Bob","active":false}]}

ASON（约 35 tokens，节省 65%）：
[{id:int, name:str, active:bool}]:(1,Alice,true),(2,Bob,false)
```

| 方面 | JSON | ASON |
|------|------|------|
| Token 效率 | 100% | 30–70% ✓ |
| 键名重复 | 每个对象 | 只声明一次 ✓ |
| 可读性 | 是 | 是 ✓ |
| 类型注解 | 无 | 内置 ✓ |
| 数据体积 | 100% | **40–55%** ✓ |

---

## 安装

```bash
npm install ason-js
```

或直接将 `dist/ason.min.js` 复制到网页中使用（暴露全局 `ASON` 对象）。

TypeScript 用户不需要单独安装 stub 包。`npm run build` 会生成 `dist/index.d.ts`，并通过包的 `types` 字段对外导出。

---

## 快速开始

```ts
import { encode, encodeTyped, encodePretty, encodePrettyTyped,
         decode, encodeBinary, decodeBinary } from 'ason-js';

const users = [
  { id: 1, name: 'Alice', score: 9.5 },
  { id: 2, name: 'Bob',   score: 7.2 },
];

// schema 自动推断——不需要手动传 schema 字符串
const text        = encode(users);           // 无类型 schema（更短）
const textTyped   = encodeTyped(users);      // 有类型 schema（推荐用于 round-trip）
const pretty      = encodePretty(users);     // pretty + 无类型
const prettyTyped = encodePrettyTyped(users);// pretty + 有类型
const blob        = encodeBinary(users);     // 二进制（schema 内部推断）

console.log(decode(textTyped));              // 还原原始数组（类型完整）
console.log(decode(prettyTyped));            // 从美化文本还原
console.log(decodeBinary(blob, '[{id:int, name:str, score:float}]')); // 从二进制还原
```

> **`encode` 与 `encodeTyped` 的区别**
> `encode(obj)` 输出无类型 schema（`{id,name}`），文本更短，但 `decode` 后所有值都是字符串。
> `encodeTyped(obj)` 输出有类型 schema，适合需要保真 round-trip 的场景。
> `decodeBinary` 仍需传入 schema 字符串，因为二进制格式不嵌入类型信息。

---

## API

### 类型推断规则

| JS 值 | 推断 ASON 类型 |
|-------|--------------|
| 整数 `number` | `int` |
| 小数 `number` | `float` |
| `boolean` | `bool` |
| `string` | `str` |
| `null` / `undefined` | `str?`（可选） |

> **注意：** Schema 从数组的**第一个元素**推断。要让字段成为可选（`str?`），需要在第一个元素中将该字段设为 `null`。

### `encode(obj) → string` — 无类型 schema，自动推断

将对象或对象数组序列化为 ASON 文本，输出**无类型**（更短）的 schema。
解码时所有值都第**字符串**形式返回（因为无类型 schema 不含类型信息）：

```ts
encode({ id: 1, name: 'Alice' });
// → '{id,name}:\n(1,Alice)\n'

encode([{ id: 1 }, { id: 2 }]);
// → '[{id}]:\n(1),\n(2)\n'

decode(encode({ id: 1, name: 'Alice' }));
// → { id: '1', name: 'Alice' }  ← 无类型 schema 下所有值都是字符串
```

如需 `decode` 还原原始类型，请使用 `encodeTyped`。

### `encodeTyped(obj) → string` — 有类型 schema，自动推断

同上但输出**有类型**的 schema，decode 后能完整还原类型：

```ts
encodeTyped({ id: 1, name: 'Alice', active: true });
// → '{id:int,name:str,active:bool}:\n(1,Alice,true)\n'
```

### `encodePretty(obj) → string` — pretty + 无类型

### `encodePrettyTyped(obj) → string` — pretty + 有类型

### `decode(text) → object | object[]`

将 ASON 文本反序列化为 JS 对象或数组（schema 嵌入在文本中）：

```ts
const rec  = decode('{id:int, name:str}:\n(1,Alice)\n');
const rows = decode('[{id:int, name:str}]:\n(1,Alice),\n(2,Bob)\n');
```

### `encodeBinary(obj) → Uint8Array` — schema 内部推断

将对象序列化为二进制格式，**不需要传 schema 字符串**：

```ts
const data = encodeBinary(rows);
```

### `decodeBinary(data, schema) → object | object[]`

从二进制格式反序列化。**必须传 schema**，因为二进制 wire format 不嵌入类型信息：

```ts
const rows = decodeBinary(data, '[{id:int, name:str}]');
```

---

## 支持的类型

| Schema 类型 | JS 值 | 示例 |
|-------------|-------|------|
| `int` | number（整数） | `42`、`-100` |
| `uint` | number（非负整数） | `0`、`9007199254740991` |
| `float` | number | `3.14`、`-0.5` |
| `bool` | boolean | `true`、`false` |
| `str` | string | `Alice`、`"Carol Smith"` |
| `T?` | 值或 `null` | `hello` / `null` |

可选字段：在任何类型后加 `?`（`str?`、`int?`、`float?`、`bool?`、`uint?`）。

---

## 浏览器（CDN）用法

```html
<script src="dist/ason.min.js"></script>
<script>
  const text = ASON.encodeTyped([{id:1, name:'Alice'}]);
  console.log(ASON.decode(text));
</script>
```

## 浏览器 ESM

```html
<script type="module">
  import { encodeTyped, decode } from './dist/index.js';
  const text = encodeTyped([{id:1, name:'Alice'}]);
  console.log(decode(text));
</script>
```

## Vue / React / Svelte / SolidJS

作为普通 npm 包使用，直接导入即可：

```ts
// Vue composable 示例
import { encodeTyped, decode } from 'ason-js';

export function useAson() {
  const serialize   = (data: object[]) => encodeTyped(data);
  const deserialize = (text: string)   => decode(text);
  return { serialize, deserialize };
}

// React hook 示例
import { useMemo } from 'react';
import { encodeTyped, decode } from 'ason-js';

export function useAsonCodec() {
  return useMemo(() => ({
    encode: (data: object[]) => encodeTyped(data),
    decode: (text: string)   => decode(text),
  }), []);
}
```

---

## 二进制格式

小端字节序，与 ason-rs 和 ason-go 完全一致：

| 类型 | 字节数 |
|------|--------|
| `int` | 8（i64 LE） |
| `uint` | 8（u64 LE） |
| `float` | 8（f64 LE） |
| `bool` | 1 |
| `str` | 4 字节长度（LE）+ UTF-8 字节 |
| 可选值 | 1 字节标记（0=null，1=有值）+ 值 |
| 切片 | 4 字节元素数量（LE）+ 各元素 |

---

## 从源码构建

```bash
npm install
npm run build    # 生成 dist/index.js、dist/index.cjs、dist/index.d.ts、dist/ason.min.js
npm test         # vitest，46 个测试
```

---

## 运行示例

```bash
node examples/basic.js     # 9 个场景，基本用法
node examples/complex.js   # 20 个场景，边界条件
node examples/bench.js     # 与 JSON.parse / JSON.stringify 对比基准测试
```

---

## 性能

ASON JS 产生的输出比 JSON **小 50–55%**。由于 `JSON.parse` / `JSON.stringify` 使用 C 实现，原始解析速度会更快——但：

- **网络带宽**通常是瓶颈——50% 更小的载荷节省的传输时间远超解析开销
- **LLM token 成本**——减少 30–70% 的 token = 更低 API 成本和更快响应
- **二进制格式**——`encodeBinary` / `decodeBinary` 最适合机器间高速传输

对于延迟敏感的热路径，如果你的栈支持，建议使用 [Rust](../ason-rs/) 或 [Go](../ason-go/) 实现。

---

## 许可证

MIT

## Contributors

- [Athan](https://github.com/athxx)

## Latest Benchmarks

在当前机器上使用 Node `24.14.0` 实测（全部使用新推断驱动 API）：

- 扁平 1,000 条记录：ASON typed 文本 `58,539 B`，JSON `121,451 B`，缩小 `51.8%`
- 扁平 5,000 条记录：ASON typed 序列化 `8.93ms`，JSON `13.27ms`
- 大载荷 10,000 条记录：ASON typed 序列化 `37.86ms`，JSON `20.23ms`
- 这轮测试中 JS 版的主要优势仍然是体积和 token 节省，不是全面压过原生 JSON 的绝对速度
- 二进制路径更偏向传输和解码场景：1,000 条记录时 BIN 体积 `72,784 B`，JSON `121,451 B`
