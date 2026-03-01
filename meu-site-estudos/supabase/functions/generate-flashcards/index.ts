/// <reference lib="deno.ns" />

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickText(p: any): string {
  const candidates = [p?.text, p?.texto, p?.content, p?.input];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

function extractOutputText(resJson: any): string {
  if (typeof resJson?.output_text === "string" && resJson.output_text.trim()) {
    return resJson.output_text;
  }
  const output = resJson?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = item?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          const t = c?.text;
          if (typeof t === "string" && t.trim()) return t;
        }
      }
    }
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);

  try {
    const raw = await req.text();
    console.log("📩 RAW BODY:", raw);

    let payload: any = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error("❌ JSON parse error:", e);
      return json({ ok: false, error: "JSON inválido.", raw }, 400);
    }

    const text = pickText(payload);
    if (!text) {
      return json(
        { ok: false, error: "Texto vazio.", hint: "Envie text | texto | content | input" },
        400
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return json({ ok: false, error: "Missing OPENAI_API_KEY secret." }, 500);
    }

    const qtd = Number(payload?.qtd ?? payload?.count ?? 12);
    const count = Number.isFinite(qtd) ? Math.min(Math.max(qtd, 1), 40) : 12;
    const aggressiveness = String(payload?.aggressiveness ?? "normal");

    // ✅ precisa conter a palavra "JSON" para usar json_object
    const instructions = `
Você é um gerador de flashcards.
Você DEVE retornar a resposta em JSON.
Gere ${count} flashcards em pt-BR a partir do texto do usuário.

Nível: ${aggressiveness}

Retorne APENAS um objeto JSON válido (sem markdown), exatamente assim:
{
  "cards": [
    { "front": "pergunta", "back": "resposta", "tags": ["tag1","tag2"] }
  ]
}

Regras:
- O JSON deve ser estritamente válido.
- cards é obrigatório e array.
- front e back não podem ser vazios.
- tags deve ser array (pode ser vazio).
`.trim();

    const inputWithJsonHint = `TEXTO BASE (gere saída em JSON):\n${text}`;

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        instructions,
        input: inputWithJsonHint,
        text: { format: { type: "json_object" } },
      }),
    });

    const openaiRaw = await openaiRes.text();
    console.log("🤖 OpenAI status:", openaiRes.status);
    console.log("🤖 OpenAI raw:", openaiRaw);

    if (!openaiRes.ok) {
      return json(
        { ok: false, error: "OpenAI request failed", status: openaiRes.status, details: openaiRaw },
        502
      );
    }

    const openaiJson = JSON.parse(openaiRaw);
    const outputText = extractOutputText(openaiJson);

    if (!outputText) {
      return json({ ok: false, error: "OpenAI returned empty output_text.", raw: openaiJson }, 500);
    }

    let result: any;
    try {
      result = JSON.parse(outputText);
    } catch {
      return json(
        { ok: false, error: "Modelo não retornou JSON parseável.", model_output: outputText },
        500
      );
    }

    if (!Array.isArray(result?.cards)) {
      return json(
        { ok: false, error: "Formato inesperado do JSON (sem cards array).", model_json: result },
        500
      );
    }

    // ✅ Retorna nos DOIS formatos pra não quebrar seu front (pergunta/resposta)
    const cards = result.cards
      .map((c: any) => {
        const front = String(c?.front ?? "").trim();
        const back = String(c?.back ?? "").trim();
        const tags = Array.isArray(c?.tags) ? c.tags.map((x: any) => String(x)) : [];

        return {
          front,
          back,
          pergunta: front, // ✅ compatível com seu banco
          resposta: back,  // ✅ compatível com seu banco
          tags,
        };
      })
      .filter((c: any) => c.front && c.back);

    if (!cards.length) {
      return json({ ok: false, error: "A IA não gerou cards válidos.", model_json: result }, 422);
    }

    return json({ ok: true, cards }, 200);
  } catch (err) {
    console.error("🔥 generate-flashcards crashed:", err);
    return json({ ok: false, error: String((err as any)?.message ?? err) }, 500);
  }
});