import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, BookOpen, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function InsightsPanel({ paperId }: { paperId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggeredRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generate = async (force = false) => {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("generate-summary", {
        body: { paperId, force },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);
      if (data?.summary) setSummary(data.summary);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to generate summary";
      setError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    triggeredRef.current = false;
    setSummary(null);
    setError(null);

    const load = async () => {
      const { data: paper } = await supabase
        .from("papers")
        .select("status")
        .eq("id", paperId)
        .single();
      if (!mounted) return;
      const nextStatus = paper?.status ?? "unknown";
      setStatus(nextStatus);

      const { data } = await supabase
        .from("summaries")
        .select("summary_text")
        .eq("paper_id", paperId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!mounted) return;
      const cached = data?.summary_text ?? null;
      if (cached) {
        setSummary(cached);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }

      // Auto-trigger generation once when paper is ready but no summary cached
      if (!cached && nextStatus === "ready" && !triggeredRef.current) {
        triggeredRef.current = true;
        generate(false);
      }
    };
    load();

    // Polling fallback (realtime is not enabled on these tables).
    // Poll every 3s until we have a summary, then stop.
    intervalRef.current = setInterval(() => {
      if (!mounted) return;
      load();
    }, 3000);

    const channel = supabase
      .channel(`paper-${paperId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "papers", filter: `id=eq.${paperId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "summaries", filter: `paper_id=eq.${paperId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  const isProcessing = status === "processing" || status === "pending";

  return (
    <aside className="w-80 h-full border-l border-border bg-sidebar/40 hidden lg:flex flex-col overflow-hidden">
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Paper Insights</h3>
        </div>
        {summary && !generating && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => generate(true)}
            title="Regenerate summary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {summary ? (
          <div className="prose-chat text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
          </div>
        ) : isProcessing ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3 text-primary" />
            Indexing paper… summary will follow.
          </div>
        ) : generating ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3 text-primary" />
            Generating structured summary…
          </div>
        ) : error ? (
          <div className="space-y-3 text-sm">
            <p className="text-destructive">{error}</p>
            <Button size="sm" variant="secondary" onClick={() => generate(true)}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>No summary yet.</p>
            <Button size="sm" variant="secondary" onClick={() => generate(true)}>
              Generate summary
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
