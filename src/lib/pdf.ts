// PDF text extraction in the browser using pdfjs-dist
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite handles the worker URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractPdfText(
  file: Blob,
  options: { maxPages?: number; maxChars?: number } = {},
): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let out = "";
  const maxPages = Math.min(pdf.numPages, options.maxPages ?? 50);
  const maxChars = options.maxChars ?? 120_000;
  for (let p = 1; p <= maxPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    out += text + "\n\n";
    if (out.length >= maxChars) break;
  }
  return out.slice(0, maxChars).replace(/\s+\n/g, "\n").trim();
}

export async function fetchPdfFromUrl(url: string): Promise<Blob> {
  const raw = url.trim();
  if (!raw) throw new Error("Please paste a valid link");

  // Normalize arxiv abs -> pdf for nicer titles client-side too
  let target = raw;
  const arxivAbs = target.match(/arxiv\.org\/abs\/([\w\.\-\/]+)/i);
  if (arxivAbs) target = `https://arxiv.org/pdf/${arxivAbs[1]}.pdf`;

  // Validate it looks like a URL (or arxiv id)
  const isArxivId = /^\d{4}\.\d{4,5}(v\d+)?$/.test(target);
  if (!isArxivId) {
    try {
      const u = new URL(target);
      if (!/^https?:$/.test(u.protocol)) throw new Error("bad protocol");
    } catch {
      throw new Error("Invalid arXiv link");
    }
  }

  // Use the backend proxy to bypass CORS
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("fetch-arxiv", {
    body: { url: target },
  });

  if (error) {
    console.error("fetch-arxiv proxy error:", error);
    throw new Error("Failed to fetch paper from URL");
  }

  // supabase.functions.invoke returns a Blob when response is binary
  if (data instanceof Blob) {
    if (data.type && !data.type.includes("pdf")) {
      // Could be JSON error wrapped as blob
      const text = await data.text();
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error) throw new Error(parsed.error);
      } catch {
        // fall through
      }
    }
    return new Blob([await data.arrayBuffer()], { type: "application/pdf" });
  }

  if (data instanceof ArrayBuffer) {
    return new Blob([data], { type: "application/pdf" });
  }

  // Unknown shape — likely an error JSON
  throw new Error((data as any)?.error || "Failed to fetch paper");
}

