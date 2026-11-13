import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Klien Claude (server saja; SPEC bagian 8). API key dibaca dari env ANTHROPIC_API_KEY,
 * tidak pernah dikirim ke browser atau dicatat di log.
 *
 * Pembagian model (keputusan pemilik 2026-11-10): model paling mampu untuk analisis visual
 * dan pemilihan font, model ringan untuk tugas sederhana. Bisa diganti lewat env var.
 */
export const MODELS = {
  main: process.env.CLAUDE_MODEL_MAIN || "claude-opus-5-5",
  light: process.env.CLAUDE_MODEL_LIGHT || "claude-haiku-5-5",
} as const;

/**
 * Harga USD per 1 juta token (input, output, cache read). Diverifikasi 2026-11-13 dari
 * referensi model Anthropic; cek ulang sebelum mengubah model. Cache write = 1,25 x input.
 */
export const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-fable-5-2": { input: 8, output: 40, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

export class ClaudeNotConfigured extends Error {}

let client: Anthropic | null = null;

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function claude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ClaudeNotConfigured("ANTHROPIC_API_KEY belum diisi. Lihat docs/claude.md.");
  }
  client ??= new Anthropic({ maxRetries: 2, timeout: 180_000 });
  return client;
}

export interface CallCost {
  label: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  usd: number;
  ms: number;
  /** True bila sebagian dijawab model cadangan (penolakan oleh model utama). */
  fellBack: boolean;
}

interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  iterations?: Array<{ type: string; model?: string | null; input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }> | null;
}

function priceOf(model: string) {
  const key = Object.keys(PRICES).find((k) => model === k || model.startsWith(`${k}-`));
  return key ? PRICES[key] : PRICES["claude-opus-5-5"];
}

function usdOf(model: string, i: number, o: number, cr: number, cw: number) {
  const p = priceOf(model);
  return (i * p.input + o * p.output + cr * p.cacheRead + cw * p.input * 1.25) / 1_000_000;
}

/** Biaya satu panggilan, per iterasi bila ada (mis. fallback ke model lain). */
export function costOf(label: string, model: string, usage: UsageLike, ms: number): CallCost {
  const its = usage.iterations?.filter((x) => x.type === "message" || x.type === "fallback_message") ?? [];
  const usd = its.length
    ? its.reduce((s, x) => s + usdOf(x.model || model, x.input_tokens, x.output_tokens, x.cache_read_input_tokens ?? 0, x.cache_creation_input_tokens ?? 0), 0)
    : usdOf(model, usage.input_tokens, usage.output_tokens, usage.cache_read_input_tokens ?? 0, usage.cache_creation_input_tokens ?? 0);
  return {
    label,
    model,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    usd,
    ms,
    fellBack: its.some((x) => x.type === "fallback_message"),
  };
}
