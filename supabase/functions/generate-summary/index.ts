import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, geminiGenerate, HttpError, jsonResponse } from "../_shared/gemini.ts";

const SUMMARY_SYSTEM = `You are an expert academic research assistant. Given the text of a research paper, produce a clean structured Markdown summary using EXACTLY these section headings (use ## for each):

## Title
## Research Objective
## Methodology
## Dataset
## Key Contributions
## Results
## Limitations
## Future Work

Rules:
- Be concise, factual, and faithful to the source text only.
- Use bullet points where helpful.
- If a section is not covered in the paper, write "Not specified".`;

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
    if (!user) return jsonResponse({ error: "Please sign in again." }, 401);

    const body = await req.json().catch(() => ({}));
    const paperId = typeof body.paperId === "string" ? body.paperId : "";
    const force = body.force === true;
    if (!paperId) throw new HttpError("paperId is required", 400);

    console.log("generate-summary:start", { paperId, userId: user.id, force });

    // Cache check
    if (!force) {
      const { data: cached } = await supabase
        .from("summaries")
        .select("summary_text")
        .eq("paper_id", paperId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached?.summary_text) {
        console.log("generate-summary:cache-hit", { paperId });
        return jsonResponse({ summary: cached.summary_text, cached: true });
      }
    }

    const { data: paper, error: paperErr } = await supabase
      .from("papers")
      .select("id,user_id,extracted_text,status,title")
      .eq("id", paperId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (paperErr) throw paperErr;
    if (!paper) throw new HttpError("Paper not found", 404);
    const text = (paper.extracted_text ?? "").trim();
    if (!text) throw new HttpError("Paper text is not available yet. Please retry shortly.", 409);

    // Limit input ~ 10k tokens (about 40k chars)
    const trimmed = text.slice(0, 40_000);
    console.log("generate-summary:calling-gemini", { paperId, inputChars: trimmed.length });

    const summary = await geminiGenerate(
      `Summarize this research paper titled "${paper.title}":\n\n${trimmed}`,
      apiKey,
      SUMMARY_SYSTEM,
      { maxOutputTokens: 4096, temperature: 0.3 },
    );

    const { error: insErr } = await supabase.from("summaries").insert({
      paper_id: paperId,
      user_id: user.id,
      summary_text: summary,
    });
    if (insErr) console.error("generate-summary:insert-error", insErr);

    console.log("generate-summary:complete", { paperId, summaryLen: summary.length });
    return jsonResponse({ summary, cached: false });
  } catch (e) {
    console.error("generate-summary:error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg }, e instanceof HttpError ? e.status : 500);
  }
});
