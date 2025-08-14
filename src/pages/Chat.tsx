import { useState } from "react";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { NotesUploader } from "@/components/upload/NotesUploader";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Brain, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  sources?: Array<{
    noteId: string;
    title: string;
    snippet: string;
    folder?: string;
  }>;
  isInitialAnswer?: boolean;
  timestamp: Date;
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasUploadedNotes, setHasUploadedNotes] = useState(false);
  const { toast } = useToast();

  const getClientId = () => {
    let id = localStorage.getItem('demo_client_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('demo_client_id', id);
    }
    return id;
  };

  const handleSendMessage = async (content: string) => {
    if (!hasUploadedNotes) {
      toast({
        title: "Upload your notes first",
        description: "Please upload your Apple Notes before asking questions.",
        variant: "destructive"
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-ask', {
        body: {
          clientId: getClientId(),
          question: content
        }
      });

      if (error) throw error;

      const hadAiBefore = messages.some(m => !m.isUser);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data?.answer || "I couldn't generate an answer.",
        isUser: false,
        sources: Array.from(
          new Map(((data?.sources || []) as any[]).map((s: any) => [
            s.noteId,
            { noteId: s.noteId, title: s.title, snippet: s.snippet, folder: s.folder }
          ])).values()
        ),
        isInitialAnswer: !hadAiBefore,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      console.error('chat-ask error', err);
      toast({
        title: "Chat error",
        description: err.message || "Failed to get an answer.",
        variant: "destructive"
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleFilesUploaded = (files: File[]) => {
    setHasUploadedNotes(true);
    toast({
      title: "Files uploaded successfully",
      description: `${files.length} file(s) are being processed and indexed.`
    });
  };

  const handleStopStreaming = () => {
    setIsStreaming(false);
  };

  return (
    <div className="min-h-screen bg-gradient-secondary flex flex-col relative transition-colors duration-300">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm relative z-10 transition-colors duration-300">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-soft transition-transform duration-200 hover:scale-105">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-semibold">Thought Pot</h1>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 relative z-10">
        {!hasUploadedNotes ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <Card className="w-full p-6 text-center shadow-soft bg-card/80 backdrop-blur-sm animate-fade-in transition-all duration-300 hover:shadow-medium">
              <div className="w-12 h-12 rounded-lg bg-gradient-accent mx-auto mb-4 flex items-center justify-center animate-float">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-4">Talk to your Apple Notes</h2>
              <div className="text-left space-y-3 mb-6">
                <p className="text-sm text-muted-foreground mb-4">Follow these steps to get started:</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-primary">1.</span>
                    <div>
                      <span>Download the </span>
                      <a 
                        href="https://apps.apple.com/us/app/exporter/id1099120373?mt=12" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Exporter <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-primary">2.</span>
                    <span>Convert your Apple Notes to markdown files</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-primary">3.</span>
                    <span>Create Your Thought Pot</span>
                  </div>
                </div>
              </div>
              <NotesUploader onFilesUploaded={handleFilesUploaded} />
            </Card>
          </div>
        ) : (
          <>
            {messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <Card className="w-full p-6 text-center shadow-soft bg-card/80 backdrop-blur-sm animate-scale-in">
                  <h2 className="text-lg font-semibold mb-2">Ask about your notes</h2>
                  <p className="text-sm text-muted-foreground">Type a question below to begin.</p>
                </Card>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {messages.map(message => (
                  <ChatMessage 
                    key={message.id} 
                    message={message.content} 
                    isUser={message.isUser} 
                    sources={message.sources} 
                    isStreaming={message.id === messages[messages.length - 1]?.id && isStreaming} 
                    showSources={!!message.isInitialAnswer} 
                  />
                ))}
              </div>
            )}
          </>
        )}
        <ChatInput 
          onSendMessage={handleSendMessage} 
          isStreaming={isStreaming} 
          onStopStreaming={handleStopStreaming} 
          disabled={!hasUploadedNotes} 
        />
      </div>
    </div>
  );
};

export default Chat;