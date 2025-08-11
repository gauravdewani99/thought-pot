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

function bytesToUuidV4(bytes: Uint8Array) {
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

async function chatAnswer(question: string, contextBlocks: { title: string; content: string }[]): Promise<string> {
  const prompt = `You are an assistant answering questions strictly using the provided Apple Notes context.\n\nQuestion: ${question}\n\nContext:\n${contextBlocks.map((b,i)=>`[${i+1}] Title: ${b.title}\n${b.content}`).join("\n\n")}\n\nInstructions:\n- If the answer is not in the context, say you don't have enough information.\n- Keep answers concise.\n- Cite sources inline like (See: Title).`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI chat error: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, question, matchCount } = await req.json();
    if (!clientId || !question) {
      return new Response(JSON.stringify({ error: "clientId and question are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = await clientIdToUuid(clientId);
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const qEmbedding = await embed(question);

    // Call the demo-friendly RPC with explicit user id
    const { data: matches, error: rpcErr } = await supabase.rpc("match_note_chunks_public", {
      p_user_id: userId,
      p_query_embedding: JSON.stringify(qEmbedding),
      p_match_count: matchCount ?? 8,
    });
    if (rpcErr) throw rpcErr;

    const noteIds = Array.from(new Set((matches || []).map((m: any) => m.note_id)));
    let titlesById: Record<string, string> = {};
    if (noteIds.length > 0) {
      const { data: notes, error: notesErr } = await supabase
        .from("notes")
        .select("id,title,file_name")
        .in("id", noteIds);
      if (notesErr) throw notesErr;
      titlesById = Object.fromEntries((notes || []).map((n: any) => [n.id, n.title || n.file_name || "Untitled"]));
    }

    const top = (matches || []).slice(0, 8);
    const contextBlocks = top.map((m: any) => ({
      title: titlesById[m.note_id] || "Untitled",
      content: m.content,
    }));

    const answer = await chatAnswer(question, contextBlocks);

    const sources = top.map((m: any) => ({
      noteId: m.note_id,
      title: titlesById[m.note_id] || "Untitled",
      snippet: (m.content || "").slice(0, 180),
    }));

    return new Response(JSON.stringify({ answer, sources }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("chat-ask error", e);
    return new Response(JSON.stringify({ error: e.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
