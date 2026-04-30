import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, geminiGenerate, HttpError, jsonResponse } from "../_shared/gemini.ts";

const COMPARE_SYSTEM = `You are ResearchGPT, an expert academic research assistant. Compare research papers using ONLY the provided summaries and excerpts.

Output rules (STRICT):
- Reply with clean GitHub-Flavored Markdown.
- Always begin with a single comparison table. Use this EXACT structure, with one column per paper in order:

| Feature | Paper 1 | Paper 2 | ... |
| --- | --- | --- | --- |
| Objective | ... | ... |
| Methodology | ... | ... |
| Dataset | ... | ... |
| Key Contributions | ... | ... |
| Results | ... | ... |
| Limitations | ... | ... |

- Each cell must be 1–2 short sentences. If a detail is missing, write "Not specified".
- After the table, add a short "Key takeaways" section (3–5 bullets).
- Be factual, concise, and grounded in the provided text. Do not invent details.`;

type PaperRow = {
  id: string;
  title: string;
  extracted_text: string | null;
  status: string;
};

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
    if (!user) return jsonResponse({ error: "Please sign in again before comparing papers." }, 401);

    const body = await req.json().catch(() => ({}));
    const paperIds = Array.isArray(body.paperIds) ? body.paperIds.filter((id: unknown) => typeof id === "string") : [];
    const mode = body.mode === "differences" || body.mode === "gaps" ? body.mode : "compare";
    const uniqueIds = [...new Set(paperIds)].slice(0, 5);
    if (uniqueIds.length < 2) throw new HttpError("Select at least two papers to compare.", 400);
    if (paperIds.length > 5) throw new HttpError("You can compare up to five papers at a time.", 400);

    console.log("compare-papers:start", { userId: user.id, count: uniqueIds.length, mode });

    const { data: papersData, error: papersErr } = await supabase
      .from("papers")
      .select("id,title,extracted_text,status")
      .in("id", uniqueIds)
      .eq("user_id", user.id);
    if (papersErr) throw papersErr;
    const papers = (papersData ?? []) as PaperRow[];
    if (papers.length !== uniqueIds.length) throw new HttpError("One or more selected papers could not be found.", 404);
    if (papers.some((p) => p.status !== "ready")) throw new HttpError("Only fully processed papers can be compared.", 409);

    const { data: summariesData, error: summariesErr } = await supabase
      .from("summaries")
      .select("paper_id,summary_text")
      .in("paper_id", uniqueIds)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (summariesErr) throw summariesErr;

    const summaryByPaper = new Map<string, string>();
    for (const row of summariesData ?? []) {
      const r = row as { paper_id: string; summary_text: string };
      if (!summaryByPaper.has(r.paper_id)) summaryByPaper.set(r.paper_id, r.summary_text);
    }

    const paperBlocks = papers
      .map((paper, index) => {
        const summary = summaryByPaper.get(paper.id) || paper.extracted_text?.slice(0, 6000) || "No summary available.";
        return `### Paper ${index + 1}: ${paper.title}\n${summary}`;
      })
      .join("\n\n---\n\n");

    const columnHeader = papers.map((p, i) => `Paper ${i + 1} (${p.title})`).join(" | ");
    const task = mode === "differences"
      ? `Compare the papers in the required table, then add a "## Key differences" section with 3–6 bullets highlighting the most important contrasts.`
      : mode === "gaps"
        ? `Compare the papers in the required table, then add these sections:\n## Missing research areas\n## Potential improvements\n## New research directions\n\nUse 3–5 specific bullets per section.`
        : "Compare the papers in the required table, then add a short Key takeaways section.";

    const comparison = await geminiGenerate(
      `${task}\n\nUse these column headers in the table: | Feature | ${columnHeader} |\n\n${paperBlocks}`,
      apiKey,
      COMPARE_SYSTEM,
      { maxOutputTokens: 8192, temperature: 0.3 },
    );

    console.log("compare-papers:complete", { userId: user.id, count: uniqueIds.length, mode });
    return jsonResponse({ comparison, mode });
  } catch (e) {
    console.error("compare-papers error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse({ error: msg }, e instanceof HttpError ? e.status : 500);
  }
});