import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Brain, ChevronLeft, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

const initialTree = {
    courses: [],
    disciplines: [],
    subjects: [],
    topics: [],
    decks: [],
    cards: [],
};

const LEVEL_LABEL = {
    courses: "Cursos",
    disciplines: "Disciplinas",
    subjects: "Assuntos",
    topics: "Tópicos",
    decks: "Decks",
    cards: "Cards",
};

function normalizeNameRow(row) {
    return { ...row, nome: row.nome ?? row.name ?? "" };
}

function safeTags(text) {
    return String(text || "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);
}

// ====== NOVO: “A partir dos erros” (colando Pergunta | Resposta) ======
function parsePairs(text) {
    const lines = String(text || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

    const pairs = [];
    for (const line of lines) {
        let parts = line.split("|");
        if (parts.length < 2) parts = line.split(" - ");
        if (parts.length < 2) continue;

        const pergunta = parts[0]?.trim();
        const resposta = parts.slice(1).join("|").trim();
        if (!pergunta || !resposta) continue;

        pairs.push({ pergunta, resposta });
    }
    return pairs.slice(0, 60);
}

export default function Flashcards({ user }) {
    const userId = user?.id;

    // Drill-down level
    const [level, setLevel] = useState("courses"); // courses | disciplines | subjects | topics | decks | cards

    // selections
    const [courseId, setCourseId] = useState("");
    const [disciplineId, setDisciplineId] = useState("");
    const [subjectId, setSubjectId] = useState("");
    const [topicId, setTopicId] = useState("");
    const [deckId, setDeckId] = useState("");

    // legacy: se flash_subjects falhar, usamos flash_topics como subjects e pulamos "topics"
    const [isLegacySubjects, setIsLegacySubjects] = useState(false);

    const [tree, setTree] = useState(initialTree);

    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    const [editMode, setEditMode] = useState(false);
    const [newName, setNewName] = useState("");

    const [cardForm, setCardForm] = useState({ pergunta: "", resposta: "", tags: "" });
    const [aiForm, setAiForm] = useState({ text: "", qtd: 12, aggressiveness: "medio" });

    // ====== NOVO: modal “Criar cards” ======
    const [createCardsOpen, setCreateCardsOpen] = useState(false);
    const [createMode, setCreateMode] = useState(""); // "" | "manual" | "errors" | "ai"
    const [errorsPaste, setErrorsPaste] = useState("");
    const [bulkLoading, setBulkLoading] = useState(false);

    const selectedDeck = useMemo(
        () => tree.decks.find((d) => d.id === deckId),
        [tree.decks, deckId]
    );

    const breadcrumb = useMemo(() => {
        const parts = [{ key: "courses", label: "Cursos" }];

        if (courseId) parts.push({ key: "disciplines", label: "Disciplinas" });
        if (disciplineId) parts.push({ key: "subjects", label: "Assuntos" });

        // só mostra Tópicos se NÃO for legado
        if (!isLegacySubjects && subjectId) parts.push({ key: "topics", label: "Tópicos" });

        // decks aparece quando temos base pra decks:
        // - normal: topicId
        // - legado: subjectId (que na prática é um topic)
        const decksReady = isLegacySubjects ? Boolean(subjectId) : Boolean(topicId);
        if (decksReady) parts.push({ key: "decks", label: "Decks" });

        if (deckId) parts.push({ key: "cards", label: "Cards" });

        return parts;
    }, [courseId, disciplineId, subjectId, topicId, deckId, isLegacySubjects]);

    async function getTokenOrThrow() {
        const { data: auth } = await supabase.auth.getSession();
        const token = auth?.session?.access_token;
        if (!token) throw new Error("Sessão expirada. Faça login novamente.");
        return token;
    }

    // ✅ callWrite melhorado: mostra erro REAL (não só “non-2xx”)
    async function callWrite(action, payload) {
        const token = await getTokenOrThrow();

        const { data, error } = await supabase.functions.invoke("flashcards-write", {
            body: { action, ...payload },
            headers: { Authorization: `Bearer ${token}` },
        });

        if (error) {
            console.error("flashcards-write error:", error);
            const msg =
                error?.context?.body?.error ||
                error?.context?.body?.message ||
                error?.message ||
                "Falha na Edge Function";
            throw new Error(msg);
        }

        if (!data?.ok) {
            console.error("flashcards-write response:", data);
            throw new Error(data?.error || "Falha ao salvar.");
        }

        return data?.data?.id;
    }

    async function selectList({ table, selectModern, selectLegacy, filter = {} }) {
        let q1 = supabase.from(table).select(selectModern).eq("user_id", userId);
        Object.entries(filter).forEach(([k, v]) => (q1 = q1.eq(k, v)));
        const modern = await q1.order("created_at", { ascending: false });
        if (!modern.error) return (modern.data || []).map(normalizeNameRow);

        let q2 = supabase.from(table).select(selectLegacy).eq("user_id", userId);
        Object.entries(filter).forEach(([k, v]) => (q2 = q2.eq(k, v)));
        const legacy = await q2.order("created_at", { ascending: false });
        if (legacy.error) throw modern.error;
        return (legacy.data || []).map(normalizeNameRow);
    }

    const loadCourses = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await selectList({
                table: "flash_courses",
                selectModern: "id,nome,created_at",
                selectLegacy: "id,name,created_at",
            });
            setTree((p) => ({ ...p, courses: rows }));
        } finally {
            setLoading(false);
        }
    }, [userId]);

    const loadDisciplines = useCallback(
        async (course_id) => {
            setLoading(true);
            try {
                const rows = await selectList({
                    table: "flash_disciplines",
                    selectModern: "id,nome,course_id,created_at",
                    selectLegacy: "id,name,course_id,created_at",
                    filter: { course_id },
                });
                setTree((p) => ({ ...p, disciplines: rows }));
            } finally {
                setLoading(false);
            }
        },
        [userId]
    );

    const loadSubjects = useCallback(
        async (discipline_id) => {
            setLoading(true);
            try {
                // tenta subjects (moderno)
                const res = await supabase
                    .from("flash_subjects")
                    .select("id,nome,discipline_id,created_at")
                    .eq("user_id", userId)
                    .eq("discipline_id", discipline_id)
                    .order("created_at", { ascending: false });

                if (!res.error) {
                    setIsLegacySubjects(false);
                    setTree((p) => ({ ...p, subjects: (res.data || []).map(normalizeNameRow) }));
                    return;
                }

                // fallback legado: usa topics como “subjects”
                const legacy = await supabase
                    .from("flash_topics")
                    .select("id,name,discipline_id,created_at")
                    .eq("user_id", userId)
                    .eq("discipline_id", discipline_id)
                    .order("created_at", { ascending: false });

                if (legacy.error) throw res.error;

                setIsLegacySubjects(true);
                setTree((p) => ({
                    ...p,
                    subjects: (legacy.data || []).map((r) => ({ ...r, nome: r.name })),
                }));
            } finally {
                setLoading(false);
            }
        },
        [userId]
    );

    const loadTopics = useCallback(
        async (subject_id) => {
            setLoading(true);
            try {
                const res = await supabase
                    .from("flash_topics")
                    .select("id,name,subject_id,created_at")
                    .eq("user_id", userId)
                    .eq("subject_id", subject_id)
                    .order("created_at", { ascending: false });

                setTree((p) => ({
                    ...p,
                    topics: (res.data || []).map((r) => ({ id: r.id, nome: r.name })),
                }));
            } finally {
                setLoading(false);
            }
        },
        [userId]
    );

    const loadDecks = useCallback(
        async (baseId) => {
            // baseId:
            // - modo normal: topicId
            // - modo legado: subjectId (que na prática é um topic)
            setLoading(true);
            try {
                const modern = await supabase
                    .from("flash_decks")
                    .select("id,nome,name,topic_id,subject_id,created_at")
                    .eq("user_id", userId)
                    .or(`topic_id.eq.${baseId},subject_id.eq.${baseId}`)
                    .order("created_at", { ascending: false });

                if (!modern.error) {
                    setTree((p) => ({ ...p, decks: (modern.data || []).map(normalizeNameRow) }));
                    return;
                }

                const legacy = await supabase
                    .from("flash_decks")
                    .select("id,name,topic_id,created_at")
                    .eq("user_id", userId)
                    .eq("topic_id", baseId)
                    .order("created_at", { ascending: false });

                setTree((p) => ({
                    ...p,
                    decks: (legacy.data || []).map((r) => ({ ...r, nome: r.name })),
                }));
            } finally {
                setLoading(false);
            }
        },
        [userId]
    );

    const loadCards = useCallback(
        async (deck_id) => {
            setLoading(true);
            try {
                const { data } = await supabase
                    .from("flash_cards")
                    .select("id,pergunta,resposta,tags,created_at")
                    .eq("user_id", userId)
                    .eq("deck_id", deck_id)
                    .order("created_at", { ascending: false });

                setTree((p) => ({ ...p, cards: data || [] }));
            } finally {
                setLoading(false);
            }
        },
        [userId]
    );

    // init
    useEffect(() => {
        if (!userId) return;
        setTree(initialTree);
        setLevel("courses");

        setCourseId("");
        setDisciplineId("");
        setSubjectId("");
        setTopicId("");
        setDeckId("");

        setIsLegacySubjects(false);
        setNewName("");

        // modal states
        setCreateCardsOpen(false);
        setCreateMode("");
        setErrorsPaste("");

        loadCourses();
    }, [userId, loadCourses]);

    function clearBelow(nextLevel) {
        if (nextLevel === "courses") {
            setCourseId("");
            setDisciplineId("");
            setSubjectId("");
            setTopicId("");
            setDeckId("");
            setIsLegacySubjects(false);
            setTree((p) => ({
                ...p,
                disciplines: [],
                subjects: [],
                topics: [],
                decks: [],
                cards: [],
            }));
            return;
        }

        if (nextLevel === "disciplines") {
            setDisciplineId("");
            setSubjectId("");
            setTopicId("");
            setDeckId("");
            setIsLegacySubjects(false);
            setTree((p) => ({ ...p, subjects: [], topics: [], decks: [], cards: [] }));
            return;
        }

        if (nextLevel === "subjects") {
            setSubjectId("");
            setTopicId("");
            setDeckId("");
            setTree((p) => ({ ...p, topics: [], decks: [], cards: [] }));
            return;
        }

        if (nextLevel === "topics") {
            setTopicId("");
            setDeckId("");
            setTree((p) => ({ ...p, decks: [], cards: [] }));
            return;
        }

        if (nextLevel === "decks") {
            setDeckId("");
            setTree((p) => ({ ...p, cards: [] }));
            return;
        }

        if (nextLevel === "cards") {
            setTree((p) => ({ ...p, cards: [] }));
        }
    }

    // navegar para dentro
    async function enter(nextLevel, id) {
        setNewName("");

        // Fechar modal de criação se estiver aberto
        setCreateCardsOpen(false);
        setCreateMode("");
        setErrorsPaste("");

        if (nextLevel === "disciplines") {
            setCourseId(id);
            clearBelow("disciplines");
            setLevel("disciplines");
            await loadDisciplines(id);
            return;
        }

        if (nextLevel === "subjects") {
            setDisciplineId(id);
            clearBelow("subjects");
            setLevel("subjects");
            await loadSubjects(id);
            return;
        }

        if (nextLevel === "topics") {
            setSubjectId(id);
            clearBelow("topics");
            setLevel("topics");
            await loadTopics(id);
            return;
        }

        if (nextLevel === "decks") {
            if (isLegacySubjects) {
                setSubjectId(id);
            } else {
                setTopicId(id);
            }
            clearBelow("decks");
            setLevel("decks");
            await loadDecks(id);
            return;
        }

        if (nextLevel === "cards") {
            setDeckId(id);
            clearBelow("cards");
            setLevel("cards");
            await loadCards(id);
            return;
        }
    }

    // botão voltar
    function goBack() {
        setNewName("");

        // Fechar modal de criação se estiver aberto
        setCreateCardsOpen(false);
        setCreateMode("");
        setErrorsPaste("");

        if (level === "cards") {
            setDeckId("");
            setTree((p) => ({ ...p, cards: [] }));
            setLevel("decks");
            return;
        }

        if (level === "decks") {
            if (isLegacySubjects) {
                setLevel("subjects");
            } else {
                setTopicId("");
                setTree((p) => ({ ...p, decks: [], cards: [] }));
                setLevel("topics");
            }
            setDeckId("");
            setTree((p) => ({ ...p, cards: [] }));
            return;
        }

        if (level === "topics") {
            setSubjectId("");
            setTopicId("");
            setTree((p) => ({ ...p, topics: [], decks: [], cards: [] }));
            setLevel("subjects");
            return;
        }

        if (level === "subjects") {
            setDisciplineId("");
            setSubjectId("");
            setTopicId("");
            setDeckId("");
            setIsLegacySubjects(false);
            setTree((p) => ({ ...p, subjects: [], topics: [], decks: [], cards: [] }));
            setLevel("disciplines");
            return;
        }

        if (level === "disciplines") {
            setCourseId("");
            setDisciplineId("");
            setSubjectId("");
            setTopicId("");
            setDeckId("");
            setIsLegacySubjects(false);
            setTree((p) => ({ ...p, disciplines: [], subjects: [], topics: [], decks: [], cards: [] }));
            setLevel("courses");
            return;
        }
    }

    // qual lista mostrar na tela atual
    const currentList = useMemo(() => {
        if (level === "courses") return tree.courses;
        if (level === "disciplines") return tree.disciplines;
        if (level === "subjects") return tree.subjects;
        if (level === "topics") return tree.topics;
        if (level === "decks") return tree.decks;
        return [];
    }, [level, tree]);

    // qual o próximo nível quando clicar num item
    function nextLevelForCurrent() {
        if (level === "courses") return "disciplines";
        if (level === "disciplines") return "subjects";
        if (level === "subjects") return isLegacySubjects ? "decks" : "topics";
        if (level === "topics") return "decks";
        if (level === "decks") return "cards";
        return null;
    }

    // criar item no nível atual
    async function createHere() {
        const name = newName.trim();
        if (!name) return;

        try {
            if (level === "courses") {
                await callWrite("create_course", { nome: name });
                setNewName("");
                await loadCourses();
                return;
            }

            if (level === "disciplines") {
                if (!courseId) return alert("Selecione um curso.");
                await callWrite("create_discipline", { nome: name, course_id: courseId });
                setNewName("");
                await loadDisciplines(courseId);
                return;
            }

            if (level === "subjects") {
                if (!disciplineId) return alert("Selecione uma disciplina.");

                if (isLegacySubjects) {
                    await callWrite("create_topic_legacy", { nome: name, discipline_id: disciplineId });
                    setNewName("");
                    await loadSubjects(disciplineId);
                    return;
                }

                await callWrite("create_subject", { nome: name, discipline_id: disciplineId });
                setNewName("");
                await loadSubjects(disciplineId);
                return;
            }

            if (level === "topics") {
                if (!subjectId) return alert("Selecione um assunto.");
                await callWrite("create_topic", { nome: name, subject_id: subjectId });
                setNewName("");
                await loadTopics(subjectId);
                return;
            }

            if (level === "decks") {
                if (isLegacySubjects) {
                    if (!subjectId) return alert("Selecione um assunto.");
                    await callWrite("create_deck", { nome: name, topic_id: subjectId });
                    setNewName("");
                    await loadDecks(subjectId);
                    return;
                }

                if (!topicId) return alert("Selecione um tópico.");
                await callWrite("create_deck", {
                    nome: name,
                    topic_id: topicId,
                    subject_id: subjectId || null, // ✅ correto: subjectId
                });
                setNewName("");
                await loadDecks(topicId);
                return;
            }
        } catch (e) {
            alert(e.message);
        }
    }

    // deletar item (modo edição)
    async function deleteHere(id, nome) {
        if (!confirm(`Apagar "${nome}"? Isso também apagará os itens abaixo.`)) return;

        const actionMap = {
            courses: "delete_course",
            disciplines: "delete_discipline",
            subjects: isLegacySubjects ? "delete_topic_legacy" : "delete_subject",
            topics: "delete_topic",
            decks: "delete_deck",
        };

        const action = actionMap[level];
        if (!action) return;

        try {
            await callWrite(action, { id });

            if (level === "courses") await loadCourses();
            if (level === "disciplines") await loadDisciplines(courseId);
            if (level === "subjects") await loadSubjects(disciplineId);
            if (level === "topics") await loadTopics(subjectId);

            if (level === "decks") {
                const base = isLegacySubjects ? subjectId : topicId;
                await loadDecks(base);
            }
        } catch (e) {
            alert(e.message);
        }
    }

    // criar card manual (mantido)
    async function createCard() {
        if (!deckId) return alert("Entre em um deck.");
        const pergunta = cardForm.pergunta.trim();
        const resposta = cardForm.resposta.trim();
        if (!pergunta || !resposta) return alert("Preencha pergunta e resposta.");

        try {
            await callWrite("create_card", {
                deck_id: deckId,
                tipo: "normal",
                pergunta,
                resposta,
                tags: safeTags(cardForm.tags),
            });

            setCardForm({ pergunta: "", resposta: "", tags: "" });
            await loadCards(deckId);
        } catch (e) {
            alert(e.message);
        }
    }

    // gerar por IA (mantido)
    async function generateWithAI() {
        if (!deckId) return alert("Entre em um deck antes de gerar por IA.");
        if (!aiForm.text.trim()) return alert("Cole um texto base para a IA.");

        setAiLoading(true);
        try {
            const token = await getTokenOrThrow();
            const { data, error } = await supabase.functions.invoke("generate-flashcards", {
                body: { text: aiForm.text, qtd: Number(aiForm.qtd || 12), aggressiveness: aiForm.aggressiveness },
                headers: { Authorization: `Bearer ${token}` },
            });

            if (error || !data?.ok) {
                const msg =
                    error?.context?.body?.error ||
                    error?.context?.body?.message ||
                    error?.message ||
                    data?.error ||
                    "Erro ao gerar cards.";
                throw new Error(msg);
            }

            const cards = Array.isArray(data.cards) ? data.cards : [];
            let saved = 0;

            for (const c of cards) {
                const pergunta = String(c.pergunta || c.cloze_text || "").trim();
                const resposta = String(c.resposta || c.cloze_answer || "").trim();
                if (!pergunta || !resposta) continue;

                await callWrite("create_card", {
                    deck_id: deckId,
                    tipo: "normal",
                    pergunta,
                    resposta,
                    tags: Array.isArray(c.tags) ? c.tags.slice(0, 8) : [],
                });
                saved += 1;
            }

            await loadCards(deckId);

            if (!saved) {
                alert("A IA não gerou cards válidos com esse texto.");
                return 0;
            }

            alert(`✅ ${saved} cards salvos!`);
            return saved;
        } catch (e) {
            alert(e.message);
            return 0;
        } finally {
            setAiLoading(false);
        }
    }

    // ====== NOVO: criar cards a partir dos “erros” colados ======
    async function createCardsFromErrorsPaste() {
        if (!deckId) return alert("Entre em um deck.");
        const pairs = parsePairs(errorsPaste);
        if (!pairs.length) {
            return alert('Cole no formato "Pergunta | Resposta" (um por linha).');
        }

        setBulkLoading(true);
        try {
            let saved = 0;
            for (const p of pairs) {
                await callWrite("create_card", {
                    deck_id: deckId,
                    tipo: "normal",
                    pergunta: p.pergunta,
                    resposta: p.resposta,
                    tags: ["erro"],
                });
                saved += 1;
            }

            await loadCards(deckId);

            setErrorsPaste("");
            alert(`✅ ${saved} cards criados a partir dos erros!`);
            return saved;
        } catch (e) {
            alert(e.message);
            return 0;
        } finally {
            setBulkLoading(false);
        }
    }

    const showBack = level !== "courses";
    const title = LEVEL_LABEL[level];

    const canCreate =
        editMode &&
        newName.trim() &&
        (level === "courses" ||
            (level === "disciplines" && courseId) ||
            (level === "subjects" && disciplineId) ||
            (level === "topics" && subjectId && !isLegacySubjects) ||
            (level === "decks" && (isLegacySubjects ? subjectId : topicId)));

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                    <Brain size={18} /> Flashcards
                </h2>

                <button
                    onClick={() => setEditMode((v) => !v)}
                    className="px-3 py-2 rounded-lg bg-cyan-600 text-white flex items-center gap-2"
                >
                    <Pencil size={16} /> {editMode ? "Sair da edição" : "Modo edição"}
                </button>
            </div>

            {/* Breadcrumb + back */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-600 flex-wrap">
                    {breadcrumb.map((b, idx) => (
                        <span key={b.key} className={b.key === level ? "text-slate-900 font-semibold" : ""}>
                            {idx > 0 ? " / " : ""}
                            {b.label}
                        </span>
                    ))}
                </div>

                {showBack && (
                    <button onClick={goBack} className="px-3 py-2 rounded-lg border flex items-center gap-2">
                        <ChevronLeft size={16} /> Voltar
                    </button>
                )}
            </div>

            {/* Create item on this level */}
            {editMode && level !== "cards" && (
                <div className="flex gap-2">
                    <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder={`Novo ${title.slice(0, -1)}...`}
                        className="w-full px-3 py-2 rounded-lg border"
                    />
                    <button
                        onClick={createHere}
                        disabled={!canCreate}
                        className="px-3 py-2 rounded-lg border disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Adicionar"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            )}

            {/* Main container */}
            <div className="rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{title}</h3>
                    {loading && <span className="text-sm text-slate-500">Carregando...</span>}
                </div>

                {/* ===== LISTAS DOS NÍVEIS ===== */}
                {level !== "cards" ? (
                    !currentList.length ? (
                        <p className="text-sm text-slate-500">Nada por aqui ainda.</p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {currentList.map((item) => {
                                const next = nextLevelForCurrent();
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => next && enter(next, item.id)}
                                        className="text-left p-4 rounded-xl border hover:bg-slate-50 transition relative"
                                    >
                                        <div className="font-semibold pr-10">{item.nome}</div>
                                        <div className="text-xs text-slate-500 mt-1">Clique para abrir</div>

                                        {editMode && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteHere(item.id, item.nome);
                                                }}
                                                className="absolute top-3 right-3 px-2 py-1 rounded-md border bg-white hover:bg-slate-100"
                                                title="Apagar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )
                ) : (
                    // ===== CARDS SCREEN =====
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-600">
                                Deck: <span className="font-semibold">{selectedDeck?.nome || "-"}</span>
                            </div>

                            {/* ✅ Só aparece se estiver em modo edição */}
                            {editMode && (
                                <button
                                    onClick={() => {
                                        setCreateCardsOpen(true);
                                        setCreateMode("");
                                    }}
                                    className="px-3 py-2 rounded-lg bg-slate-900 text-white"
                                >
                                    Criar cards
                                </button>
                            )}
                        </div>

                        {/* Lista sempre visível */}
                        <div className="rounded-xl border p-4">
                            <h4 className="font-semibold mb-2">Cards deste deck</h4>
                            {!tree.cards.length ? (
                                <p className="text-sm text-slate-500">Nenhum card ainda.</p>
                            ) : (
                                <ul className="space-y-2 max-h-[380px] overflow-y-auto">
                                    {tree.cards.map((card) => (
                                        <li key={card.id} className="border rounded-lg p-3">
                                            <p className="font-medium">{card.pergunta}</p>
                                            <p className="text-sm text-slate-600 mt-1">{card.resposta}</p>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* ===== MODAL CRIAR CARDS ===== */}
                        {createCardsOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                                <div className="w-full max-w-2xl rounded-2xl bg-white p-4 border shadow-lg space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-semibold">Como você quer criar os cards?</h4>
                                        <button
                                            onClick={() => {
                                                setCreateCardsOpen(false);
                                                setCreateMode("");
                                            }}
                                            className="px-3 py-2 rounded-lg border"
                                        >
                                            Fechar
                                        </button>
                                    </div>

                                    {/* Escolha */}
                                    {!createMode && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                            <button
                                                onClick={() => setCreateMode("manual")}
                                                className="p-4 rounded-xl border hover:bg-slate-50 text-left"
                                            >
                                                <div className="font-semibold">Manual</div>
                                                <div className="text-xs text-slate-500 mt-1">Você escreve pergunta e resposta</div>
                                            </button>

                                            <button
                                                onClick={() => setCreateMode("errors")}
                                                className="p-4 rounded-xl border hover:bg-slate-50 text-left"
                                            >
                                                <div className="font-semibold">A partir dos erros</div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    Cole “Pergunta | Resposta” (um por linha)
                                                </div>
                                            </button>

                                            <button
                                                onClick={() => setCreateMode("ai")}
                                                className="p-4 rounded-xl border hover:bg-slate-50 text-left"
                                            >
                                                <div className="font-semibold flex items-center gap-2">
                                                    <Sparkles size={16} /> IA
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">Cole um texto e gere automaticamente</div>
                                            </button>
                                        </div>
                                    )}

                                    {/* Manual */}
                                    {createMode === "manual" && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="font-semibold">Criar manual</div>
                                                <button onClick={() => setCreateMode("")} className="text-sm underline">
                                                    Voltar
                                                </button>
                                            </div>

                                            <input
                                                className="w-full px-3 py-2 rounded-lg border"
                                                placeholder="Pergunta"
                                                value={cardForm.pergunta}
                                                onChange={(e) => setCardForm((p) => ({ ...p, pergunta: e.target.value }))}
                                            />
                                            <textarea
                                                className="w-full px-3 py-2 rounded-lg border min-h-[90px]"
                                                placeholder="Resposta"
                                                value={cardForm.resposta}
                                                onChange={(e) => setCardForm((p) => ({ ...p, resposta: e.target.value }))}
                                            />
                                            <input
                                                className="w-full px-3 py-2 rounded-lg border"
                                                placeholder="tags (separadas por vírgula)"
                                                value={cardForm.tags}
                                                onChange={(e) => setCardForm((p) => ({ ...p, tags: e.target.value }))}
                                            />

                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={async () => {
                                                        await createCard();
                                                        setCreateCardsOpen(false);
                                                        setCreateMode("");
                                                    }}
                                                    className="px-4 py-2 rounded-lg bg-slate-900 text-white"
                                                >
                                                    Salvar card
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* A partir dos erros */}
                                    {createMode === "errors" && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="font-semibold">Criar a partir dos erros</div>
                                                <button onClick={() => setCreateMode("")} className="text-sm underline">
                                                    Voltar
                                                </button>
                                            </div>

                                            <div className="text-sm text-slate-600">
                                                Cole no formato: <span className="font-mono">Pergunta | Resposta</span> (um por linha).
                                            </div>

                                            <textarea
                                                className="w-full px-3 py-2 rounded-lg border min-h-[140px]"
                                                placeholder={`Ex:\nO que é phishing? | É um golpe para roubar dados...\nRansomware faz o quê? | Criptografa arquivos e pede resgate`}
                                                value={errorsPaste}
                                                onChange={(e) => setErrorsPaste(e.target.value)}
                                            />

                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={async () => {
                                                        const saved = await createCardsFromErrorsPaste();
                                                        if (saved > 0) {
                                                            setCreateCardsOpen(false);
                                                            setCreateMode("");
                                                        }
                                                    }}
                                                    disabled={bulkLoading}
                                                    className="px-4 py-2 rounded-lg bg-slate-900 text-white disabled:opacity-60"
                                                >
                                                    {bulkLoading ? "Criando..." : "Criar cards"}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* IA */}
                                    {createMode === "ai" && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="font-semibold">Gerar por IA</div>
                                                <button onClick={() => setCreateMode("")} className="text-sm underline">
                                                    Voltar
                                                </button>
                                            </div>

                                            <textarea
                                                className="w-full min-h-[130px] px-3 py-2 rounded-lg border"
                                                placeholder="Cole aqui o texto base para gerar flashcards..."
                                                value={aiForm.text}
                                                onChange={(e) => setAiForm((p) => ({ ...p, text: e.target.value }))}
                                            />

                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="number"
                                                    min="3"
                                                    max="30"
                                                    className="px-3 py-2 rounded-lg border"
                                                    value={aiForm.qtd}
                                                    onChange={(e) => setAiForm((p) => ({ ...p, qtd: e.target.value }))}
                                                />
                                                <select
                                                    className="px-3 py-2 rounded-lg border"
                                                    value={aiForm.aggressiveness}
                                                    onChange={(e) => setAiForm((p) => ({ ...p, aggressiveness: e.target.value }))}
                                                >
                                                    <option value="prova">Prova</option>
                                                    <option value="medio">Médio</option>
                                                    <option value="longo">Longo prazo</option>
                                                </select>
                                            </div>

                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={async () => {
                                                        const saved = await generateWithAI();
                                                        if (saved > 0) {
                                                            setCreateCardsOpen(false);
                                                            setCreateMode("");
                                                        }
                                                    }}
                                                    disabled={aiLoading}
                                                    className="px-4 py-2 rounded-lg bg-cyan-600 text-white disabled:opacity-60"
                                                >
                                                    {aiLoading ? "Gerando..." : "Gerar com IA"}
                                                </button>
                                            </div>

                                            <div className="text-xs text-slate-500">
                                                Dica: cole um trecho com definições, listas e exemplos (quanto mais estruturado, melhor).
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}