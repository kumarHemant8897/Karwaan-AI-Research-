const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const CHAT_MODEL = "gemini-2.5-flash";
export const GEMINI_CHAT_MODEL = CHAT_MODEL;
const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 768;

export class HttpError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function toVectorLiteral(values: number[]): string {
  if (!Array.isArray(values) || values.length !== 768) {
    throw new HttpError(`Gemini returned an invalid embedding (${values?.length ?? 0} dimensions)`, 502);
  }
  return `[${values.map((v) => Number.isFinite(v) ? v : 0).join(",")}]`;
}

export async function geminiEmbed(texts: string[], apiKey: string): Promise<number[][]> {
  if (!texts.length) return [];
  const requests = texts.map((t) => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text: t }] },
    outputDimensionality: EMBEDDING_DIM,
  }));
  const res = await fetch(
    `${GEMINI_BASE}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new HttpError(`Gemini embedding failed (${res.status}): ${t.slice(0, 500)}`, 502);
  }
  const data = await res.json();
  const vectors = data.embeddings?.map((e: { values: number[] }) => e.values) ?? [];
  if (vectors.length !== texts.length) {
    throw new HttpError(`Gemini returned ${vectors.length} embeddings for ${texts.length} chunks`, 502);
  }
  return vectors;
}

export async function geminiGenerate(
  prompt: string,
  apiKey: string,
  systemInstruction?: string,
  options?: { maxOutputTokens?: number; temperature?: number },
): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.35,
      maxOutputTokens: options?.maxOutputTokens ?? 8192,
      // Disable internal "thinking" tokens so the full budget goes to the visible answer.
      // Without this, gemini-2.5-flash often consumes the whole budget thinking and emits empty/truncated text.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  const res = await fetch(
    `${GEMINI_BASE}/models/${CHAT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new HttpError(`Gemini generation failed (${res.status}): ${t.slice(0, 500)}`, 502);
  }
  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  console.log("geminiGenerate:result", {
    finishReason: candidate?.finishReason,
    textLen: text.length,
    usage: data.usageMetadata,
  });
  if (!text) {
    const reason = candidate?.finishReason ?? "NO_TEXT";
    throw new HttpError(`Gemini returned no text (${reason})`, 502);
  }
  return text;
}

export function chunkText(text: string, targetTokens = 500, overlapTokens = 60): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const targetWords = Math.max(120, Math.round(targetTokens * 0.75));
  const overlapWords = Math.min(Math.max(20, Math.round(overlapTokens * 0.75)), targetWords - 20);
  const words = cleaned.split(" ");
  const chunks: string[] = [];
  for (let start = 0; start < words.length; start += targetWords - overlapWords) {
    const slice = words.slice(start, start + targetWords).join(" ").trim();
    if (slice.length > 80) chunks.push(slice);
    if (start + targetWords >= words.length) break;
  }
  return chunks;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
