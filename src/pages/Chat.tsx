import { useState } from "react";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { NotesUploader } from "@/components/upload/NotesUploader";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AnimatedOrb, ShimmerEffect } from "@/components/ui/animated-elements";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, FileText, Sparkles, Upload } from "lucide-react";
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
        variant: "destructive",
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat-ask', {
        body: { clientId: getClientId(), question: content },
      });
      if (error) throw error;

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data?.answer || "I couldn't generate an answer.",
        isUser: false,
        sources: (data?.sources || []).map((s: any) => ({
          noteId: s.noteId,
          title: s.title,
          snippet: s.snippet,
          folder: s.folder,
        })),
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      console.error('chat-ask error', err);
      toast({
        title: "Chat error",
        description: err.message || "Failed to get an answer.",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleFilesUploaded = (files: File[]) => {
    setHasUploadedNotes(true);
    toast({
      title: "Files uploaded successfully",
      description: `${files.length} file(s) are being processed and indexed.`,
    });
  };

  const handleStopStreaming = () => {
    setIsStreaming(false);
  };

  return (
    <div className="min-h-screen bg-gradient-secondary flex flex-col relative">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm shadow-soft relative z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-medium hover-scale">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Apple Notes RAG Assistant</h1>
                <p className="text-sm text-muted-foreground">
                  AI-powered search through your Apple Notes
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-accent hover-scale">
                  <Sparkles className="w-3 h-3 mr-1" />
                  GPT-5 Thinking
                </Badge>
                {hasUploadedNotes && (
                  <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 hover-scale animate-fade-in">
                    <FileText className="w-3 h-3 mr-1" />
                    Notes Indexed
                  </Badge>
                )}
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex max-w-6xl mx-auto w-full relative z-10">
        {/* Upload Panel */}
        {!hasUploadedNotes && (
          <div className="w-80 border-r bg-background/50 backdrop-blur-sm p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                <h2 className="font-semibold">Upload Notes</h2>
              </div>
              <NotesUploader onFilesUploaded={handleFilesUploaded} />
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6 relative">
              <Card className="max-w-2xl p-8 text-center shadow-medium backdrop-blur-sm bg-card/80 animate-scale-in">
                <div className="w-16 h-16 rounded-full bg-gradient-accent mx-auto mb-6 flex items-center justify-center shadow-soft hover-scale">
                  <Brain className="w-8 h-8 text-primary animate-float" />
                </div>
                <h2 className="text-2xl font-bold mb-4">
                  Welcome to your Apple Notes Assistant
                </h2>
                <p className="text-muted-foreground mb-6">
                  {hasUploadedNotes 
                    ? "Your notes have been indexed! Ask me anything about your Apple Notes and I'll search through them to provide accurate answers with source citations."
                    : "Upload your Apple Notes to get started. I'll index them and help you search through your content with AI-powered responses."}
                </p>
                
                {hasUploadedNotes && (
                  <div className="flex flex-wrap gap-2 justify-center animate-fade-in">
                    <Button 
                      variant="outline" 
                      className="hover-scale"
                      onClick={() => handleSendMessage("What are my recent project ideas?")}
                    >
                      "What are my recent project ideas?"
                    </Button>
                    <Button 
                      variant="outline"
                      className="hover-scale"
                      onClick={() => handleSendMessage("Summarize my meeting notes")}
                    >
                      "Summarize my meeting notes"
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleSendMessage("Find notes about productivity tips")}
                    >
                      "Find notes about productivity tips"
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message.content}
                  isUser={message.isUser}
                  sources={message.sources}
                  isStreaming={message.id === messages[messages.length - 1]?.id && isStreaming}
                />
              ))}
            </div>
          )}

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