import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Brain, Plus, Sparkles, Pencil, ChevronRight, FolderOpen, Layers3, BookText, ListChecks } from "lucide-react";

const initialTree = {
  courses: [],
  disciplines: [],
  subjects: [],
  topics: [],
  decks: [],
  cards: [],
};

const safeTags = (text) =>
  String(text || "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

const steps = ["Curso", "Disciplina", "Assunto", "Tópico", "Deck"];

export default function Flashcards({ user }) {
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [tree, setTree] = useState(initialTree);

  const [courseId, setCourseId] = useState("");
  const [disciplineId, setDisciplineId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [deckId, setDeckId] = useState("");

  const [newNames, setNewNames] = useState({
    course: "",
    discipline: "",
    subject: "",
    topic: "",
    deck: "",
  });
  const [cardForm, setCardForm] = useState({ pergunta: "", resposta: "", tags: "" });
  const [aiForm, setAiForm] = useState({ text: "", qtd: 12, aggressiveness: "medio" });
  const [aiLoading, setAiLoading] = useState(false);

  const selectedDeck = useMemo(() => tree.decks.find((d) => d.id === deckId), [tree.decks, deckId]);

  const currentStep = useMemo(() => {
    if (deckId) return 5;
    if (topicId) return 4;
    if (subjectId) return 3;
    if (disciplineId) return 2;
    if (courseId) return 1;
    return 0;
  }, [courseId, disciplineId, subjectId, topicId, deckId]);

  useEffect(() => {
    if (!user?.id) return;
    loadCourses();
  }, [user?.id]);

  useEffect(() => {
    if (!courseId)
      return setTree((prev) => ({ ...prev, disciplines: [], subjects: [], topics: [], decks: [], cards: [] }));
    loadDisciplines(courseId);
  }, [courseId]);

  useEffect(() => {
    if (!disciplineId)
      return setTree((prev) => ({ ...prev, subjects: [], topics: [], decks: [], cards: [] }));
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
      setTree((prev) => ({
        ...prev,
        courses: rows.map((r) => ({ id: r.id, nome: r.nome || r.name || "" })),
      }));
    } finally {
      setLoading(false);
    }
  }

  async function loadDisciplines(course_id) {
    const rows = await selectWithFallback("flash_disciplines", "id,nome,course_id", "id,name,course_id", {
      course_id,
    });
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

    setTree((prev) => ({
      ...prev,
      topics: rows.error ? [] : (rows.data || []).map((r) => ({ id: r.id, nome: r.name })),
    }));
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

  const Select = ({ label, value, onChange, options, icon: Icon }) => (
    <label className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <span className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-1">
        <Icon size={14} /> {label}
      </span>
      <select
        value={value}
        onChange={onChange}
        className="px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 text-sm dark:border-slate-700 dark:bg-slate-950"
      >
        <option value="">Selecione</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.nome}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-4 dark:border-cyan-900/40 dark:from-slate-900 dark:to-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-xl flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Brain size={20} className="text-cyan-600" /> Flashcards
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Fluxo simples para criar e estudar seus decks.</p>
          </div>
          <button
            onClick={() => setEditMode((v) => !v)}
            className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-cyan-500"
          >
            <Pencil size={16} /> {editMode ? "Sair da edição" : "Modo edição"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {steps.map((step, index) => {
            const active = index < currentStep;
            return (
              <React.Fragment key={step}>
                <span
                  className={`px-2.5 py-1 rounded-full border ${
                    active
                      ? "bg-cyan-600 text-white border-cyan-600"
                      : "bg-white text-slate-500 border-slate-300 dark:bg-slate-900 dark:border-slate-700"
                  }`}
                >
                  {step}
                </span>
                {index < steps.length - 1 && <ChevronRight size={14} className="text-slate-400" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <Select
          label="Curso"
          icon={FolderOpen}
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setDisciplineId("");
            setSubjectId("");
            setTopicId("");
            setDeckId("");
          }}
          options={tree.courses}
        />
        <Select
          label="Disciplina"
          icon={BookText}
          value={disciplineId}
          onChange={(e) => {
            setDisciplineId(e.target.value);
            setSubjectId("");
            setTopicId("");
            setDeckId("");
          }}
          options={tree.disciplines}
        />
        <Select
          label="Assunto"
          icon={ListChecks}
          value={subjectId}
          onChange={(e) => {
            setSubjectId(e.target.value);
            setTopicId("");
            setDeckId("");
          }}
          options={tree.subjects}
        />
        <Select
          label="Tópico"
          icon={Layers3}
          value={topicId}
          onChange={(e) => {
            setTopicId(e.target.value);
            setDeckId("");
          }}
          options={tree.topics}
        />
        <Select
          label="Deck"
          icon={Brain}
          value={deckId}
          onChange={(e) => setDeckId(e.target.value)}
          options={tree.decks.map((d) => ({ ...d, nome: d.nome || d.name }))}
        />
      </div>

      {editMode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm font-medium mb-3 text-amber-800 dark:text-amber-300">Modo edição ativo: crie cada nível da árvore.</p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {[
              ["course", "Curso"],
              ["discipline", "Disciplina"],
              ["subject", "Assunto"],
              ["topic", "Tópico"],
              ["deck", "Deck"],
            ].map(([key, label]) => (
              <div key={key} className="flex gap-2">
                <input
                  placeholder={`Novo ${label}`}
                  value={newNames[key]}
                  onChange={(e) => setNewNames((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
                />
                <button onClick={() => createItem(key)} className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                  <Plus size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold">Criar card manual (sem cloze)</h3>
          <input
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"
            placeholder="Pergunta"
            value={cardForm.pergunta}
            onChange={(e) => setCardForm((p) => ({ ...p, pergunta: e.target.value }))}
          />
          <textarea
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"
            placeholder="Resposta"
            value={cardForm.resposta}
            onChange={(e) => setCardForm((p) => ({ ...p, resposta: e.target.value }))}
          />
          <input
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"
            placeholder="tags (separadas por vírgula)"
            value={cardForm.tags}
            onChange={(e) => setCardForm((p) => ({ ...p, tags: e.target.value }))}
          />
          <button onClick={createCard} className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700">
            Salvar card
          </button>
        </div>

        <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-4 space-y-3 dark:border-cyan-900/40 dark:bg-cyan-950/20">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles size={16} /> Gerar por IA (somente pergunta/resposta)
          </h3>
          <textarea
            className="w-full min-h-[110px] px-3 py-2 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
            placeholder="Cole aqui o texto base para gerar flashcards..."
            value={aiForm.text}
            onChange={(e) => setAiForm((p) => ({ ...p, text: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="3"
              max="30"
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
              value={aiForm.qtd}
              onChange={(e) => setAiForm((p) => ({ ...p, qtd: e.target.value }))}
            />
            <select
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
              value={aiForm.aggressiveness}
              onChange={(e) => setAiForm((p) => ({ ...p, aggressiveness: e.target.value }))}
            >
              <option value="prova">Prova</option>
              <option value="medio">Médio</option>
              <option value="longo">Longo prazo</option>
            </select>
          </div>
          <button onClick={generateWithAI} disabled={aiLoading} className="px-4 py-2 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-60">
            {aiLoading ? "Gerando..." : "Gerar com IA"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-semibold mb-2">Cards do deck: {selectedDeck?.nome || selectedDeck?.name || "-"}</h3>
        {loading && <p className="text-sm text-slate-500">Carregando...</p>}
        {!tree.cards.length ? (
          <p className="text-sm text-slate-500">Nenhum card neste deck.</p>
        ) : (
          <ul className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {tree.cards.map((card) => (
              <li key={card.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                <p className="font-medium">{card.pergunta}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{card.resposta}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
