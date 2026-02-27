import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;

function jsonResponse(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mustString(v: unknown, msg: string) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(msg);
  return s;
}

function mustId(v: unknown, msg: string) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(msg);
  return s;
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return jsonResponse(500, { ok: false, error: "Missing Supabase env vars" });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!jwt) return jsonResponse(401, { ok: false, error: "Missing Authorization Bearer token" });

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
    if (userErr || !userRes?.user?.id) {
      return jsonResponse(401, { ok: false, error: "Invalid session token" });
    }

    const user_id = userRes.user.id;

    const body = (await req.json().catch(() => ({}))) as Json;
    const action = String(body.action ?? "").trim();
    if (!action) return jsonResponse(400, { ok: false, error: "Missing action" });

    async function insert(table: string, values: Record<string, unknown>) {
      const { data, error } = await supabaseAdmin.from(table).insert(values).select("id").single();
      if (error) throw new Error(error.message);
      return data?.id as string;
    }

    async function del(table: string, filter: Record<string, unknown>) {
      let q = supabaseAdmin.from(table).delete().eq("user_id", user_id);
      for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
      const { error } = await q;
      if (error) throw new Error(error.message);
    }

    async function deleteDeckCascade(deck_id: string) {
      await del("flash_cards", { deck_id });
      await del("flash_decks", { id: deck_id });
    }

    async function deleteTopicCascade(topic_id: string) {
      const { data: decks, error: decksErr } = await supabaseAdmin
        .from("flash_decks")
        .select("id")
        .eq("user_id", user_id)
        .eq("topic_id", topic_id);

      if (decksErr) throw new Error(decksErr.message);

      for (const d of decks || []) {
        await deleteDeckCascade(String(d.id));
      }

      await del("flash_topics", { id: topic_id });
    }

    async function deleteSubjectCascade(subject_id: string) {
      const { data: topics, error: topicsErr } = await supabaseAdmin
        .from("flash_topics")
        .select("id")
        .eq("user_id", user_id)
        .eq("subject_id", subject_id);

      if (topicsErr) throw new Error(topicsErr.message);

      for (const t of topics || []) {
        await deleteTopicCascade(String(t.id));
      }

      const { data: decks, error: decksErr } = await supabaseAdmin
        .from("flash_decks")
        .select("id")
        .eq("user_id", user_id)
        .eq("subject_id", subject_id);

      if (!decksErr) {
        for (const d of decks || []) {
          await deleteDeckCascade(String(d.id));
        }
      }

      await del("flash_subjects", { id: subject_id });
    }

    async function deleteDisciplineCascade(discipline_id: string) {
      const { data: subs, error: subsErr } = await supabaseAdmin
        .from("flash_subjects")
        .select("id")
        .eq("user_id", user_id)
        .eq("discipline_id", discipline_id);

      if (!subsErr) {
        for (const s of subs || []) {
          await deleteSubjectCascade(String(s.id));
        }
      }

      const { data: legacyTopics, error: legacyErr } = await supabaseAdmin
        .from("flash_topics")
        .select("id")
        .eq("user_id", user_id)
        .eq("discipline_id", discipline_id);

      if (!legacyErr) {
        for (const t of legacyTopics || []) {
          await deleteTopicCascade(String(t.id));
        }
      }

      await del("flash_disciplines", { id: discipline_id });
    }

    async function deleteCourseCascade(course_id: string) {
      const { data: discs, error: discErr } = await supabaseAdmin
        .from("flash_disciplines")
        .select("id")
        .eq("user_id", user_id)
        .eq("course_id", course_id);

      if (discErr) throw new Error(discErr.message);

      for (const d of discs || []) {
        await deleteDisciplineCascade(String(d.id));
      }

      await del("flash_courses", { id: course_id });
    }

    switch (action) {
      case "create_course": {
        const nome = mustString(body.nome, "Nome do curso é obrigatório.");
        const id = await insert("flash_courses", { user_id, nome });
        return jsonResponse(200, { ok: true, data: { id } });
      }

      case "create_discipline": {
        const nome = mustString(body.nome, "Nome da disciplina é obrigatório.");
        const course_id = mustId(body.course_id, "course_id é obrigatório.");
        const id = await insert("flash_disciplines", { user_id, nome, course_id });
        return jsonResponse(200, { ok: true, data: { id } });
      }

      case "create_subject": {
        const nome = mustString(body.nome, "Nome do assunto é obrigatório.");
        const discipline_id = mustId(body.discipline_id, "discipline_id é obrigatório.");
        const id = await insert("flash_subjects", { user_id, nome, discipline_id });
        return jsonResponse(200, { ok: true, data: { id } });
      }

      case "create_topic_legacy": {
        const nome = mustString(body.nome, "Nome do assunto (legado) é obrigatório.");
        const discipline_id = mustId(body.discipline_id, "discipline_id é obrigatório.");
        const id = await insert("flash_topics", { user_id, name: nome, discipline_id });
        return jsonResponse(200, { ok: true, data: { id } });
      }

      case "create_topic": {
        const nome = mustString(body.nome, "Nome do tópico é obrigatório.");
        const subject_id = mustId(body.subject_id, "subject_id é obrigatório.");
        const id = await insert("flash_topics", { user_id, name: nome, subject_id });
        return jsonResponse(200, { ok: true, data: { id } });
      }

      case "create_deck": {
        const nome = mustString(body.nome, "Nome do deck é obrigatório.");

        const topic_id = String(body.topic_id ?? "").trim();
        const subject_id = String(body.subject_id ?? "").trim();

        if (!topic_id && !subject_id) {
          throw new Error("topic_id (ou subject_id) é obrigatório para criar deck.");
        }

        const payload: Record<string, unknown> = { user_id, nome };
        if (topic_id) payload.topic_id = topic_id;
        if (subject_id) payload.subject_id = subject_id;

        const id = await insert("flash_decks", payload);
        return jsonResponse(200, { ok: true, data: { id } });
      }

      case "create_card": {
        const deck_id = mustId(body.deck_id, "deck_id é obrigatório.");
        const pergunta = mustString(body.pergunta, "Pergunta é obrigatória.");
        const resposta = mustString(body.resposta, "Resposta é obrigatória.");
        const tipo = String(body.tipo ?? "normal");
        const tags = Array.isArray(body.tags) ? body.tags.slice(0, 8) : [];

        const id = await insert("flash_cards", {
          user_id,
          deck_id,
          tipo,
          pergunta,
          resposta,
          tags,
        });

        return jsonResponse(200, { ok: true, data: { id } });
      }

      case "delete_course": {
        const id = mustId(body.id, "id é obrigatório.");
        await deleteCourseCascade(id);
        return jsonResponse(200, { ok: true });
      }

      case "delete_discipline": {
        const id = mustId(body.id, "id é obrigatório.");
        await deleteDisciplineCascade(id);
        return jsonResponse(200, { ok: true });
      }

      case "delete_subject": {
        const id = mustId(body.id, "id é obrigatório.");
        await deleteSubjectCascade(id);
        return jsonResponse(200, { ok: true });
      }

      case "delete_topic": {
        const id = mustId(body.id, "id é obrigatório.");
        await deleteTopicCascade(id);
        return jsonResponse(200, { ok: true });
      }

      case "delete_topic_legacy": {
        const id = mustId(body.id, "id é obrigatório.");
        await deleteTopicCascade(id);
        return jsonResponse(200, { ok: true });
      }

      case "delete_deck": {
        const id = mustId(body.id, "id é obrigatório.");
        await deleteDeckCascade(id);
        return jsonResponse(200, { ok: true });
      }

      default:
        return jsonResponse(400, { ok: false, error: `Unknown action: ${action}` });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonResponse(500, { ok: false, error: message });
  }
});