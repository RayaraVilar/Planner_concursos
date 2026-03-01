// supabase/functions/flashcards-write/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireUser(req: Request) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  const { data, error } = await supabaseAuth.auth.getUser();
  if (error || !data?.user) throw new Error("Unauthorized");
  return data.user;
}

function must(v: any, msg: string) {
  if (v === undefined || v === null || String(v).trim() === "") throw new Error(msg);
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true }, 200);

  try {
    const user = await requireUser(req);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    }

    // ✅ Admin client para inserir/apagar sem depender de RLS,
    // mas SEMPRE filtrando por user_id pra não virar “porta aberta”
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim();

    if (!action) return json({ ok: false, error: "Missing action" }, 400);

    const uid = user.id;

    // Helpers
    const insert = async (table: string, row: any) => {
      const { data, error } = await admin
        .from(table)
        .insert({ ...row, user_id: uid })
        .select("id")
        .single();

      if (error) throw new Error(`${table}: ${error.message}`);
      return data?.id;
    };

    const del = async (table: string, id: string) => {
      const { error } = await admin.from(table).delete().eq("id", id).eq("user_id", uid);
      if (error) throw new Error(`${table}: ${error.message}`);
      return true;
    };

    // ======================
    // CREATE
    // ======================
    if (action === "create_course") {
      const nome = must(body?.nome, "Missing nome");
      const id = await insert("flash_courses", { nome });
      return json({ ok: true, data: { id } });
    }

    if (action === "create_discipline") {
      const nome = must(body?.nome, "Missing nome");
      const course_id = must(body?.course_id, "Missing course_id");
      const id = await insert("flash_disciplines", { nome, course_id });
      return json({ ok: true, data: { id } });
    }

    if (action === "create_subject") {
      const nome = must(body?.nome, "Missing nome");
      const discipline_id = must(body?.discipline_id, "Missing discipline_id");
      const id = await insert("flash_subjects", { nome, discipline_id });
      return json({ ok: true, data: { id } });
    }

    if (action === "create_topic") {
      const nome = must(body?.nome, "Missing nome");
      const subject_id = must(body?.subject_id, "Missing subject_id");
      const id = await insert("flash_topics", { name: nome, subject_id });
      return json({ ok: true, data: { id } });
    }

    // compat: quando seu projeto estiver no modo antigo
    if (action === "create_topic_legacy") {
      const nome = must(body?.nome, "Missing nome");
      const discipline_id = must(body?.discipline_id, "Missing discipline_id");
      const id = await insert("flash_topics", { name: nome, discipline_id });
      return json({ ok: true, data: { id } });
    }

    if (action === "create_deck") {
      const nome = must(body?.nome, "Missing nome");
      const topic_id = body?.topic_id ? String(body.topic_id) : null;
      const subject_id = body?.subject_id ? String(body.subject_id) : null;

      // Pelo seu front, você manda topic_id e/ou subject_id.
      // Aqui deixamos flexível: precisa de pelo menos um.
      if (!topic_id && !subject_id) throw new Error("Missing topic_id or subject_id");

      const id = await insert("flash_decks", { nome, topic_id, subject_id });
      return json({ ok: true, data: { id } });
    }

    if (action === "create_card") {
      const deck_id = must(body?.deck_id, "Missing deck_id");
      const pergunta = must(body?.pergunta, "Missing pergunta");
      const resposta = must(body?.resposta, "Missing resposta");
      const tipo = String(body?.tipo ?? "normal");
      const tags = Array.isArray(body?.tags) ? body.tags.slice(0, 8) : [];

      const id = await insert("flash_cards", {
        deck_id,
        tipo,
        pergunta,
        resposta,
        tags,
      });

      return json({ ok: true, data: { id } });
    }

    // ======================
    // DELETE
    // ======================
    if (action === "delete_course") {
      const id = must(body?.id, "Missing id");
      await del("flash_courses", id);
      return json({ ok: true });
    }

    if (action === "delete_discipline") {
      const id = must(body?.id, "Missing id");
      await del("flash_disciplines", id);
      return json({ ok: true });
    }

    if (action === "delete_subject") {
      const id = must(body?.id, "Missing id");
      await del("flash_subjects", id);
      return json({ ok: true });
    }

    if (action === "delete_topic") {
      const id = must(body?.id, "Missing id");
      await del("flash_topics", id);
      return json({ ok: true });
    }

    // compat
    if (action === "delete_topic_legacy") {
      const id = must(body?.id, "Missing id");
      await del("flash_topics", id);
      return json({ ok: true });
    }

    if (action === "delete_deck") {
      const id = must(body?.id, "Missing id");
      await del("flash_decks", id);
      return json({ ok: true });
    }

    return json({ ok: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.log("flashcards-write error:", e);
    // ✅ Agora devolve o motivo no body (pra você ver no Raw)
    return json({ ok: false, error: (e as Error).message || "Erro interno." }, 400);
  }
});