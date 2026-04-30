import { UploadCard } from "@/components/upload-card";
import { Sparkles } from "lucide-react";

const Index = () => {
  return (
    <div className="h-full overflow-y-auto scrollbar-thin">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary mb-5 shadow-lg">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-semibold tracking-tight mb-3">
            Talk to any <span className="text-gradient">research paper</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Upload a PDF or paste an arXiv link. Karwaan extracts, summarizes,
            and lets you chat with the paper using Gemini.
          </p>
        </div>

        <UploadCard />

        <div className="grid sm:grid-cols-3 gap-3 mt-10 text-sm">
          {[
            { t: "Structured summaries", d: "Problem, methods, results, limitations." },
            { t: "RAG-grounded chat", d: "Answers cite the exact paper excerpts." },
            { t: "Powered by Gemini", d: "1.5-flash + text-embedding-004." },
          ].map((f) => (
            <div key={f.t} className="p-4 rounded-xl bg-card border border-border">
              <div className="font-medium mb-1">{f.t}</div>
              <div className="text-muted-foreground text-xs leading-relaxed">{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Index;
