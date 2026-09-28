import type { Generator, Usage } from "../types.ts";
import { GeneratorError, json, post, serverEvents, trimSlash, type HttpOptions } from "./http.ts";

export interface AnthropicOptions extends HttpOptions {
  /** Your API key. Leave it out only when a proxy at `baseURL` adds it. */
  apiKey?: string;
  /** Default `claude-sonnet-5`. */
  model?: string;
  /** Default 8192. */
  maxTokens?: number;
  temperature?: number;
  /** Default `https://api.anthropic.com`. */
  baseURL?: string;
  /** Mark the system prompt for prompt caching, since it's the same for every ask. Default true. */
  cache?: boolean;
  /**
   * Send the header Anthropic requires for calls straight from a browser. Only for a key the person
   * using the page owns; a key of yours in a page is a key anyone can read.
   */
  browser?: boolean;
}

/** Claude, through the Anthropic Messages API, streaming. */
export function anthropic(options: AnthropicOptions = {}): Generator {
  const model = options.model ?? "claude-sonnet-5";
  const url = `${trimSlash(options.baseURL ?? "https://api.anthropic.com")}/v1/messages`;
  return {
    name: "anthropic",
    async generate({ system, messages, signal, onText }) {
      const headers: Record<string, string> = { "anthropic-version": "2023-06-01" };
      if (options.apiKey) headers["x-api-key"] = options.apiKey;
      if (options.browser) headers["anthropic-dangerous-direct-browser-access"] = "true";
      const body: Record<string, unknown> = {
        model,
        max_tokens: options.maxTokens ?? 8192,
        system: options.cache === false ? system : [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      };
      if (options.temperature !== undefined) body.temperature = options.temperature;
      const stream = await post("anthropic", options, url, headers, body, signal);
      let text = "";
      const usage: Usage = { inputTokens: 0, outputTokens: 0 };
      for await (const e of serverEvents(stream)) {
        const d = json("anthropic", e.data);
        if (d.type === "message_start") {
          const u = d.message?.usage ?? {};
          usage.inputTokens = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
          usage.outputTokens = u.output_tokens ?? 0;
        } else if (d.type === "content_block_delta" && d.delta?.type === "text_delta") {
          text += d.delta.text;
          onText?.(d.delta.text);
        } else if (d.type === "message_delta" && d.usage?.output_tokens !== undefined) {
          usage.outputTokens = d.usage.output_tokens;
        } else if (d.type === "error") {
          throw new GeneratorError("anthropic", `anthropic stopped: ${d.error?.type ?? "error"}${d.error?.message ? `: ${d.error.message}` : ""}`);
        }
      }
      return { text, usage };
    },
  };
}
