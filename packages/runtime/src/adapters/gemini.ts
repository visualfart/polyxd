import type { Generator, Usage } from "../types.ts";
import { GeneratorError, json, post, serverEvents, trimSlash, type HttpOptions } from "./http.ts";

export interface GeminiOptions extends HttpOptions {
  /** Your API key, sent in a header, never in the URL. Leave it out only when a proxy at `baseURL` adds it. */
  apiKey?: string;
  /** The model id. There is no default. */
  model: string;
  /** Default `https://generativelanguage.googleapis.com/v1beta`. */
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
}

/** Google Gemini, through the Gemini API's `streamGenerateContent`, asking for JSON output. */
export function gemini(options: GeminiOptions): Generator {
  const base = trimSlash(options.baseURL ?? "https://generativelanguage.googleapis.com/v1beta");
  const model = options.model.replace(/^models\//, "");
  const url = `${base}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  return {
    name: "gemini",
    async generate({ system, messages, signal, onText }) {
      const headers: Record<string, string> = options.apiKey ? { "x-goog-api-key": options.apiKey } : {};
      const generationConfig: Record<string, unknown> = { responseMimeType: "application/json" };
      if (options.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;
      if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig,
      };
      const stream = await post("gemini", options, url, headers, body, signal);
      let text = "";
      let usage: Usage | undefined;
      for await (const e of serverEvents(stream)) {
        const d = json("gemini", e.data);
        if (d.error) throw new GeneratorError("gemini", `gemini stopped: ${d.error.message ?? "error"}`, d.error.code);
        for (const part of d.candidates?.[0]?.content?.parts ?? []) {
          if (part.thought || typeof part.text !== "string" || !part.text) continue;
          text += part.text;
          onText?.(part.text);
        }
        const u = d.usageMetadata;
        if (u) usage = { inputTokens: u.promptTokenCount ?? 0, outputTokens: u.candidatesTokenCount ?? 0 };
      }
      return { text, usage };
    },
  };
}
