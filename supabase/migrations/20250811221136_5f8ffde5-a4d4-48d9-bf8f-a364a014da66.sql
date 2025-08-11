
-- Create an RPC to perform semantic search on note_chunks using pgvector
-- Runs under RLS; callers only see their own data.
-- Uses the vector type from the extensions schema.
create or replace function public.match_note_chunks(
  p_query_embedding extensions.vector(1536),
  p_match_count int default 8
)
returns table (
  note_id uuid,
  chunk_index int,
  content text,
  similarity double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    nc.note_id,
    nc.chunk_index,
    nc.content,
    1 - (nc.embedding <-> p_query_embedding) as similarity
  from public.note_chunks as nc
  -- RLS already enforces auth.uid() = user_id; keep this for clarity and planner hints
  where nc.user_id = auth.uid()
  order by nc.embedding <-> p_query_embedding
  limit greatest(1, p_match_count)
$$;

-- Helpful: ensure we have supporting indexes (safe if they already exist)
create index if not exists idx_note_chunks_user_id on public.note_chunks(user_id);
create index if not exists idx_note_chunks_embedding on public.note_chunks using ivfflat (embedding vector_l2_ops) with (lists = 100);
