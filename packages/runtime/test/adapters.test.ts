import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { anthropic, createRuntime, gemini, GeneratorError, local, openai, parseDocument, type Generator } from "../src/index.ts";

/**
 * Stream bodies in each provider's documented server-sent-events format, split into small byte
 * chunks so events, lines and the two-byte "£" all straddle chunk boundaries.
 */
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const TEXT = `{"specVersion":"0.3.0","surface":{"id":"pay","title":"Pay £5"},"root":"t","components":[{"id":"t","component":"Text","text":"You're about to pay £5."}]}`;
const KEY = "test-key-not-real";

interface Call {
  url: string;
  headers: Record<string, string>;
  body: any;
  signal?: AbortSignal | null;
}

function fakeFetch(body: string, init: { status?: number; chunk?: number } = {}): typeof fetch & { calls: Call[] } {
  const calls: Call[] = [];
  const f = async (url: string | URL | Request, req?: RequestInit) => {
    calls.push({ url: String(url), headers: req?.headers as Record<string, string>, body: JSON.parse(String(req?.body)), signal: req?.signal });
    const bytes = new TextEncoder().encode(body);
    const size = init.chunk ?? 7;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += size) c.enqueue(bytes.slice(i, i + size));
        c.close();
      },
    });
    return new Response(stream, { status: init.status ?? 200, headers: { "content-type": "text/event-stream" } });
  };
  return Object.assign(f as typeof fetch, { calls });
}

const request = { system: "SYSTEM", messages: [{ role: "user" as const, content: "ASK" }, { role: "assistant" as const, content: "BEFORE" }, { role: "user" as const, content: "FIX" }] };

async function collect(g: Generator) {
  const pieces: string[] = [];
  const out = await g.generate({ ...request, onText: (t) => pieces.push(t) });
  const { text, usage } = typeof out === "string" ? { text: out, usage: undefined } : out;
  return { text, usage, pieces };
}

test("anthropic: Messages API request, streamed text and usage", async () => {
  const f = fakeFetch(fixture("anthropic.sse"));
  const { text, usage, pieces } = await collect(anthropic({ apiKey: KEY, fetch: f }));
  assert.equal(text, TEXT);
  assert.equal(pieces.length, 3);
  assert.deepEqual(usage, { inputTokens: 4812, outputTokens: 41 });
  const [call] = f.calls;
  assert.equal(call.url, "https://api.anthropic.com/v1/messages");
  assert.equal(call.headers["x-api-key"], KEY);
  assert.equal(call.headers["anthropic-version"], "2023-06-01");
  assert.equal(call.headers["content-type"], "application/json");
  assert.equal(call.headers["anthropic-dangerous-direct-browser-access"], undefined);
  assert.deepEqual(call.body, {
    model: "claude-sonnet-5",
    max_tokens: 8192,
    system: [{ type: "text", text: "SYSTEM", cache_control: { type: "ephemeral" } }],
    messages: request.messages,
    stream: true,
  });
});

test("anthropic: model, tokens, temperature, no cache, browser header, base URL", async () => {
  const f = fakeFetch(fixture("anthropic.sse"));
  await collect(anthropic({ apiKey: KEY, model: "claude-opus-5", maxTokens: 1000, temperature: 0.2, cache: false, browser: true, baseURL: "https://proxy.example/", fetch: f }));
  const [call] = f.calls;
  assert.equal(call.url, "https://proxy.example/v1/messages");
  assert.equal(call.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(call.body.model, "claude-opus-5");
  assert.equal(call.body.max_tokens, 1000);
  assert.equal(call.body.temperature, 0.2);
  assert.equal(call.body.system, "SYSTEM");
});

test("anthropic: an error event mid-stream throws", async () => {
  const body = fixture("anthropic.sse").replace(/event: content_block_stop[\s\S]*/, 'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n');
  await assert.rejects(collect(anthropic({ apiKey: KEY, fetch: fakeFetch(body) })), (e: GeneratorError) => e instanceof GeneratorError && /overloaded_error: Overloaded/.test(e.message));
});

test("openai chat: request shape, streamed text and usage from the last chunk", async () => {
  const f = fakeFetch(fixture("openai-chat.sse"));
  const { text, usage } = await collect(openai({ apiKey: KEY, model: "gpt-test", maxTokens: 4000, fetch: f }));
  assert.equal(text, TEXT);
  assert.deepEqual(usage, { inputTokens: 4812, outputTokens: 41 });
  const [call] = f.calls;
  assert.equal(call.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(call.headers.authorization, `Bearer ${KEY}`);
  assert.deepEqual(call.body, {
    model: "gpt-test",
    max_completion_tokens: 4000,
    stream_options: { include_usage: true },
    messages: [{ role: "system", content: "SYSTEM" }, ...request.messages],
    stream: true,
  });
});

test("openai responses: request shape, not stored, streamed text and usage", async () => {
  const f = fakeFetch(fixture("openai-responses.sse"));
  const { text, usage, pieces } = await collect(openai({ apiKey: KEY, model: "gpt-test", api: "responses", maxTokens: 4000, fetch: f }));
  assert.equal(text, TEXT);
  assert.equal(pieces.length, 3, "the done event doesn't repeat the text");
  assert.deepEqual(usage, { inputTokens: 4812, outputTokens: 41 });
  const [call] = f.calls;
  assert.equal(call.url, "https://api.openai.com/v1/responses");
  assert.deepEqual(call.body, { model: "gpt-test", max_output_tokens: 4000, instructions: "SYSTEM", input: request.messages, stream: true, store: false });
});

test("openai responses: a failed response throws", async () => {
  const body = 'event: response.failed\ndata: {"type":"response.failed","response":{"status":"failed","error":{"code":"server_error","message":"Something broke"}}}\n\n';
  await assert.rejects(collect(openai({ apiKey: KEY, model: "m", api: "responses", fetch: fakeFetch(body) })), /Something broke/);
});

test("gemini: key in a header not the URL, system instruction, model role, JSON output, usage", async () => {
  const f = fakeFetch(fixture("gemini.sse"));
  const { text, usage } = await collect(gemini({ apiKey: KEY, model: "models/gemini-test", maxTokens: 4000, temperature: 0, fetch: f }));
  assert.equal(text, TEXT);
  assert.deepEqual(usage, { inputTokens: 4812, outputTokens: 41 });
  const [call] = f.calls;
  assert.equal(call.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-test:streamGenerateContent?alt=sse");
  assert.ok(!call.url.includes(KEY));
  assert.equal(call.headers["x-goog-api-key"], KEY);
  assert.deepEqual(call.body, {
    systemInstruction: { parts: [{ text: "SYSTEM" }] },
    contents: [
      { role: "user", parts: [{ text: "ASK" }] },
      { role: "model", parts: [{ text: "BEFORE" }] },
      { role: "user", parts: [{ text: "FIX" }] },
    ],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4000, temperature: 0 },
  });
});

test("gemini: thought parts are left out of the text", async () => {
  const body = 'data: {"candidates":[{"content":{"parts":[{"text":"thinking…","thought":true},{"text":"{}"}],"role":"model"}}]}\n\n';
  const { text } = await collect(gemini({ apiKey: KEY, model: "m", fetch: fakeFetch(body) }));
  assert.equal(text, "{}");
});

test("local: Ollama by default, no key, a fenced answer, CRLF line endings, no usage", async () => {
  const f = fakeFetch(fixture("local-chat.sse").replace(/\n/g, "\r\n"), { chunk: 5 });
  const { text, usage } = await collect(local({ model: "qwen3:8b", maxTokens: 2000, fetch: f }));
  assert.equal(text, "```json\n" + TEXT + "\n```");
  assert.equal(parseDocument(text).document?.root, "t");
  assert.equal(usage, undefined);
  const [call] = f.calls;
  assert.equal(call.url, "http://localhost:11434/v1/chat/completions");
  assert.equal(call.headers.authorization, undefined);
  assert.deepEqual(call.body, { model: "qwen3:8b", max_tokens: 2000, messages: [{ role: "system", content: "SYSTEM" }, ...request.messages], stream: true });
});

test("local: llama.cpp or LM Studio by base URL, with a key when the server wants one", async () => {
  const f = fakeFetch(fixture("local-chat.sse"));
  await collect(local({ model: "any", baseURL: "http://localhost:1234/v1/", apiKey: "lm-studio", fetch: f }));
  assert.equal(f.calls[0].url, "http://localhost:1234/v1/chat/completions");
  assert.equal(f.calls[0].headers.authorization, "Bearer lm-studio");
});

test("an HTTP error becomes a GeneratorError with the status, and never carries the key", async () => {
  for (const g of [anthropic({ apiKey: KEY, fetch: fakeFetch('{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}', { status: 401 }) }), openai({ apiKey: KEY, model: "m", fetch: fakeFetch('{"error":{"message":"Incorrect API key provided"}}', { status: 401 }) }), gemini({ apiKey: KEY, model: "m", fetch: fakeFetch('{"error":{"code":400,"message":"API key not valid"}}', { status: 400 }) }), local({ model: "m", fetch: fakeFetch("model not found", { status: 404 }) })]) {
    await assert.rejects(collect(g), (e: GeneratorError) => {
      assert.ok(e instanceof GeneratorError);
      assert.equal(e.provider, g.name);
      assert.ok(e.status === 401 || e.status === 400 || e.status === 404);
      assert.ok(!e.message.includes(KEY));
      assert.ok(!e.message.includes("SYSTEM") && !e.message.includes("ASK"));
      return true;
    });
  }
});

test("the abort signal reaches fetch", async () => {
  const f = fakeFetch(fixture("openai-chat.sse"));
  const controller = new AbortController();
  await openai({ model: "m", fetch: f }).generate({ ...request, signal: controller.signal });
  assert.equal(f.calls[0].signal, controller.signal);
});

test("an adapter drives the whole runtime: streamed text, a parsed document, usage", async () => {
  const f = fakeFetch(fixture("anthropic.sse"));
  const texts: string[] = [];
  const result = await createRuntime({ generator: anthropic({ apiKey: KEY, fetch: f }) }).generate({ ask: "pay", intent: "pay" }, { onProgress: (p) => p.type === "text" && texts.push(p.text) });
  assert.equal(texts.join(""), TEXT);
  assert.equal(result.report.valid, true);
  assert.equal(result.document?.surface.title, "Pay £5");
  assert.deepEqual(result.usage, { inputTokens: 4812, outputTokens: 41 });
  assert.equal(f.calls[0].body.system[0].text.length > 1000, true, "the runtime's system prompt went out");
});
