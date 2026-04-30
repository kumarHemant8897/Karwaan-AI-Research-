// Proxy edge function to fetch arXiv (or any) PDFs server-side, bypassing browser CORS.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizeArxiv(input: string): string {
  let url = input.trim();
  // arxiv abs -> pdf
  const absMatch = url.match(/arxiv\.org\/abs\/([\w\.\-\/]+?)(?:v\d+)?$/i);
  if (absMatch) {
    url = `https://arxiv.org/pdf/${absMatch[1]}.pdf`;
  }
  // bare id like 1706.03762
  if (/^\d{4}\.\d{4,5}(v\d+)?$/.test(url)) {
    url = `https://arxiv.org/pdf/${url}.pdf`;
  }
  return url;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = normalizeArxiv(url);
    let parsed: URL;
    try {
      parsed = new URL(target);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      return new Response(JSON.stringify({ error: "Invalid protocol" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(target, {
      headers: { "User-Agent": "Karwaan/1.0 (+research-assistant)" },
      redirect: "follow",
    });

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream fetch failed (${upstream.status})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contentType = upstream.headers.get("content-type") || "application/pdf";
    const buf = await upstream.arrayBuffer();

    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType.includes("pdf") ? "application/pdf" : contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("fetch-arxiv error:", e);
    return new Response(JSON.stringify({ error: "Fetch failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
