import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, geminiEmbed, HttpError, jsonResponse, toVectorLiteral } from "../_shared/gemini.ts";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const SYSTEM = `You are Karwaan, an AI research assistant. Answer ONLY using the uploaded paper content provided in the context (excerpts and/or paper summary).

Rules:
- Use ONLY the provided context (chunks and summary). Do NOT use outside knowledge.
- If the answer exists in the document but was not retrieved in the chunks, infer it from the provided summary.
- If neither the chunks nor the summary contain the answer, reply EXACTLY: "This information is not found in the uploaded paper."
- Cite chunk excerpts inline like [1], [2] when used. The summary may be cited as [S].
- Use Markdown formatting (headings, bullets, tables, code) where helpful.
- Be precise, concise, and faithful to the source.`;

const STOPWORDS = new Set([
  "the","a","an","of","in","on","at","to","for","and","or","but","is","are","was","were","be","been","being",
  "this","that","these","those","it","its","as","by","with","from","about","what","which","who","whom","whose",
  "how","why","when","where","do","does","did","can","could","should","would","may","might","will","shall",
  "i","you","he","she","we","they","them","my","your","our","their","me","us","him","her","into","than","then",
  "so","such","also","not","no","yes","if","else","over","under","up","down","out","off","very","more","most",
  "some","any","all","each","every","other","another","one","two","paper","study","research","please","tell",
]);

function extractKeywords(q: string): string[] {
  return Array.from(new Set(
    q.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  )).slice(0, 8);
}

type Chunk = { chunk_id: string; chunk_text: string; similarity?: number; source: "vector" | "keyword" };

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
    if (!user) {
      return jsonResponse({ error: "Please sign in again before chatting." }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const paperId = typeof payload.paperId === "string" ? payload.paperId : "";
    const question = typeof payload.question === "string" ? payload.question.trim() : "";
    const history = Array.isArray(payload.history) ? payload.history : [];
    if (!paperId || !question) throw new HttpError("paperId and question are required", 400);
    console.log("chat-paper:start", { paperId, userId: user.id, questionLength: question.length });

    const { data: paper, error: paperErr } = await supabase
      .from("papers")
      .select("id,status")
      .eq("id", paperId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (paperErr) throw paperErr;
    if (!paper) throw new HttpError("Paper not found for this user", 404);
    if (paper.status !== "ready") throw new HttpError("This paper is still processing. Try again in a moment.", 409);

    const TOP_K = 8;
    const SIM_THRESHOLD = 0.55;

    // 1. Vector search
    const [qVec] = await geminiEmbed([question], apiKey);
    const { data: matches, error: rpcErr } = await userClient.rpc("match_paper_chunks", {
      query_embedding: toVectorLiteral(qVec),
      match_paper_id: paperId,
      match_count: TOP_K,
    });
    if (rpcErr) throw rpcErr;

    const vectorChunks: Chunk[] = (matches ?? []).map((m: { chunk_id: string; chunk_text: string; similarity: number }) => ({
      chunk_id: m.chunk_id,
      chunk_text: m.chunk_text,
      similarity: m.similarity,
      source: "vector" as const,
    }));
    const topSim = vectorChunks[0]?.similarity ?? 0;
    console.log("chat-paper:vector", { count: vectorChunks.length, topSim });

    // 2. Keyword search (hybrid)
    const keywords = extractKeywords(question);
    let keywordChunks: Chunk[] = [];
    if (keywords.length > 0) {
      const orFilter = keywords.map((k) => `chunk_text.ilike.%${k.replace(/[%,]/g, "")}%`).join(",");
      const { data: kwData } = await userClient
        .from("paper_chunks")
        .select("id, chunk_text")
        .eq("paper_id", paperId)
        .or(orFilter)
        .limit(TOP_K);
      keywordChunks = (kwData ?? []).map((r: { id: string; chunk_text: string }) => ({
        chunk_id: r.id,
        chunk_text: r.chunk_text,
        source: "keyword" as const,
      }));
    }
    console.log("chat-paper:keyword", { keywords, count: keywordChunks.length });

    // 3. Merge dedupe
    const merged: Chunk[] = [];
    const seen = new Set<string>();
    for (const c of [...vectorChunks, ...keywordChunks]) {
      if (seen.has(c.chunk_id)) continue;
      seen.add(c.chunk_id);
      merged.push(c);
      if (merged.length >= 10) break;
    }
    console.log("chat-paper:merged", {
      total: merged.length,
      preview: merged.map((c, i) => ({ i: i + 1, src: c.source, sim: c.similarity, text: c.chunk_text.slice(0, 120) })),
    });

    // 4. Fallback summary (always included if available; especially when sim is low)
    const { data: summaryRow } = await userClient
      .from("summaries")
      .select("summary_text")
      .eq("paper_id", paperId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const summary = summaryRow?.summary_text ?? "";
    const useSummary = summary.length > 0 && (topSim < SIM_THRESHOLD || merged.length < 3 || true);
    console.log("chat-paper:summary", { hasSummary: !!summary, useSummary, topSim });

    const chunksBlock = merged.length
      ? merged.map((m, i) => `[${i + 1}] (${m.source}${m.similarity ? `, sim=${m.similarity.toFixed(3)}` : ""})\n${m.chunk_text}`).join("\n\n---\n\n")
      : "(no relevant excerpts found via search)";

    const summaryBlock = useSummary
      ? `\n\n[S] PAPER SUMMARY (use as fallback context):\n${summary.slice(0, 8000)}`
      : "";

    // Save user message
    await supabase.from("chat_history").insert({
      user_id: user.id,
      paper_id: paperId,
      role: "user",
      content: question,
    });

    const historyContents = history.slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const userPrompt = `Context excerpts from the paper:\n\n${chunksBlock}${summaryBlock}\n\nUser Question: ${question}\n\nInstruction: Answer based on the provided chunks and paper summary. If the answer is in the summary but not the chunks, infer it from the summary and cite [S].`;

    const geminiBody = {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [...historyContents, { role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    const upstream = await fetch(
      `${GEMINI_BASE}/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiBody),
      },
    );

    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text();
      throw new HttpError(`Gemini chat failed (${upstream.status}): ${t.slice(0, 500)}`, 502);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buf = "";
        let full = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let nl: number;
            while ((nl = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!line.startsWith("data:")) continue;
              const json = line.slice(5).trim();
              if (!json) continue;
              try {
                const parsed = JSON.parse(json);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  full += text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
                }
              } catch {
                // ignore partial
              }
            }
          }
          if (full.trim()) {
            await supabase.from("chat_history").insert({
              user_id: user.id,
              paper_id: paperId,
              role: "assistant",
              content: full,
            });
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        } catch (e) {
          console.error("stream error", e);
          controller.error(e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("chat-paper error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg }, e instanceof HttpError ? e.status : 500);
  }
});
