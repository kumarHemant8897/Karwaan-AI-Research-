import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage, MessageBubble } from "./message-bubble";
import { toast } from "sonner";

export function ChatPanel({ paperId, paperTitle }: { paperId: string; paperTitle: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("chat_history")
        .select("role, content")
        .eq("paper_id", paperId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data.map((d) => ({ role: d.role as "user" | "assistant", content: d.content })));
    })();
  }, [paperId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const send = async () => {
    const q = input.trim();
    if (!q || streaming) return;
    setInput("");
    const newMsgs = [...messages, { role: "user" as const, content: q }, { role: "assistant" as const, content: "" }];
    setMessages(newMsgs);
    setStreaming(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-paper`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paperId,
          question: q,
          history: messages,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Chat failed" }));
        throw new Error(err.error || `Status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.delta) {
              acc += parsed.delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
      setMessages((prev) => prev.slice(0, -1)); // drop empty assistant
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto w-full">
          {messages.length === 0 && (
            <div className="text-center pt-20 pb-10 px-6 animate-fade-in">
              <h2 className="text-2xl font-semibold mb-2">{paperTitle}</h2>
              <p className="text-muted-foreground">
                Ask anything about this paper. Answers are grounded in retrieved excerpts.
              </p>
              <div className="grid sm:grid-cols-2 gap-2 mt-8 max-w-xl mx-auto text-left">
                {[
                  "What problem does this paper solve?",
                  "Summarize the methodology in 5 bullets",
                  "What are the main results?",
                  "What are the key limitations?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-sm p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-accent/30 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              message={m}
              streaming={streaming && i === messages.length - 1 && m.role === "assistant"}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-border p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative bg-card border border-border rounded-2xl shadow-sm focus-within:border-primary/50 transition-colors">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask about this paper…"
              rows={1}
              className="resize-none border-0 focus-visible:ring-0 bg-transparent pr-14 min-h-[52px] max-h-40"
            />
            <Button
              size="icon"
              onClick={send}
              disabled={!input.trim() || streaming}
              className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
            >
              {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Karwaan may make mistakes. Verify important claims against the source.
          </p>
        </div>
      </div>
    </div>
  );
}
