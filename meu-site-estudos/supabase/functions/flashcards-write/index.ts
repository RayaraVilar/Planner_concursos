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
    global: {
      headers: { Authorization: req.headers.get("Authorization") ?? "" },
    },
  });

  const { data, error } = await supabaseAuth.auth.getUser();
  if (error || !data?.user) throw new Error("Unauthorized");
  return data.user;
}

function must(v: any, msg: string) {
  if (v === undefined || v === null || String(v).trim() === "") throw new Error(msg);
  return v;
}

// fallback: aceita body.name e body.nome (pra não quebrar chamadas antigas)
function mustName(body: any) {
  const v = body?.name ?? body?.nome;
  return must(v, "Missing name");
}

function toUuidOrNull(v: any) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
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

    // Admin client (Service Role)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim();
    if (!action) return json({ ok: false, error: "Missing action" }, 400);

    const uid = user.id;

    // Helpers
    const insert = async (table: string, row: any) => {
      const payload = { ...row, user_id: uid };

      const { data, error } = await admin
        .from(table)
        .insert(payload)
        .select("id")
        .single();

      if (error) throw new Error(`${table}: ${error.message}`);
      return data?.id;
    };

    const del = async (table: string, id: string) => {
      const { error } = await admin
        .from(table)
        .delete()
        .eq("id", id)
        .eq("user_id", uid);
      if (error) throw new Error(`${table}: ${error.message}`);
      return true;
    };

    // ======================
    // CREATE
    // ======================
    if (action === "create_course") {
      const name = mustName(body);
      const id = await insert("flash_courses", { name });
      return json({ ok: true, data: { id } });
    }

    if (action === "create_discipline") {
      const name = mustName(body);
      const course_id = must(body?.course_id, "Missing course_id");
      const id = await insert("flash_disciplines", { name, course_id });
      return json({ ok: true, data: { id } });
    }

    if (action === "create_subject") {
      const name = mustName(body);
      const discipline_id = must(body?.discipline_id, "Missing discipline_id");
      const id = await insert("flash_subjects", { name, discipline_id });
      return json({ ok: true, data: { id } });
    }

    // ✅ TOPIC dentro de SUBJECT
    // Sua tabela flash_topics tem discipline_id NOT NULL,
    // então a gente busca a discipline_id do subject antes de inserir.
    if (action === "create_topic") {
      const name = mustName(body);
      const subject_id = must(body?.subject_id, "Missing subject_id");

      const { data: subj, error: subjErr } = await admin
        .from("flash_subjects")
        .select("discipline_id")
        .eq("id", subject_id)
        .eq("user_id", uid)
        .single();

      if (subjErr) throw new Error(`flash_subjects: ${subjErr.message}`);

      const discipline_id = must(subj?.discipline_id, "Subject without discipline_id");

      const id = await insert("flash_topics", { name, subject_id, discipline_id });
      return json({ ok: true, data: { id } });
    }

    // compat: modo antigo
    if (action === "create_topic_legacy") {
      const name = mustName(body);
      const discipline_id = must(body?.discipline_id, "Missing discipline_id");
      const id = await insert("flash_topics", { name, discipline_id });
      return json({ ok: true, data: { id } });
    }

    // ✅ Deck SEMPRE por topic_id (e subject_id opcional)
    // Se subject_id não vier, tenta descobrir via topic.subject_id.
    if (action === "create_deck") {
      const name = mustName(body);
      const topic_id = toUuidOrNull(body?.topic_id);
      let subject_id = toUuidOrNull(body?.subject_id);

      if (!topic_id) throw new Error("Missing topic_id");

      if (!subject_id) {
        const { data: t, error: tErr } = await admin
          .from("flash_topics")
          .select("subject_id")
          .eq("id", topic_id)
          .eq("user_id", uid)
          .single();

        if (tErr) throw new Error(`flash_topics: ${tErr.message}`);
        subject_id = t?.subject_id ?? null;
      }

      const id = await insert("flash_decks", { name, topic_id, subject_id });
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
    return json({ ok: false, error: (e as Error).message || "Erro interno." }, 400);
  }
});