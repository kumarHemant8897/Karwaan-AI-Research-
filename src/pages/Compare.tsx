import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GitCompareArrows, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CompareMode = "compare" | "differences" | "gaps";
type Paper = { id: string; title: string; status: string };

const modeLabel: Record<CompareMode, string> = {
  compare: "Compare papers",
  differences: "Explain differences",
  gaps: "Find research gaps",
};

const Compare = () => {
  const [params] = useSearchParams();
  const paperIds = useMemo(
    () => (params.get("papers") ?? "").split(",").filter(Boolean).slice(0, 5),
    [params],
  );
  const [papers, setPapers] = useState<Paper[]>([]);
  const [comparison, setComparison] = useState("");
  const [mode, setMode] = useState<CompareMode>("compare");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (paperIds.length === 0) return;
    supabase
      .from("papers")
      .select("id,title,status")
      .in("id", paperIds)
      .then(({ data }) => setPapers((data ?? []) as Paper[]));
  }, [paperIds]);

  const runComparison = async (nextMode: CompareMode) => {
    if (paperIds.length < 2) {
      toast.error("Select 2–5 ready papers from the sidebar.");
      return;
    }
    setMode(nextMode);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("compare-papers", {
        body: { paperIds, mode: nextMode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setComparison(data.comparison ?? "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Comparison failed";
      toast.error(msg);
      setComparison("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setComparison("");
    if (paperIds.length >= 2) runComparison("compare");
  }, [paperIds.join(",")]);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-primary mb-3">
              <GitCompareArrows className="h-5 w-5" />
              <span className="text-sm font-medium">Paper Comparison</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{modeLabel[mode]}</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Select 2–5 processed papers in the sidebar to compare objectives, methods, datasets, contributions, limitations, and results.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => runComparison("compare")} disabled={loading || paperIds.length < 2}>
              Compare
            </Button>
            <Button variant="secondary" onClick={() => runComparison("differences")} disabled={loading || paperIds.length < 2}>
              Differences
            </Button>
            <Button onClick={() => runComparison("gaps")} disabled={loading || paperIds.length < 2}>
              <Sparkles className="h-4 w-4 mr-2" />
              Research gaps
            </Button>
          </div>
        </div>

        {papers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {papers.map((paper) => (
              <span key={paper.id} className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground border border-border">
                {paper.title}
              </span>
            ))}
          </div>
        )}

        <section className="border border-border rounded-xl bg-card overflow-hidden">
          {loading ? (
            <div className="min-h-[360px] flex flex-col items-center justify-center text-center p-8">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
              <p className="font-medium">Reading summaries and comparing papers…</p>
              <p className="text-sm text-muted-foreground mt-1">Gemini is building a grounded comparison table.</p>
            </div>
          ) : comparison ? (
            <div className="prose-chat p-5 overflow-x-auto">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{comparison}</ReactMarkdown>
            </div>
          ) : (
            <div className="min-h-[360px] flex items-center justify-center text-center p-8 text-muted-foreground">
              Select at least two ready papers in the Compare Papers section of the sidebar.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Compare;