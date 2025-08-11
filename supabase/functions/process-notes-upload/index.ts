import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE envs");
}
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY env");
}

function bytesToUuidV4(bytes: Uint8Array) {
  // Set version (4) and variant (RFC 4122)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, "0"));
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
}

async function clientIdToUuid(clientId: string): Promise<string> {
  const enc = new TextEncoder().encode(clientId);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", enc));
  return bytesToUuidV4(hash.slice(0, 16));
}

function splitText(text: string, maxLen = 1000, overlap = 200): { content: string; index: number }[] {
  const chunks: { content: string; index: number }[] = [];
  let i = 0;
  for (let start = 0; start < text.length; start += (maxLen - overlap)) {
    const end = Math.min(text.length, start + maxLen);
    chunks.push({ content: text.slice(start, end), index: i++ });
  }
  return chunks;
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, files } = await req.json();
    if (!clientId || !Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: "clientId and files are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = await clientIdToUuid(clientId);
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const results: any[] = [];

    for (const f of files) {
      const name: string = f.name || "Untitled.txt";
      const type: string = f.type || "text/plain";
      const content: string = f.content || "";
      if (!content) {
        results.push({ name, status: "skipped", reason: "Empty content" });
        continue;
      }

      // Create note record
      const { data: noteInsert, error: noteErr } = await supabase
        .from("notes")
        .insert({
          user_id: userId,
          title: name,
          file_name: name,
          mime_type: type,
          size_bytes: content.length,
          status: "uploaded",
        })
        .select("id")
        .single();

      if (noteErr || !noteInsert) {
        console.error("Note insert error", noteErr);
        results.push({ name, status: "error", reason: noteErr?.message || "insert failed" });
        continue;
      }

      const noteId = noteInsert.id as string;
      const chunks = splitText(content);

      const chunkRows: any[] = [];
      for (const ch of chunks) {
        const vector = await embed(ch.content);
        chunkRows.push({
          note_id: noteId,
          user_id: userId,
          chunk_index: ch.index,
          content: ch.content,
          embedding: vector,
        });
      }

      if (chunkRows.length > 0) {
        const { error: chunkErr } = await supabase.from("note_chunks").insert(chunkRows);
        if (chunkErr) {
          console.error("Chunk insert error", chunkErr);
          results.push({ name, status: "error", reason: chunkErr.message });
          continue;
        }
      }

      await supabase.from("notes").update({ status: "processed" }).eq("id", noteId);
      results.push({ name, status: "processed", chunks: chunkRows.length, noteId });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("process-notes-upload error", e);
    return new Response(JSON.stringify({ error: e.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
