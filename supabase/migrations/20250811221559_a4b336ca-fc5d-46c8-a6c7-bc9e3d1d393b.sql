-- Create a demo-friendly RPC that allows specifying a user id explicitly.
-- This is useful for public, no-auth demos where we scope data by a client-provided identifier.
-- NOTE: Uses the vector type from the extensions schema and keeps the function STABLE for planner optimizations.
create or replace function public.match_note_chunks_public(
  p_user_id uuid,
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
  where nc.user_id = p_user_id
  order by nc.embedding <-> p_query_embedding
  limit greatest(1, p_match_count)
$$;

-- Supporting indexes (no-ops if already exist)
create index if not exists idx_note_chunks_user_id on public.note_chunks(user_id);
create index if not exists idx_note_chunks_embedding on public.note_chunks using ivfflat (embedding vector_l2_ops) with (lists = 100);
