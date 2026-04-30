import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Link as LinkIcon, FileText, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { extractPdfText, fetchPdfFromUrl } from "@/lib/pdf";
import { toast } from "sonner";

const STAGES = ["Reading PDF…", "Uploading file…", "Registering paper…", "Starting fast analysis…"];

export function UploadCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [url, setUrl] = useState("");

  const processBlob = async (blob: Blob, title: string, sourceType: "pdf" | "url") => {
    if (!user) return;
    setBusy(true);
    setStage(0);
    setHint(null);
    try {
      if (blob.type && blob.type !== "application/pdf") throw new Error("Please upload a PDF file.");
      if (blob.size > 20 * 1024 * 1024) throw new Error("PDF is too large. Please upload a file under 20MB.");
      const extractedText = await extractPdfText(blob, { maxPages: 50, maxChars: 120_000 });
      if (extractedText.length < 500) {
        throw new Error("This PDF has too little readable text. It may be scanned or image-based.");
      }

      setStage(1);
      const path = `${user.id}/${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage.from("papers").upload(path, blob, {
        contentType: "application/pdf",
      });
      if (upErr) throw upErr;

      setStage(2);
      const { data: paper, error: insErr } = await supabase
        .from("papers")
        .insert({
          user_id: user.id,
          title: title.slice(0, 200),
          file_url: path,
          source_type: sourceType,
          status: "processing",
          extracted_text: extractedText.slice(0, 120_000),
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      setStage(3);

      // Fire-and-forget: kick off processing in the background.
      // The Paper page polls papers.status and shows results when ready.
      supabase.functions
        .invoke("process-paper", { body: { paperId: paper.id, extractedText } })
        .then(({ data, error }) => {
          if (error) console.error("process-paper invoke error:", error);
          else if (data?.error) console.error("process-paper returned error:", data.error);
          else console.log("process-paper finished", data);
        })
        .catch((err) => console.error("process-paper threw:", err));

      setTimeout(() => {
        setHint("Paper is being indexed in background. You can start chatting.");
        toast.success("Paper uploaded — indexing in background");
        navigate(`/paper/${paper.id}`);
      }, 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
      setBusy(false);
      setStage(0);
      setHint(null);
    }
  };

  const handleFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF");
      return;
    }
    await processBlob(file, file.name.replace(/\.pdf$/i, ""), "pdf");
  };

  const handleUrl = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const blob = await fetchPdfFromUrl(url);
      const title = url.split("/").pop()?.replace(/\.pdf$/i, "") || "Paper from URL";
      await processBlob(blob, title, "url");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to fetch URL";
      toast.error(msg);
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center animate-fade-in">
        <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin mb-4" />
        <p className="font-medium">{STAGES[stage]}</p>
        {hint && <p className="text-xs text-muted-foreground mt-2">{hint}</p>}
        <div className="mt-4 flex justify-center gap-1">
          {STAGES.map((_, i) => (
            <div
              key={i}
              className={`h-1 w-12 rounded-full transition-colors ${
                i <= stage ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer group">
          <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
          <p className="font-medium">Drop a PDF or click to upload</p>
          <p className="text-xs text-muted-foreground mt-1">Research papers up to ~50 pages work best</p>
        </div>
      </label>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste arXiv link or PDF URL"
            className="pl-9"
            onKeyDown={(e) => e.key === "Enter" && handleUrl()}
          />
        </div>
        <Button onClick={handleUrl} disabled={!url.trim()}>Fetch</Button>
      </div>
    </div>
  );
}
