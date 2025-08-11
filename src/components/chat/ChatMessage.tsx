import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileText, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Source {
  noteId: string;
  title: string;
  snippet: string;
  folder?: string;
}

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  sources?: Source[];
  isStreaming?: boolean;
  showSources?: boolean;
}

export const ChatMessage = ({ message, isUser, sources, isStreaming, showSources }: ChatMessageProps) => {
  const uniqueSources = sources ? Array.from(new Map(sources.map(s => [s.noteId, s])).values()) : [];
  return (
    <div className={cn("flex gap-4 p-6 animate-fade-in", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarFallback className="bg-gradient-primary text-white">
            <Bot className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={cn("max-w-[70%] space-y-3", isUser && "order-last")}>
        <Card className={cn(
          "p-4 shadow-soft hover-scale transition-all duration-200",
          isUser 
            ? "bg-chat-user text-chat-user-foreground ml-auto" 
            : "bg-chat-ai text-chat-ai-foreground"
        )}>
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                ol: ({ children, ...props }) => (
                  <ol className="list-decimal pl-5 space-y-1" {...props}>{children}</ol>
                ),
                ul: ({ children, ...props }) => (
                  <ul className="list-disc pl-5 space-y-1" {...props}>{children}</ul>
                ),
                li: ({ children, ...props }) => (
                  <li className="leading-relaxed" {...props}>{children}</li>
                ),
                p: ({ children, ...props }) => (
                  <p className="mb-2" {...props}>{children}</p>
                ),
              }}
            >
              {message}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse opacity-70" />
            )}
          </div>
        </Card>

        {showSources && uniqueSources.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Source
            </span>
            {uniqueSources.map((source) => (
              <Badge key={source.noteId} variant="secondary" className="px-2 py-0.5">
                {source.title}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarFallback className="bg-secondary">
            <User className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};