import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Brain,
  FileText,
  Database,
  MessageSquare,
  Sparkles,
  Zap,
  Search,
  Cpu,
  Upload,
  ScanText,
  Network,
  MessagesSquare,
  Star,
  ArrowRight,
} from "lucide-react";

const NavBar = () => (
  <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/60">
    <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-lg tracking-tight">Karwaan</span>
      </Link>
      <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
        <a href="#features" className="hover:text-foreground transition-colors">Features</a>
        <a href="#how" className="hover:text-foreground transition-colors">How it Works</a>
        <a href="#use-cases" className="hover:text-foreground transition-colors">Use Cases</a>
        <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
      </nav>
      <div className="flex items-center gap-2">
        <Link to="/auth">
          <Button variant="outline" size="sm">Login</Button>
        </Link>
        <Link to="/auth">
          <Button size="sm" className="gradient-primary text-primary-foreground border-0">
            Get Started
          </Button>
        </Link>
      </div>
    </div>
  </header>
);

const HeroGraphic = () => (
  <div className="relative aspect-square max-w-md mx-auto">
    <div className="absolute inset-0 rounded-3xl glass-card overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.25),transparent_70%)]" />
      <div className="relative h-full w-full flex items-center justify-between px-8">
        <div className="flex flex-col items-center gap-2">
          <div className="h-14 w-14 rounded-xl glass-card flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <span className="text-[10px] text-muted-foreground">Paper</span>
        </div>
        <ArrowRight className="h-4 w-4 text-primary/60" />
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/30 blur-2xl animate-pulse" />
          <div className="relative h-24 w-24 rounded-full glass-card flex items-center justify-center glow-orange">
            <Brain className="h-10 w-10 text-primary" />
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-primary/60" />
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-xl glass-card flex items-center justify-center">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div className="h-12 w-12 rounded-xl glass-card flex items-center justify-center">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

const stats = [
  { v: "10K+", l: "Research Papers Analyzed" },
  { v: "50K+", l: "Questions Answered" },
  { v: "2K+", l: "Active Researchers" },
  { v: "99%", l: "Answer Accuracy" },
];

const features = [
  { icon: Brain, t: "AI Paper Understanding", d: "Automatically extracts key insights, methodology, and contributions." },
  { icon: MessagesSquare, t: "Chat with Research", d: "Ask questions about any paper and get instant, grounded answers." },
  { icon: Search, t: "RAG Powered", d: "Semantic search retrieves the most relevant sections from your papers." },
  { icon: Zap, t: "Powered by Gemini", d: "Built with Gemini 1.5 Flash and embedding models." },
];

const steps = [
  { icon: Upload, t: "Upload Paper", d: "Drop a PDF or paste an arXiv link." },
  { icon: ScanText, t: "Extract Text", d: "We parse and clean the full document." },
  { icon: Network, t: "Vector Embeddings", d: "Chunks are indexed for semantic search." },
  { icon: MessageSquare, t: "Ask Questions", d: "Chat with grounded, cited answers." },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <NavBar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_60%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-16 grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              Chat with Any<br />
              <span className="text-gradient">Research Paper</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              Upload a PDF or paste an arXiv link. Karwaan extracts insights,
              summarizes key ideas, and lets you chat with research papers using Gemini AI.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="gradient-primary text-primary-foreground border-0 glow-orange">
                  Upload Paper
                </Button>
              </Link>
              <Button size="lg" variant="outline">Try Demo</Button>
            </div>
            <div className="mt-8 flex items-center gap-4">
              <div className="flex -space-x-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-gradient-to-br from-primary/60 to-primary-glow/60" />
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">Loved by researchers and students</span>
              </div>
            </div>
          </div>
          <HeroGraphic />
        </div>

        {/* Stats */}
        <div className="max-w-7xl mx-auto px-6 pb-20">
          <div className="glass-card rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.l} className="text-center">
                <div className="text-3xl font-semibold text-gradient">{s.v}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-widest text-primary mb-3">Features</div>
          <h2 className="text-4xl font-semibold tracking-tight">
            Powerful Features for Research Exploration
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div key={f.t} className="glass-card rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1">
              <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{f.t}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <div className="text-xs uppercase tracking-widest text-primary mb-3">Demo</div>
          <h2 className="text-4xl font-semibold tracking-tight">See Karwaan in Action</h2>
        </div>
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-tr-sm gradient-primary text-primary-foreground px-4 py-3 text-sm">
              What problem does this paper solve?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 text-sm">
              <p className="text-foreground/90">
                The paper addresses the challenge of managing multiple functionalities
                in a unified retrieval-augmented framework, reducing latency while
                preserving answer fidelity across long documents.
              </p>
              <div className="flex gap-2 mt-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">Source: Page 2</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">Page 4</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-widest text-primary mb-3">How It Works</div>
          <h2 className="text-4xl font-semibold tracking-tight">From Paper to Conversation in Seconds</h2>
        </div>
        <div className="grid md:grid-cols-4 gap-5 relative">
          {steps.map((s, i) => (
            <div key={s.t} className="relative">
              <div className="glass-card rounded-2xl p-6 h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center">
                    <s.icon className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="font-semibold mb-1">{s.t}</h3>
                <p className="text-sm text-muted-foreground">{s.d}</p>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden md:block absolute top-1/2 -right-3 h-5 w-5 text-primary/60 -translate-y-1/2" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="relative rounded-3xl overflow-hidden glass-card p-12 text-center glow-orange">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.3),transparent_70%)]" />
          <div className="relative">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary mb-5">
              <Cpu className="h-6 w-6 text-primary-foreground" />
            </div>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
              Start Exploring Research <span className="text-gradient">Smarter</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-8">
              Join thousands of researchers using Karwaan to read, summarize, and chat with papers.
            </p>
            <Link to="/auth">
              <Button size="lg" className="gradient-primary text-primary-foreground border-0">
                Upload Your First Paper
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 mt-10">
        <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">Karwaan</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI Research Assistant — talk to any research paper.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3">Product</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground">Features</a></li>
              <li><a href="#" className="hover:text-foreground">Pricing</a></li>
              <li><a href="#" className="hover:text-foreground">Docs</a></li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3">Company</div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground">About</a></li>
              <li><a href="#" className="hover:text-foreground">Contact</a></li>
              <li><a href="#" className="hover:text-foreground">Privacy</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
          © Karwaan AI Research Assistant
        </div>
      </footer>
    </div>
  );
};

export default Landing;
