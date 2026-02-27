import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Brain, Plus, Sparkles, Pencil } from "lucide-react";

const initialTree = { courses: [], disciplines: [], subjects: [], topics: [], decks: [], cards: [] };

const safeTags = (text) =>
  String(text || "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

export default function Flashcards({ user }) {
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [tree, setTree] = useState(initialTree);

  const [courseId, setCourseId] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [deckId, setDeckId] = useState("");

  const [newNames, setNewNames] = useState({ course: "", discipline: "", subject: "", topic: "", deck: "" });
  const [cardForm, setCardForm] = useState({ pergunta: "", resposta: "", tags: "" });
  const [aiForm, setAiForm] = useState({ text: "", qtd: 12, aggressiveness: "medio" });
  const [aiLoading, setAiLoading] = useState(false);

  const selectedDeck = useMemo(() => tree.decks.find((d) => d.id === deckId), [tree.decks, deckId]);

  useEffect(() => {
    if (!user?.id) return;
    loadCourses();
  }, [user?.id]);

  useEffect(() => {
    if (!courseId) return setTree((prev) => ({ ...prev, disciplines: [], subjects: [], topics: [], decks: [], cards: [] }));
    loadDisciplines(courseId);
  }, [courseId]);

  useEffect(() => {
    if (!disciplineId) return setTree((prev) => ({ ...prev, subjects: [], topics: [], decks: [], cards: [] }));
    loadSubjects(disciplineId);
  }, [disciplineId]);

  useEffect(() => {
    if (!subjectId) return setTree((prev) => ({ ...prev, topics: [], decks: [], cards: [] }));
    loadTopics(subjectId);
  }, [subjectId]);

  useEffect(() => {
    if (!topicId) return setTree((prev) => ({ ...prev, decks: [], cards: [] }));
    loadDecks(topicId);
  }, [topicId]);

  useEffect(() => {
    if (!deckId) return setTree((prev) => ({ ...prev, cards: [] }));
    loadCards(deckId);
  }, [deckId]);

  async function selectWithFallback(table, modernSelect, legacySelect, filter = {}) {
    let query = supabase.from(table).select(modernSelect).eq("user_id", user.id);
    Object.entries(filter).forEach(([k, v]) => (query = query.eq(k, v)));
    const modern = await query.order("created_at", { ascending: false });
    if (!modern.error) return modern.data || [];

    let legacyQuery = supabase.from(table).select(legacySelect).eq("user_id", user.id);
    Object.entries(filter).forEach(([k, v]) => (legacyQuery = legacyQuery.eq(k, v)));
    const legacy = await legacyQuery.order("created_at", { ascending: false });
    if (legacy.error) throw modern.error;
    return legacy.data || [];
  }

  async function loadCourses() {
    setLoading(true);
    try {
      const rows = await selectWithFallback("flash_courses", "id,nome", "id,name");
      setTree((prev) => ({ ...prev, courses: rows.map((r) => ({ id: r.id, nome: r.nome || r.name || "" })) }));
    } finally {
      setLoading(false);
    }
  }

  async function loadDisciplines(course_id) {
    const rows = await selectWithFallback("flash_disciplines", "id,nome,course_id", "id,name,course_id", { course_id });
    setTree((prev) => ({ ...prev, disciplines: rows.map((r) => ({ ...r, nome: r.nome || r.name || "" })) }));
  }

  async function loadSubjects(discipline_id) {
    const subjectRes = await supabase
      .from("flash_subjects")
      .select("id,nome,discipline_id")
      .eq("user_id", user.id)
      .eq("discipline_id", discipline_id)
      .order("created_at", { ascending: false });

    if (!subjectRes.error) {
      setTree((prev) => ({ ...prev, subjects: subjectRes.data || [] }));
      return;
    }

    const topicRes = await supabase
      .from("flash_topics")
      .select("id,name,discipline_id")
      .eq("user_id", user.id)
      .eq("discipline_id", discipline_id)
      .order("created_at", { ascending: false });

    if (topicRes.error) throw subjectRes.error;
    setTree((prev) => ({ ...prev, subjects: (topicRes.data || []).map((r) => ({ ...r, nome: r.name })) }));
  }

  async function loadTopics(subject_id) {
    const rows = await supabase
      .from("flash_topics")
      .select("id,name,subject_id")
      .eq("user_id", user.id)
      .eq("subject_id", subject_id)
      .order("created_at", { ascending: false });

    setTree((prev) => ({ ...prev, topics: rows.error ? [] : (rows.data || []).map((r) => ({ id: r.id, nome: r.name })) }));
  }

  async function loadDecks(baseTopicId) {
    const modern = await supabase
      .from("flash_decks")
      .select("id,nome,topic_id,subject_id")
      .eq("user_id", user.id)
      .or(`topic_id.eq.${baseTopicId},subject_id.eq.${baseTopicId}`)
      .order("created_at", { ascending: false });

    if (!modern.error) {
      setTree((prev) => ({ ...prev, decks: modern.data || [] }));
      return;
    }

    const legacy = await supabase
      .from("flash_decks")
      .select("id,name,topic_id")
      .eq("user_id", user.id)
      .eq("topic_id", baseTopicId)
      .order("created_at", { ascending: false });

    setTree((prev) => ({ ...prev, decks: (legacy.data || []).map((r) => ({ ...r, nome: r.name })) }));
  }

  async function loadCards(deck_id) {
    const { data } = await supabase
      .from("flash_cards")
      .select("id,pergunta,resposta,tags,created_at")
      .eq("user_id", user.id)
      .eq("deck_id", deck_id)
      .order("created_at", { ascending: false });

    setTree((prev) => ({ ...prev, cards: data || [] }));
  }

  async function callWrite(action, payload) {
    const { data: auth } = await supabase.auth.getSession();
    const token = auth?.session?.access_token;
    if (!token) throw new Error("Sem token de sessão");

    const { data, error } = await supabase.functions.invoke("flashcards-write", {
      body: { action, ...payload },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error || !data?.ok) throw new Error(data?.error || error?.message || "Falha ao salvar.");
    return data?.data?.id;
  }

  async function createItem(level) {
    const name = newNames[level].trim();
    if (!name) return alert("Digite um nome válido.");

    const payloadByLevel = {
      course: ["create_course", { nome: name }, loadCourses],
      discipline: ["create_discipline", { nome: name, course_id: courseId }, () => loadDisciplines(courseId)],
      subject: ["create_subject", { nome: name, discipline_id: disciplineId }, () => loadSubjects(disciplineId)],
      topic: ["create_topic", { nome: name, subject_id: subjectId }, () => loadTopics(subjectId)],
      deck: ["create_deck", { nome: name, subject_id: topicId, topic_id: topicId }, () => loadDecks(topicId)],
    };

    const [action, payload, refresh] = payloadByLevel[level] || [];
    if (!action) return;

    try {
      await callWrite(action, payload);
      setNewNames((prev) => ({ ...prev, [level]: "" }));
      await refresh();
    } catch (e) {
      alert(e.message);
    }
  }

  async function createCard() {
    if (!deckId) return alert("Selecione um deck primeiro.");
    if (!cardForm.pergunta.trim() || !cardForm.resposta.trim()) return alert("Preencha pergunta e resposta.");

    await callWrite("create_card", {
      deck_id: deckId,
      tipo: "normal",
      pergunta: cardForm.pergunta,
      resposta: cardForm.resposta,
      tags: safeTags(cardForm.tags),
    });

    setCardForm({ pergunta: "", resposta: "", tags: "" });
    await loadCards(deckId);
  }

  async function generateWithAI() {
    if (!deckId) return alert("Selecione um deck antes de gerar por IA.");
    if (!aiForm.text.trim()) return alert("Cole um texto base para a IA.");

    setAiLoading(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const token = auth?.session?.access_token;
      const { data, error } = await supabase.functions.invoke("generate-flashcards", {
        body: { text: aiForm.text, qtd: Number(aiForm.qtd), aggressiveness: aiForm.aggressiveness },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || !data?.ok) throw new Error(data?.error || error?.message || "Erro ao gerar cards.");

      const cards = Array.isArray(data.cards) ? data.cards : [];
      for (const c of cards) {
        const pergunta = (c.pergunta || c.cloze_text || "").trim();
        const resposta = (c.resposta || c.cloze_answer || "").trim();
        if (!pergunta || !resposta) continue;
        await callWrite("create_card", { deck_id: deckId, tipo: "normal", pergunta, resposta, tags: c.tags || [] });
      }

      await loadCards(deckId);
      alert("Cards gerados e salvos no deck com sucesso.");
    } catch (e) {
      alert(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  const Select = ({ label, value, onChange, options }) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <select value={value} onChange={onChange} className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-950">
        <option value="">Selecione</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>{item.nome}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg flex items-center gap-2"><Brain size={18} /> Flashcards</h2>
        <button onClick={() => setEditMode((v) => !v)} className="px-3 py-2 rounded-lg bg-cyan-600 text-white flex items-center gap-2">
          <Pencil size={16} /> {editMode ? "Sair da edição" : "Modo edição"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <Select label="Curso" value={courseId} onChange={(e) => { setCourseId(e.target.value); setDisciplineId(""); setSubjectId(""); setTopicId(""); setDeckId(""); }} options={tree.courses} />
        <Select label="Disciplina" value={disciplineId} onChange={(e) => { setDisciplineId(e.target.value); setSubjectId(""); setTopicId(""); setDeckId(""); }} options={tree.disciplines} />
        <Select label="Assunto" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(""); setDeckId(""); }} options={tree.subjects} />
        <Select label="Tópico" value={topicId} onChange={(e) => { setTopicId(e.target.value); setDeckId(""); }} options={tree.topics} />
        <Select label="Deck" value={deckId} onChange={(e) => setDeckId(e.target.value)} options={tree.decks.map((d) => ({ ...d, nome: d.nome || d.name }))} />
      </div>

      {editMode && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {[
            ["course", "Curso"],
            ["discipline", "Disciplina"],
            ["subject", "Assunto"],
            ["topic", "Tópico"],
            ["deck", "Deck"],
          ].map(([key, label]) => (
            <div key={key} className="flex gap-2">
              <input placeholder={`Novo ${label}`} value={newNames[key]} onChange={(e) => setNewNames((p) => ({ ...p, [key]: e.target.value }))} className="w-full px-3 py-2 rounded-lg border" />
              <button onClick={() => createItem(key)} className="px-3 py-2 rounded-lg border"><Plus size={16} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold">Criar card manual (sem cloze)</h3>
          <input className="w-full px-3 py-2 rounded-lg border" placeholder="Pergunta" value={cardForm.pergunta} onChange={(e) => setCardForm((p) => ({ ...p, pergunta: e.target.value }))} />
          <textarea className="w-full px-3 py-2 rounded-lg border" placeholder="Resposta" value={cardForm.resposta} onChange={(e) => setCardForm((p) => ({ ...p, resposta: e.target.value }))} />
          <input className="w-full px-3 py-2 rounded-lg border" placeholder="tags (separadas por vírgula)" value={cardForm.tags} onChange={(e) => setCardForm((p) => ({ ...p, tags: e.target.value }))} />
          <button onClick={createCard} className="px-4 py-2 rounded-lg bg-slate-900 text-white">Salvar card</button>
        </div>

        <div className="rounded-xl border p-4 space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><Sparkles size={16} /> Gerar por IA (somente pergunta/resposta)</h3>
          <textarea className="w-full min-h-[110px] px-3 py-2 rounded-lg border" placeholder="Cole aqui o texto base para gerar flashcards..." value={aiForm.text} onChange={(e) => setAiForm((p) => ({ ...p, text: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min="3" max="30" className="px-3 py-2 rounded-lg border" value={aiForm.qtd} onChange={(e) => setAiForm((p) => ({ ...p, qtd: e.target.value }))} />
            <select className="px-3 py-2 rounded-lg border" value={aiForm.aggressiveness} onChange={(e) => setAiForm((p) => ({ ...p, aggressiveness: e.target.value }))}>
              <option value="prova">Prova</option>
              <option value="medio">Médio</option>
              <option value="longo">Longo prazo</option>
            </select>
          </div>
          <button onClick={generateWithAI} disabled={aiLoading} className="px-4 py-2 rounded-lg bg-cyan-600 text-white">
            {aiLoading ? "Gerando..." : "Gerar com IA"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <h3 className="font-semibold mb-2">Cards do deck: {selectedDeck?.nome || selectedDeck?.name || "-"}</h3>
        {loading && <p className="text-sm text-slate-500">Carregando...</p>}
        {!tree.cards.length ? (
          <p className="text-sm text-slate-500">Nenhum card neste deck.</p>
        ) : (
          <ul className="space-y-2 max-h-[320px] overflow-y-auto">
            {tree.cards.map((card) => (
              <li key={card.id} className="border rounded-lg p-3">
                <p className="font-medium">{card.pergunta}</p>
                <p className="text-sm text-slate-600 mt-1">{card.resposta}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
