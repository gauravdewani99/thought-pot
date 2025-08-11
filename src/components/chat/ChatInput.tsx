import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isStreaming?: boolean;
  onStopStreaming?: () => void;
  disabled?: boolean;
}

export const ChatInput = ({ 
  onSendMessage, 
  isStreaming, 
  onStopStreaming, 
  disabled 
}: ChatInputProps) => {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && !isStreaming) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 border-t bg-background/80 backdrop-blur-sm">
      <div className="flex gap-3 items-end max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about your Apple Notes..."
            className={cn(
              "min-h-[60px] max-h-[200px] resize-none shadow-soft",
              "focus:shadow-medium transition-shadow"
            )}
            disabled={disabled}
          />
        </div>
        
        {isStreaming ? (
          <Button
            type="button"
            onClick={onStopStreaming}
            variant="outline"
            size="icon"
            className="h-[60px] w-[60px] shadow-soft hover:shadow-medium transition-shadow"
          >
            <Square className="w-5 h-5" />
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!message.trim() || disabled}
            size="icon"
            className={cn(
              "h-[60px] w-[60px] shadow-soft hover:shadow-medium transition-all",
              "bg-gradient-primary hover:opacity-90"
            )}
          >
            <Send className="w-5 h-5" />
          </Button>
        )}
      </div>
    </form>
  );
};