import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ✅ CORS
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Aggressiveness = "prova" | "medio" | "longo";

function buildScheduleMode(mode: Aggressiveness) {
  if (mode === "prova") return { multiplier: 0.55 };
  if (mode === "medio") return { multiplier: 1.0 };
  return { multiplier: 1.65 };
}

function safeJsonExtract(raw: string) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  const json = raw.slice(start, end + 1);
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

async function readTextFromBytes(filename: string, bytes: Uint8Array) {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    return new TextDecoder().decode(bytes);
  }

  // ✅ Para PDF/DOCX: você pode extrair no front e mandar em "text".
  throw new Error(
    "Upload suporta .txt/.md por enquanto. Para PDF/DOCX: cole o texto no campo."
  );
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // ✅ preflight (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ✅ Secrets
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL secret");
    if (!SUPABASE_ANON_KEY) throw new Error("Missing SUPABASE_ANON_KEY secret");
    if (!SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY secret");
    if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY secret");

    // ✅ 1) Validar usuário via Auth (verify_jwt=false no config)
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return json(401, { ok: false, error: "Missing Bearer token" });

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const {
      data: { user },
      error: userErr,
    } = await authClient.auth.getUser(token);

    if (userErr || !user) {
      return json(401, {
        ok: false,
        error: "Invalid user token",
        details: userErr?.message,
      });
    }

    const user_id = user.id;

    // ✅ 2) Ler body de forma robusta (evita erro de JSON por aspas/escape)
    const rawBody = await req.text();
    let body: any = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return json(400, {
        ok: false,
        error:
          "Body inválido. Envie JSON válido. (Dica: use --data-binary @body.json no PowerShell)",
        raw: rawBody,
      });
    }

    const {
      qtd = 20,
      aggressiveness = "medio",
      course,
      discipline,
      subjects,
      text,
      upload_path,
      filename,
      // opcional: salvar direto no banco (frontend já faz isso por padrão)
      save = false,
    } = body || {};

    // ✅ limitar gasto/abuso
    const safeQtd = Math.max(3, Math.min(Number(qtd) || 20, 40));

    let baseText = "";

    // ✅ texto colado
    if (text && String(text).trim().length > 20) {
      baseText = String(text).trim();
    }

    // ✅ upload do storage (flash_uploads) via service role (download)
    if (!baseText && upload_path) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data, error } = await supabaseAdmin.storage
        .from("flash_uploads")
        .download(upload_path);

      if (error) throw error;

      const arrayBuffer = await data.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      baseText = await readTextFromBytes(filename || "arquivo.txt", bytes);
    }

    // ✅ gerar a partir de curso/assuntos (sem texto)
    if (!baseText && (course || discipline || subjects)) {
      baseText = `
Curso: ${course || "—"}
Disciplina: ${discipline || "—"}
Assuntos: ${Array.isArray(subjects) ? subjects.join(", ") : subjects || "—"}

Crie flashcards com definições + exemplos.
`.trim();
    }

    if (!baseText) {
      throw new Error("Envie text, upload_path, ou curso/assuntos.");
    }

    // ✅ limitar tamanho do texto
    const MAX_CHARS = 9000;
    if (baseText.length > MAX_CHARS) {
      baseText = baseText.slice(0, MAX_CHARS);
    }

    const schedule = buildScheduleMode(aggressiveness as Aggressiveness);

    const prompt = `
Crie ${safeQtd} flashcards premium estilo Estratégia/Anki a partir do conteúdo abaixo.

Regras:
- Responda SOMENTE JSON válido (sem texto extra)
- Misture tipos:
  - normal: pergunta/resposta
  - cloze: cloze_text com {{c1::...}} e cloze_answer
- Tags automáticas (3 a 7)
- Curto, objetivo e útil para revisão
- Pode usar Markdown e LaTeX quando necessário

Formato:
[
  {
    "tipo": "normal" | "cloze",
    "pergunta": "...",
    "resposta": "...",
    "cloze_text": "...",
    "cloze_answer": "...",
    "tags": ["tag1","tag2"]
  }
]

Conteúdo:
${baseText}
`.trim();

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Responda apenas JSON válido em array, sem markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
        max_tokens: 1600, // ✅ limite com folga para cards cloze
      }),
    });

    const result = await resp.json();

    if (!resp.ok) {
      throw new Error(result?.error?.message || "Erro OpenAI");
    }

    const raw = result?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { cards: safeJsonExtract(raw) };
    }

    const cardsRaw = Array.isArray(parsed) ? parsed : parsed?.cards;

    // ✅ normalizar cards pra um formato consistente
    const deck_id = crypto.randomUUID();

    const normalized = (Array.isArray(cardsRaw) ? cardsRaw : []).map((c: any) => ({
      tipo: c?.tipo === "cloze" ? "cloze" : "normal",
      pergunta: String(c?.pergunta ?? "").trim(),
      resposta: String(c?.resposta ?? "").trim(),
      cloze_text: c?.cloze_text ? String(c.cloze_text) : null,
      cloze_answer: c?.cloze_answer ? String(c.cloze_answer) : null,
      tags: Array.isArray(c?.tags) ? c.tags.map((t: any) => String(t)) : [],
    }));

    const validCards = normalized.filter((c) => (c.tipo === "cloze" ? !!(c.cloze_text && c.cloze_answer) : c.pergunta.length >= 3));

    // ✅ 3) Salvar no banco (RLS) como o usuário autenticado
    let saved = 0;

    if (save && validCards.length) {
      const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const rows = validCards.map((c) => ({
        user_id,
        deck_id,
        tipo: c.tipo,
        pergunta: c.pergunta,
        resposta: c.resposta,
        cloze_text: c.cloze_text,
        cloze_answer: c.cloze_answer,
        tags: c.tags,
        status: "new",
        repetitions: 0,
        ease: 2.5,
        interval_days: 0,
        next_review_at: null,
        last_review_at: null,
        para_revisao: true,
        due_date: null,
      }));

      const { error: insErr } = await supabaseUser.from("flash_cards").insert(rows);
      if (insErr) throw new Error(`Erro ao salvar flashcards: ${insErr.message}`);

      saved = rows.length;
    }

    return json(200, {
      ok: true,
      user_id,
      deck_id,
      saved,
      cards: validCards,
      aggressiveness,
      schedule,
    });
  } catch (e: any) {
    return json(400, { ok: false, error: String(e?.message || e) });
  }
});
