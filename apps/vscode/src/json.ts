/**
 * A JSON parser that keeps where everything is, so an issue's JSON Pointer becomes a range in the
 * editor and a cursor becomes a pointer. VS Code has jsonc-parser inside but doesn't hand it to
 * extensions, and this is the whole of what the extension needs from one: a tree with offsets,
 * the parsed value, and the first syntax error (the editor's own JSON mode reports the rest).
 */

export type JsonType = "object" | "array" | "string" | "number" | "boolean" | "null";

export interface JsonNode {
  type: JsonType;
  /** Start of the value in the text. */
  offset: number;
  /** Length of the value, including brackets and quotes. */
  length: number;
  /** For a member of an object: its key and where the key's string literal sits. */
  key?: string;
  keyOffset?: number;
  keyLength?: number;
  children?: JsonNode[];
  parent?: JsonNode;
  /** Scalars only. */
  value?: unknown;
}

export interface ParseResult {
  root?: JsonNode;
  value: unknown;
  /** The first syntax error, if the text isn't JSON. `root` then holds what parsed before it. */
  error?: { offset: number; message: string };
}

class Fail extends Error {
  offset: number;
  constructor(message: string, offset: number) {
    super(message);
    this.offset = offset;
  }
}

const WS = /\s/;

export function parseJson(text: string): ParseResult {
  let i = 0;
  const skip = () => {
    for (;;) {
      while (i < text.length && WS.test(text[i])) i++;
      // Comments are tolerated (jsonc), the way VS Code's JSON mode tolerates them.
      if (text.startsWith("//", i)) {
        while (i < text.length && text[i] !== "\n") i++;
      } else if (text.startsWith("/*", i)) {
        const end = text.indexOf("*/", i + 2);
        i = end < 0 ? text.length : end + 2;
      } else return;
    }
  };
  const fail = (message: string): never => {
    throw new Fail(message, i);
  };
  const string = (): string => {
    const start = i;
    i++;
    let out = "";
    while (i < text.length) {
      const c = text[i];
      if (c === '"') {
        i++;
        return out;
      }
      if (c === "\\") {
        const e = text[i + 1];
        const simple: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
        if (e === "u") {
          const hex = text.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("bad unicode escape");
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
        } else if (e in simple) {
          out += simple[e];
          i += 2;
        } else fail("bad escape");
      } else if (c === "\n") {
        i = start;
        fail("unterminated string");
      } else {
        out += c;
        i++;
      }
    }
    i = start;
    return fail("unterminated string");
  };
  const value = (parent?: JsonNode): { node: JsonNode; value: unknown } => {
    skip();
    if (i >= text.length) fail("unexpected end of text");
    const c = text[i];
    const start = i;
    if (c === "{") {
      const node: JsonNode = { type: "object", offset: start, length: 0, children: [], parent };
      const out: Record<string, unknown> = {};
      i++;
      skip();
      if (text[i] === "}") {
        i++;
        node.length = i - start;
        return { node, value: out };
      }
      for (;;) {
        skip();
        if (text[i] !== '"') fail("expected a property name in quotes");
        const keyOffset = i;
        const key = string();
        const keyLength = i - keyOffset;
        skip();
        if (text[i] !== ":") fail("expected ':'");
        i++;
        const member = value(node);
        member.node.key = key;
        member.node.keyOffset = keyOffset;
        member.node.keyLength = keyLength;
        node.children!.push(member.node);
        out[key] = member.value;
        skip();
        if (text[i] === ",") {
          i++;
          skip();
          // A trailing comma is tolerated, as jsonc.
          if (text[i] === "}") {
            i++;
            break;
          }
          continue;
        }
        if (text[i] === "}") {
          i++;
          break;
        }
        fail("expected ',' or '}'");
      }
      node.length = i - start;
      return { node, value: out };
    }
    if (c === "[") {
      const node: JsonNode = { type: "array", offset: start, length: 0, children: [], parent };
      const out: unknown[] = [];
      i++;
      skip();
      if (text[i] === "]") {
        i++;
        node.length = i - start;
        return { node, value: out };
      }
      for (;;) {
        const item = value(node);
        node.children!.push(item.node);
        out.push(item.value);
        skip();
        if (text[i] === ",") {
          i++;
          skip();
          if (text[i] === "]") {
            i++;
            break;
          }
          continue;
        }
        if (text[i] === "]") {
          i++;
          break;
        }
        fail("expected ',' or ']'");
      }
      node.length = i - start;
      return { node, value: out };
    }
    if (c === '"') {
      const s = string();
      return { node: { type: "string", offset: start, length: i - start, parent, value: s }, value: s };
    }
    const lit = /^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i, i + 40));
    if (!lit) return fail("unexpected character");
    i += lit[0].length;
    const v = lit[0] === "true" ? true : lit[0] === "false" ? false : lit[0] === "null" ? null : Number(lit[0]);
    return { node: { type: v === null ? "null" : typeof v === "boolean" ? "boolean" : "number", offset: start, length: i - start, parent, value: v }, value: v };
  };
  try {
    const { node, value: v } = value();
    skip();
    if (i < text.length) fail("unexpected text after the document");
    return { root: node, value: v };
  } catch (e) {
    if (e instanceof Fail) return { value: undefined, error: { offset: e.offset, message: e.message } };
    throw e;
  }
}

const unescapePointer = (s: string) => s.replace(/~1/g, "/").replace(/~0/g, "~");
export const escapePointer = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");

/** The node a JSON Pointer names, or the deepest ancestor that exists when it names nothing. */
export function nodeAtPointer(root: JsonNode, pointer: string): { node: JsonNode; exact: boolean } {
  if (pointer === "" || pointer === "/") return { node: root, exact: true };
  let node = root;
  const parts = pointer.replace(/^\//, "").split("/").map(unescapePointer);
  for (const part of parts) {
    const next = node.type === "object" ? node.children?.find((c) => c.key === part) : node.type === "array" ? node.children?.[Number(part)] : undefined;
    if (!next) return { node, exact: false };
    node = next;
  }
  return { node, exact: true };
}

/** The JSON Pointer of the deepest node whose text contains `offset`, and that node. */
export function nodeAtOffset(root: JsonNode, offset: number): { node: JsonNode; pointer: string } {
  let node = root;
  const path: string[] = [];
  for (;;) {
    const child = node.children?.find((c) => {
      const start = c.keyOffset ?? c.offset;
      return offset >= start && offset <= c.offset + c.length;
    });
    if (!child) break;
    path.push(child.key !== undefined ? escapePointer(child.key) : String(node.children!.indexOf(child)));
    node = child;
  }
  return { node, pointer: path.length ? "/" + path.join("/") : "" };
}

export interface Position {
  line: number;
  character: number;
}

/** Line and column (0-based, UTF-16 units like the editor) for offsets into `text`. */
export function positions(text: string): (offset: number) => Position {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo, character: offset - starts[lo] };
  };
}

export interface Range {
  start: Position;
  end: Position;
}

/**
 * Where to underline for a pointer: the value of a scalar, the key of a member holding an object
 * or array (underlining a whole component would hide the message under the wrong lines), and the
 * opening line of the document for the root.
 */
export function rangeForPointer(text: string, root: JsonNode, pointer: string): { range: Range; exact: boolean } {
  const { node, exact } = nodeAtPointer(root, pointer);
  const pos = positions(text);
  const span = (offset: number, length: number): Range => ({ start: pos(offset), end: pos(offset + length) });
  if (node === root) return { range: { start: { line: 0, character: 0 }, end: pos(Math.min(text.length, (text.indexOf("\n") + 1 || text.length + 1) - 1)) }, exact };
  if ((node.type === "object" || node.type === "array") && node.keyOffset !== undefined) return { range: span(node.keyOffset, node.keyLength!), exact };
  if (node.type === "object" || node.type === "array") {
    // An array element that is a container: its first line.
    const firstBreak = text.indexOf("\n", node.offset);
    const end = firstBreak < 0 || firstBreak > node.offset + node.length ? node.offset + node.length : firstBreak;
    return { range: span(node.offset, end - node.offset), exact };
  }
  return { range: span(node.offset, node.length), exact };
}
