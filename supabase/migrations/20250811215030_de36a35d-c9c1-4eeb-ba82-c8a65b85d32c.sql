-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum for note file types
CREATE TYPE note_file_type AS ENUM ('zip', 'md', 'pdf', 'rtf', 'txt');

-- Create notes table to store parsed Apple Notes
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  folder_path TEXT,
  file_type note_file_type NOT NULL,
  original_filename TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  note_created_at TIMESTAMP WITH TIME ZONE,
  note_modified_at TIMESTAMP WITH TIME ZONE,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Create chunks table for storing text chunks with embeddings
CREATE TABLE public.note_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  embedding vector(3072), -- text-embedding-3-large has 3072 dimensions
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversations table for chat history
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table for chat messages
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::JSONB, -- Array of source chunks used
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create storage bucket for note uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('notes-uploads', 'notes-uploads', false);

-- Enable RLS on all tables
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for notes
CREATE POLICY "Users can view their own notes" ON public.notes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own notes" ON public.notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notes" ON public.notes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notes" ON public.notes
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for note_chunks
CREATE POLICY "Users can view their own chunks" ON public.note_chunks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own chunks" ON public.note_chunks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chunks" ON public.note_chunks
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for conversations
CREATE POLICY "Users can view their own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversations" ON public.conversations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for chat_messages
CREATE POLICY "Users can view their own messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS policies for storage
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'notes-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'notes-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE USING (bucket_id = 'notes-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create indexes for better performance
CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_note_chunks_note_id ON public.note_chunks(note_id);
CREATE INDEX idx_note_chunks_user_id ON public.note_chunks(user_id);
CREATE INDEX idx_note_chunks_embedding ON public.note_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_user_id ON public.chat_messages(user_id);

-- Create full-text search index on note content
CREATE INDEX idx_notes_content_fts ON public.notes USING gin(to_tsvector('english', content));
CREATE INDEX idx_note_chunks_content_fts ON public.note_chunks USING gin(to_tsvector('english', content));

-- Create trigger for updating updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();