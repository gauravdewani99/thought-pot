import React, { useState } from "react";
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
  const [isProcessingNotes, setIsProcessingNotes] = useState(false);
  const { toast } = useToast();

  // Listen for notes processing completion

  React.useEffect(() => {
    const handleNotesProcessed = () => {
      setIsProcessingNotes(false);
      toast({
        title: "Notes processed successfully!",
        description: "Your Thought Pot is ready. You can now start asking questions about your notes."
      });
    };

    window.addEventListener('notes-processed-success', handleNotesProcessed);
    return () => window.removeEventListener('notes-processed-success', handleNotesProcessed);
  }, [toast]);

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
    setIsProcessingNotes(true);
    setHasUploadedNotes(true);
    toast({
      title: "Processing your notes...",
      description: `Analyzing ${files.length} file(s) and creating your Thought Pot. This may take a moment.`
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
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 relative z-10 py-6">
        {!hasUploadedNotes ? (
          <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-2xl p-8 text-center shadow-soft bg-card/80 backdrop-blur-sm animate-fade-in transition-all duration-300 hover:shadow-medium">
              <div className="w-16 h-16 rounded-xl bg-gradient-accent mx-auto mb-6 flex items-center justify-center animate-float">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Talk to your Apple Notes
              </h2>
              <div className="text-left space-y-4 mb-8 bg-muted/30 rounded-lg p-6">
                <p className="text-sm text-muted-foreground mb-4 text-center font-medium">Follow these steps to get started:</p>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3 p-3 bg-background/50 rounded-md">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">1</span>
                    </div>
                    <div>
                      <span>Download the </span>
                      <a 
                        href="https://apps.apple.com/us/app/exporter/id1099120373?mt=12" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        Exporter <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-background/50 rounded-md">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">2</span>
                    </div>
                    <span>Convert your Apple Notes to markdown files</span>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-background/50 rounded-md">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">3</span>
                    </div>
                    <span>Create Your Thought Pot</span>
                  </div>
                </div>
              </div>
              <NotesUploader onFilesUploaded={handleFilesUploaded} />
            </Card>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-[70vh]">
            {isProcessingNotes ? (
              <div className="flex-1 flex items-center justify-center">
                <Card className="w-full max-w-xl p-8 text-center shadow-soft bg-card/80 backdrop-blur-sm animate-scale-in">
                  <div className="w-16 h-16 rounded-xl bg-gradient-accent mx-auto mb-6 flex items-center justify-center animate-pulse">
                    <Brain className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-3">Creating Your Thought Pot...</h2>
                  <p className="text-sm text-muted-foreground mb-6">We're analyzing your notes and making them searchable. This usually takes 30-60 seconds.</p>
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  </div>
                </Card>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <Card className="w-full max-w-xl p-6 text-center shadow-soft bg-card/80 backdrop-blur-sm animate-scale-in">
                  <div className="w-12 h-12 rounded-lg bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">Your Thought Pot is ready!</h2>
                  <p className="text-sm text-muted-foreground">Ask any question about your notes below to start exploring your thoughts.</p>
                </Card>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
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
          </div>
        )}
        <div className="mt-auto pt-4">
          <ChatInput 
            onSendMessage={handleSendMessage} 
            isStreaming={isStreaming} 
            onStopStreaming={handleStopStreaming} 
            disabled={!hasUploadedNotes} 
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;