import { useState } from "react";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { NotesUploader } from "@/components/upload/NotesUploader";


import { Card } from "@/components/ui/card";
import { Brain } from "lucide-react";
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
  const {
    toast
  } = useToast();
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
      const {
        data,
        error
      } = await supabase.functions.invoke('chat-ask', {
        body: {
          clientId: getClientId(),
          question: content
        }
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
          folder: s.folder
        })),
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
  return <div className="min-h-screen bg-gradient-secondary flex flex-col relative">
      {/* Header */}
    <header className="border-b bg-background/80 backdrop-blur-sm relative z-10">
  <div className="max-w-3xl mx-auto px-4 py-3">
    <div className="flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-soft">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-lg font-semibold">NeuroMate</h1>
      </div>
    </div>
  </div>
    </header>

      {/* Main Content */}
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 relative z-10">
  {!hasUploadedNotes ? <div className="flex-1 flex items-center justify-center py-8">
      <Card className="w-full p-6 text-center shadow-soft bg-card/80">
        <div className="max-w-md mx-auto">
          <NotesUploader onFilesUploaded={handleFilesUploaded} />
        </div>
      </Card>
    </div> : <>
      {messages.length === 0 ? <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full p-6 text-center shadow-soft bg-card/80">
            <h2 className="text-lg font-semibold">Ask a question</h2>
          </Card>
        </div> : <div className="flex-1 overflow-y-auto">
          {messages.map(message => <ChatMessage key={message.id} message={message.content} isUser={message.isUser} sources={message.sources} isStreaming={message.id === messages[messages.length - 1]?.id && isStreaming} />)}
        </div>}
    </>}
  <ChatInput onSendMessage={handleSendMessage} isStreaming={isStreaming} onStopStreaming={handleStopStreaming} disabled={!hasUploadedNotes} />
    </div>
    </div>;
};
export default Chat;