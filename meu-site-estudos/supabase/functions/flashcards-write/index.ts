import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUserFromAuthHeader(
  req: Request,
  supabaseUrl: string,
  anonKey: string
) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return { user: null, error: "Missing Bearer token" };
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: error?.message || "Invalid user token" };
  }

  return { user, error: null };
}

async function insertWithFallback(
  supabaseAdmin: ReturnType<typeof createClient>,
  table: string,
  primaryPayload: Record<string, unknown>,
  legacyPayload: Record<string, unknown>
) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .insert(primaryPayload)
    .select("id")
    .single();

  if (!error) return { data, usedLegacy: false };

  const { data: legacyData, error: legacyError } = await supabaseAdmin
    .from(table)
    .insert(legacyPayload)
    .select("id")
    .single();

  if (legacyError) throw error;

  return { data: legacyData, usedLegacy: true };
}

async function existsWithFallback(
  supabaseAdmin: ReturnType<typeof createClient>,
  table: string,
  id: string,
  userId: string
) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!error) return data;
  return null;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
    if (!SUPABASE_ANON_KEY) throw new Error("Missing SUPABASE_ANON_KEY");
    if (!SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

    const { user, error: authError } = await getUserFromAuthHeader(
      req,
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

    if (authError || !user)
      return json(401, { ok: false, error: authError });

    const rawBody = await req.text();
    let body: Record<string, unknown> = {};

    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return json(400, { ok: false, error: "Body inválido." });
    }

    const action = String(body.action || "");
    const nome = String(body.nome || "").trim();

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY
    );

    // =========================
    // CREATE COURSE
    // =========================
    if (action === "create_course") {
      if (!nome)
        return json(400, { ok: false, error: "Nome é obrigatório." });

      const { data } = await insertWithFallback(
        supabaseAdmin,
        "flash_courses",
        { user_id: user.id, nome },
        { user_id: user.id, name: nome }
      );

      return json(200, { ok: true, data });
    }

    // =========================
    // CREATE DISCIPLINE
    // =========================
    if (action === "create_discipline") {
      const course_id = String(body.course_id || "");
      if (!course_id)
        return json(400, { ok: false, error: "course_id é obrigatório." });

      const { data: course } = await supabaseAdmin
        .from("flash_courses")
        .select("id")
        .eq("id", course_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!course)
        return json(403, {
          ok: false,
          error: "Curso inválido para este usuário.",
        });

      const { data } = await insertWithFallback(
        supabaseAdmin,
        "flash_disciplines",
        { user_id: user.id, course_id, nome },
        { user_id: user.id, course_id, name: nome }
      );

      return json(200, { ok: true, data });
    }

    // =========================
    // CREATE TOPIC
    // =========================
    if (action === "create_subject") {
      const discipline_id = String(body.discipline_id || "");
      if (!discipline_id)
        return json(400, { ok: false, error: "discipline_id é obrigatório." });

      const discipline = await existsWithFallback(
        supabaseAdmin,
        "flash_disciplines",
        discipline_id,
        user.id
      );

      if (!discipline)
        return json(403, {
          ok: false,
          error: "Disciplina inválida para este usuário.",
        });

      try {
        const { data } = await insertWithFallback(
          supabaseAdmin,
          "flash_subjects",
          { user_id: user.id, discipline_id, nome },
          { user_id: user.id, discipline_id, name: nome }
        );

        return json(200, { ok: true, data });
      } catch {
        const { data } = await insertWithFallback(
          supabaseAdmin,
          "flash_topics",
          { user_id: user.id, discipline_id, nome },
          { user_id: user.id, discipline_id, name: nome }
        );

        return json(200, { ok: true, data, meta: { table: "flash_topics" } });
      }
    }


    // =========================
    // CREATE TOPIC
    // =========================
    if (action === "create_topic") {
      const subject_id = String(body.subject_id || "");
      if (!subject_id)
        return json(400, { ok: false, error: "subject_id é obrigatório." });

      const { data: subject, error: subjectError } = await supabaseAdmin
        .from("flash_subjects")
        .select("id, discipline_id")
        .eq("id", subject_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (subjectError || !subject)
      const subject = await existsWithFallback(
        supabaseAdmin,
        "flash_subjects",
        subject_id,
        user.id
      );

      if (!subject)
        return json(403, {
          ok: false,
          error: "Assunto inválido para este usuário.",
        });

      try {
        const { data } = await insertWithFallback(
          supabaseAdmin,
          "flash_topics",
          { user_id: user.id, subject_id, nome },
          { user_id: user.id, subject_id, name: nome }
        );

        return json(200, { ok: true, data });
      } catch {
        const { data } = await insertWithFallback(
          supabaseAdmin,
          "flash_topics",
          { user_id: user.id, discipline_id: subject.discipline_id, nome },
          { user_id: user.id, discipline_id: subject.discipline_id, name: nome }
        );

        return json(200, {
          ok: true,
          data,
          meta: { fallback: "discipline_id" },
        });
      }
      const { data } = await insertWithFallback(
        supabaseAdmin,
        "flash_topics",
        { user_id: user.id, subject_id, nome },
        { user_id: user.id, subject_id, name: nome }
      );

      return json(200, { ok: true, data });
    }

    // =========================
    // CREATE DECK
    // =========================
    if (action === "create_deck") {
      const subject_id = String(body.subject_id || body.topic_id || "");
      if (!subject_id)
        return json(400, { ok: false, error: "subject_id é obrigatório." });

      const topic = await existsWithFallback(
        supabaseAdmin,
        "flash_subjects",
        subject_id,
        user.id
      );
      const legacyTopic = topic
        ? topic
        : await existsWithFallback(
            supabaseAdmin,
            "flash_topics",
            subject_id,
            user.id
          );

      if (!legacyTopic)
        return json(403, {
          ok: false,
          error: "Assunto inválido para este usuário.",
        });

      const { data } = await insertWithFallback(
        supabaseAdmin,
        "flash_decks",
        { user_id: user.id, topic_id: subject_id, nome },
        { user_id: user.id, topic_id: subject_id, name: nome }
      );

      return json(200, { ok: true, data });
    }

    // =========================
    // CREATE CARD
    // =========================
    if (action === "create_card") {
      const deck_id = String(body.deck_id || "");
      if (!deck_id)
        return json(400, { ok: false, error: "deck_id é obrigatório." });

      const tipo = "normal";
      const pergunta = String(body.pergunta || "").trim();
      const resposta = String(body.resposta || "").trim();

      if (!pergunta || !resposta)
        return json(400, {
          ok: false,
          error: "pergunta/resposta são obrigatórias.",
        });

      const payload = {
        user_id: user.id,
        deck_id,
        tipo,
        pergunta,
        resposta,
        cloze_text: null,
        cloze_answer: null,
        tags: Array.isArray(body.tags)
          ? body.tags.map((t) => String(t))
          : [],
        favoritos: false,
      };

      const { error } = await supabaseAdmin
        .from("flash_cards")
        .insert(payload);

      if (error) {
        const { favoritos, ...legacyBase } = payload;
        const { error: legacyError } = await supabaseAdmin
          .from("flash_cards")
          .insert({ ...legacyBase, is_favorite: favoritos });

        if (legacyError) throw error;
      }

      return json(200, { ok: true });
    }

    return json(400, { ok: false, error: "action inválida." });
  } catch (e) {
    return json(400, {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});
