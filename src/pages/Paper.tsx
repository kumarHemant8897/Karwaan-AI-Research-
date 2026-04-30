import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChatPanel } from "@/components/chat-panel";
import { InsightsPanel } from "@/components/insights-panel";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Paper = () => {
  const { paperId } = useParams();
  const [paper, setPaper] = useState<{ id: string; title: string; status: string; uploaded_at: string | null; error_message: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!paperId) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("papers")
        .select("id, title, status, uploaded_at, error_message")
        .eq("id", paperId)
        .maybeSingle();
      if (!mounted) return;
      setPaper(data);
      setLoading(false);
    };
    load();

    // Poll every 2.5s while not ready (fallback if realtime isn't enabled on the table)
    const interval = setInterval(() => {
      if (!mounted) return;
      load();
    }, 2500);

    const channel = supabase
      .channel(`paper-status-${paperId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "papers", filter: `id=eq.${paperId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [paperId]);

  if (!paperId) return <Navigate to="/app" replace />;
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }
  if (!paper) return <Navigate to="/app" replace />;
  const isProcessing = paper.status === "processing" || paper.status === "pending";
  const processingSeconds = paper.uploaded_at ? (Date.now() - new Date(paper.uploaded_at).getTime()) / 1000 : 0;

  const retryProcessing = async () => {
    if (!paperId || retrying) return;
    setRetrying(true);
    const { error } = await supabase.functions.invoke("process-paper", { body: { paperId } });
    if (error) toast.error(error.message);
    else {
      setPaper((prev) => prev ? { ...prev, status: "processing", error_message: null } : prev);
      toast.success("Analysis restarted");
    }
    setRetrying(false);
  };

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        {isProcessing ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-fade-in">
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
            <h2 className="text-xl font-semibold mb-2">Indexing paper…</h2>
            <p className="text-muted-foreground max-w-sm">
              Paper is being indexed in background. This usually takes 10–30 seconds.
              The page will refresh automatically when ready.
            </p>
            {processingSeconds > 45 && (
              <div className="mt-5 space-y-3">
                <p className="text-sm text-muted-foreground max-w-sm">
                  This is taking longer than expected. Restart analysis to recover from a stalled job.
                </p>
                <Button onClick={retryProcessing} disabled={retrying} variant="secondary" className="gap-2">
                  {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Restart analysis
                </Button>
              </div>
            )}
          </div>
        ) : paper.status === "failed" ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <p className="text-destructive font-medium mb-2">Processing failed</p>
            <p className="text-muted-foreground text-sm max-w-sm mb-4">
              {paper.error_message || "Try uploading a different PDF."}
            </p>
            <Button onClick={retryProcessing} disabled={retrying} variant="secondary" className="gap-2">
              {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Retry analysis
            </Button>
          </div>
        ) : (
          <ChatPanel paperId={paper.id} paperTitle={paper.title} />
        )}
      </div>
      <InsightsPanel paperId={paper.id} />
    </div>
  );
};

export default Paper;
