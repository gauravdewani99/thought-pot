-- Enable pgvector for embeddings
create extension if not exists vector;

-- 1) Notes metadata table
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text,
  file_name text not null,
  mime_type text,
  size_bytes integer,
  file_path text, -- path inside storage bucket
  status text not null default 'uploaded',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

-- RLS: users can CRUD only their own notes
create policy "Users can view their own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = user_id);

create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Trigger to maintain updated_at
drop trigger if exists trg_notes_updated_at on public.notes;
create trigger trg_notes_updated_at
before update on public.notes
for each row execute function public.update_updated_at_column();

-- 2) Note chunks with embeddings
create table if not exists public.note_chunks (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null,
  chunk_index integer not null default 0,
  content text not null,
  embedding vector(1536),
  token_count integer,
  tsv tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now()
);

alter table public.note_chunks enable row level security;

create policy "Users can view their own note_chunks"
  on public.note_chunks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own note_chunks"
  on public.note_chunks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own note_chunks"
  on public.note_chunks for update
  using (auth.uid() = user_id);

create policy "Users can delete their own note_chunks"
  on public.note_chunks for delete
  using (auth.uid() = user_id);

-- Indexes for chunks
create index if not exists idx_note_chunks_note_id on public.note_chunks(note_id);
create index if not exists idx_note_chunks_user_id on public.note_chunks(user_id);
create index if not exists idx_note_chunks_created_at on public.note_chunks(created_at);
create index if not exists idx_note_chunks_tsv on public.note_chunks using gin (tsv);
-- Vector similarity (approximate) index
create index if not exists idx_note_chunks_embedding on public.note_chunks using ivfflat (embedding vector_l2_ops) with (lists = 100);

-- 3) Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy "Users can view their own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own conversations"
  on public.conversations for update
  using (auth.uid() = user_id);

create policy "Users can delete their own conversations"
  on public.conversations for delete
  using (auth.uid() = user_id);

-- updated_at trigger
drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at
before update on public.conversations
for each row execute function public.update_updated_at_column();

create index if not exists idx_conversations_user_id on public.conversations(user_id);
create index if not exists idx_conversations_created_at on public.conversations(created_at);

-- 4) Chat messages
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null,
  role text not null, -- 'user' | 'assistant' | 'system'
  content text not null,
  sources jsonb, -- optional citations array
  token_count integer,
  error text,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "Users can view their own chat_messages"
  on public.chat_messages for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chat_messages"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own chat_messages"
  on public.chat_messages for update
  using (auth.uid() = user_id);

create policy "Users can delete their own chat_messages"
  on public.chat_messages for delete
  using (auth.uid() = user_id);

create index if not exists idx_chat_messages_conversation_id on public.chat_messages(conversation_id);
create index if not exists idx_chat_messages_user_id on public.chat_messages(user_id);
create index if not exists idx_chat_messages_created_at on public.chat_messages(created_at);

-- 5) Storage bucket for note uploads (private)
insert into storage.buckets (id, name, public)
values ('notes-uploads', 'notes-uploads', false)
on conflict (id) do nothing;

-- Storage policies for per-user folders in the bucket
create policy "Users can read their own note files"
  on storage.objects for select
  using (
    bucket_id = 'notes-uploads' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can upload their own note files"
  on storage.objects for insert
  with check (
    bucket_id = 'notes-uploads' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own note files"
  on storage.objects for update
  using (
    bucket_id = 'notes-uploads' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own note files"
  on storage.objects for delete
  using (
    bucket_id = 'notes-uploads' and auth.uid()::text = (storage.foldername(name))[1]
  );
