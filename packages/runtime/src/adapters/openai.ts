import type { GenerateRequest, Generator, GeneratorOutput, Usage } from "../types.ts";
import { GeneratorError, json, post, serverEvents, trimSlash, type HttpOptions } from "./http.ts";

export interface OpenAIOptions extends HttpOptions {
  /** Your API key. Leave it out only when a proxy at `baseURL` adds it. */
  apiKey?: string;
  /** The model id. There is no default. */
  model: string;
  /** `chat` for Chat Completions (the default), `responses` for the Responses API. */
  api?: "chat" | "responses";
  /** Default `https://api.openai.com/v1`. */
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LocalOptions extends HttpOptions {
  /** The model name the server knows, e.g. `qwen3:8b` in Ollama. */
  model: string;
  /**
   * The server's OpenAI-compatible base URL. Default `http://localhost:11434/v1` (Ollama).
   * llama.cpp's server is usually `http://localhost:8080/v1`, LM Studio's `http://localhost:1234/v1`.
   */
  baseURL?: string;
  /** Only if your server wants one. */
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

const auth = (apiKey?: string): Record<string, string> => (apiKey ? { authorization: `Bearer ${apiKey}` } : {});

/** Chat Completions, streaming: OpenAI and every server that copies its API. */
async function chat(provider: string, http: HttpOptions, url: string, headers: Record<string, string>, extra: Record<string, unknown>, { system, messages, signal, onText }: GenerateRequest): Promise<GeneratorOutput> {
  const body = { ...extra, messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))], stream: true };
  const stream = await post(provider, http, url, headers, body, signal);
  let text = "";
  let usage: Usage | undefined;
  for await (const e of serverEvents(stream)) {
    if (e.data === "[DONE]") break;
    const d = json(provider, e.data);
    if (d.error) throw new GeneratorError(provider, `${provider} stopped: ${d.error.message ?? "error"}`);
    const piece = d.choices?.[0]?.delta?.content;
    if (typeof piece === "string" && piece) {
      text += piece;
      onText?.(piece);
    }
    if (d.usage) usage = { inputTokens: d.usage.prompt_tokens ?? 0, outputTokens: d.usage.completion_tokens ?? 0 };
  }
  return { text, usage };
}

/** The Responses API, streaming. Responses aren't stored on OpenAI's side (`store: false`). */
async function responses(http: HttpOptions, url: string, headers: Record<string, string>, extra: Record<string, unknown>, { system, messages, signal, onText }: GenerateRequest): Promise<GeneratorOutput> {
  const body = { ...extra, instructions: system, input: messages.map((m) => ({ role: m.role, content: m.content })), stream: true, store: false };
  const stream = await post("openai", http, url, headers, body, signal);
  let text = "";
  let usage: Usage | undefined;
  for await (const e of serverEvents(stream)) {
    const d = json("openai", e.data);
    const type = d.type ?? e.event;
    if (type === "response.output_text.delta" && typeof d.delta === "string") {
      text += d.delta;
      onText?.(d.delta);
    } else if (type === "response.completed" || type === "response.incomplete") {
      const u = d.response?.usage;
      if (u) usage = { inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0 };
    } else if (type === "response.failed") {
      throw new GeneratorError("openai", `openai stopped: ${d.response?.error?.message ?? "the response failed"}`);
    } else if (type === "error") {
      throw new GeneratorError("openai", `openai stopped: ${d.message ?? d.error?.message ?? "error"}`);
    }
  }
  return { text, usage };
}

/** OpenAI, through Chat Completions or the Responses API, streaming. */
export function openai(options: OpenAIOptions): Generator {
  const base = trimSlash(options.baseURL ?? "https://api.openai.com/v1");
  const api = options.api ?? "chat";
  return {
    name: "openai",
    generate(request) {
      const extra: Record<string, unknown> = { model: options.model };
      if (options.temperature !== undefined) extra.temperature = options.temperature;
      if (api === "responses") {
        if (options.maxTokens !== undefined) extra.max_output_tokens = options.maxTokens;
        return responses(options, `${base}/responses`, auth(options.apiKey), extra, request);
      }
      if (options.maxTokens !== undefined) extra.max_completion_tokens = options.maxTokens;
      extra.stream_options = { include_usage: true };
      return chat("openai", options, `${base}/chat/completions`, auth(options.apiKey), extra, request);
    },
  };
}

/** A model on your own machine or server behind an OpenAI-compatible endpoint: Ollama, llama.cpp, LM Studio. */
export function local(options: LocalOptions): Generator {
  const base = trimSlash(options.baseURL ?? "http://localhost:11434/v1");
  return {
    name: "local",
    generate(request) {
      const extra: Record<string, unknown> = { model: options.model };
      if (options.temperature !== undefined) extra.temperature = options.temperature;
      if (options.maxTokens !== undefined) extra.max_tokens = options.maxTokens;
      return chat("local", options, `${base}/chat/completions`, auth(options.apiKey), extra, request);
    },
  };
}
