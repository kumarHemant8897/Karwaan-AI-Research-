import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText } from "https://esm.sh/unpdf@0.12.1";
import { chunkText, corsHeaders, geminiEmbed, geminiGenerate, HttpError, jsonResponse, toVectorLiteral } from "../_shared/gemini.ts";

const SUMMARY_SYSTEM = `You are an expert academic research assistant. Given the text of a research paper, produce a clean, structured Markdown summary with these sections (use ## headings):

## Title
## Authors
## Research Problem
## Methodology
## Key Contributions
## Results
## Limitations
## Future Work

Be concise, factual, and use bullet points where appropriate. Use only the provided paper text.`;

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;
type InsertedChunk = { id: string; chunk_index: number; chunk_text: string };
type PaperRow = { id: string; user_id: string; file_url: string | null; extracted_text: string | null };
type EdgeRuntimeGlobal = { EdgeRuntime?: { waitUntil: (promise: Promise<unknown>) => void } };

async function extractPdfFromStorage(supabase: SupabaseClient, path: string): Promise<string> {
  console.log("process-paper:download-pdf", { path });
  const { data, error } = await supabase.storage.from("papers").download(path);
  if (error || !data) throw new HttpError(`Could not read uploaded PDF: ${error?.message ?? "missing file"}`, 500);
  if (data.size > 20 * 1024 * 1024) throw new HttpError("PDF is too large. Please upload a file under 20MB.", 413);

  console.log("process-paper:extract-text", { bytes: data.size });
  const buffer = await data.arrayBuffer();
  const result = await extractText(new Uint8Array(buffer), { mergePages: true });
  return (result.text ?? "").replace(/\s+\n/g, "\n").trim();
}

async function failPaper(supabase: SupabaseClient, paperId: string, message: string) {
  await supabase
    .from("papers")
    .update({ status: "failed", error_message: message.slice(0, 500) })
    .eq("id", paperId);
}

async function processPaperJob(params: {
  apiKey: string;
  supabase: SupabaseClient;
  paperId: string;
  userId: string;
  paper: PaperRow;
  extractedText: string;
}) {
  const { apiKey, supabase, paperId, userId, paper } = params;
  let extractedText = params.extractedText;

  try {
    console.log("process-paper:job-start", { paperId, userId, hasClientText: extractedText.length > 0 });

    if (!extractedText) {
      if (paper.extracted_text?.trim()) extractedText = paper.extracted_text.trim();
      else if (paper.file_url) extractedText = await extractPdfFromStorage(supabase, paper.file_url);
      else throw new HttpError("No uploaded PDF file found for this paper", 400);
    }

    extractedText = extractedText.replace(/\s+/g, " ").trim();
    console.log("process-paper:text-ready", { paperId, textLength: extractedText.length });

    if (extractedText.length < 500) {
      throw new HttpError("Extracted text is too short. This PDF may be scanned or image-based.", 400);
    }

    const indexedText = extractedText.slice(0, 80_000);
    await supabase
      .from("papers")
      .update({ status: "processing", extracted_text: indexedText, error_message: null })
      .eq("id", paperId)
      .eq("user_id", userId);

    await supabase.from("paper_embeddings").delete().eq("paper_id", paperId).eq("user_id", userId);
    await supabase.from("paper_chunks").delete().eq("paper_id", paperId).eq("user_id", userId);

    const chunks = chunkText(indexedText, 800, 150).slice(0, 100);
    if (chunks.length === 0) throw new HttpError("No readable text chunks were produced", 422);
    console.log("process-paper:chunks", { paperId, chunks: chunks.length });

    const chunkRows = chunks.map((chunk, index) => ({
      paper_id: paperId,
      user_id: userId,
      chunk_index: index,
      chunk_text: chunk,
    }));

    const { data: insertedChunks, error: chunkErr } = await supabase
      .from("paper_chunks")
      .insert(chunkRows)
      .select("id, chunk_index, chunk_text");
    if (chunkErr) throw chunkErr;

    const sortedChunks = ((insertedChunks ?? []) as InsertedChunk[]).sort((a, b) => a.chunk_index - b.chunk_index);
    const allEmbRows = [];
    const BATCH = 12;
    console.log("process-paper:embedding-start", { paperId, totalChunks: sortedChunks.length, batchSize: BATCH });
    const t0 = Date.now();

    for (let start = 0; start < sortedChunks.length; start += BATCH) {
      const batch = sortedChunks.slice(start, start + BATCH);
      const vectors = await geminiEmbed(batch.map((chunk) => chunk.chunk_text.slice(0, 5000)), apiKey);
      allEmbRows.push(...batch.map((chunk, index) => ({
        paper_id: paperId,
        chunk_id: chunk.id,
        user_id: userId,
        embedding: toVectorLiteral(vectors[index]),
      })));
      console.log("process-paper:embedding-batch-done", { paperId, start, size: batch.length });
    }

    console.log("process-paper:embedding-complete", { paperId, ms: Date.now() - t0, count: allEmbRows.length });

    for (let i = 0; i < allEmbRows.length; i += 100) {
      const { error: embErr } = await supabase.from("paper_embeddings").insert(allEmbRows.slice(i, i + 100));
      if (embErr) throw embErr;
      console.log("process-paper:vector-storage", { paperId, inserted: Math.min(i + 100, allEmbRows.length), total: allEmbRows.length });
    }

    await supabase.from("papers").update({ status: "ready", error_message: null }).eq("id", paperId).eq("user_id", userId);
    console.log("process-paper:ready", { paperId, chunks: chunks.length });

    try {
      const summaryText = await geminiGenerate(
        `Summarize this research paper:\n\n${indexedText.slice(0, 18_000)}`,
        apiKey,
        SUMMARY_SYSTEM,
      );

      await supabase.from("summaries").insert({
        paper_id: paperId,
        user_id: userId,
        summary_text: summaryText,
      });
      console.log("process-paper:summary-complete", { paperId });
    } catch (summaryError) {
      console.error("process-paper:summary-error", summaryError);
    }
  } catch (error) {
    console.error("process-paper:job-error", error);
    const message = error instanceof Error ? error.message : "Unknown processing error";
    await failPaper(supabase, paperId, message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new HttpError("GEMINI_API_KEY not configured", 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return jsonResponse({ error: "Please sign in again before processing a paper." }, 401);

    const body = await req.json().catch(() => ({}));
    const paperId = typeof body.paperId === "string" ? body.paperId : "";
    const extractedText = typeof body.extractedText === "string" ? body.extractedText.trim() : "";
    if (!paperId) throw new HttpError("paperId is required", 400);

    const { data: paper, error: paperErr } = await supabase
      .from("papers")
      .select("id,user_id,file_url,extracted_text")
      .eq("id", paperId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (paperErr) throw paperErr;
    if (!paper) throw new HttpError("Paper not found for this user", 404);

    await supabase
      .from("papers")
      .update({ status: "processing", error_message: null })
      .eq("id", paperId)
      .eq("user_id", user.id);

    const job = processPaperJob({
      apiKey,
      supabase,
      paperId,
      userId: user.id,
      paper: paper as PaperRow,
      extractedText,
    });

    const waitUntil = (globalThis as unknown as EdgeRuntimeGlobal).EdgeRuntime?.waitUntil;
    if (waitUntil) waitUntil(job);
    else job.catch((error) => console.error("process-paper:detached-error", error));

    return jsonResponse({ started: true, paperId }, 202);
  } catch (error) {
    console.error("process-paper:error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, error instanceof HttpError ? error.status : 500);
  }
});
