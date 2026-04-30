import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, User as UserIcon } from "lucide-react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function MessageBubble({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className="flex gap-4 px-4 py-5 animate-fade-in">
      <div
        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
          isUser ? "bg-secondary" : "gradient-primary"
        }`}
      >
        {isUser ? (
          <UserIcon className="h-4 w-4 text-secondary-foreground" />
        ) : (
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-xs font-medium text-muted-foreground mb-1.5">
          {isUser ? "You" : "Karwaan"}
        </div>
        {message.content ? (
          <div className="prose-chat text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            {streaming && <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 align-middle animate-pulse" />}
          </div>
        ) : (
          <div className="flex items-center gap-1 h-5">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
      </div>
    </div>
  );
}
