import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalLink, FileText, User, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

export const ChatMessage = ({ message, isUser, sources, isStreaming }: ChatMessageProps) => {
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
            {message}
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse opacity-70" />
            )}
          </div>
        </Card>

        {sources && sources.length > 0 && (
          <div className="space-y-2 animate-fade-in">
            <p className="text-xs text-muted-foreground font-medium">Sources from your Notes:</p>
            <div className="flex flex-wrap gap-2">
              {sources.map((source) => (
                <Badge
                  key={source.noteId}
                  variant="secondary"
                  className="flex items-center gap-2 p-2 shadow-soft hover:shadow-medium transition-all cursor-pointer hover-scale animate-scale-in"
                  style={{ animationDelay: `${Math.random() * 0.3}s` }}
                >
                  <FileText className="w-3 h-3" />
                  <span className="font-medium">{source.title}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0 hover:bg-accent/20"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}
            </div>
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