import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { CheckCircle2, ChevronLeft, Pencil, Plus, Sparkles, Trash2, Upload, XCircle } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

// ✅ worker do pdfjs (Vite/React)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.js",
    import.meta.url
).toString();

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

// ====== “Gerar card por linha” (colando Pergunta | Resposta) ======
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

// ====== UI ======
const ui = {
    wrap: "w-full max-w-3xl mx-auto",
    headerTitle: "text-2xl font-black text-slate-900 dark:text-white",
    headerSub: "text-sm text-slate-500 dark:text-slate-400",

    btnEdit:
        "flex items-center gap-2 px-4 py-2 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white transition font-black text-xs",
    btnBack:
        "flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition font-black text-xs",
    btnPrimary:
        "flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white transition font-black text-xs disabled:opacity-60 disabled:cursor-not-allowed",
    btnDark:
        "px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white transition font-black text-xs disabled:opacity-60 disabled:cursor-not-allowed",
    btnGhost:
        "px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition font-black text-xs disabled:opacity-60 disabled:cursor-not-allowed",

    panel:
        "p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl",
    panelSoft:
        "p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm",

    tile:
        "w-full text-left flex items-center justify-between p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-800/60 transition",
    tileTitle: "text-base font-black text-slate-900 dark:text-white",
    tileMeta: "text-xs text-slate-500 dark:text-slate-400 font-bold",
    iconMuted: "text-slate-400",

    input:
        "mt-2 w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none placeholder:text-slate-500 dark:placeholder:text-slate-500",
    textarea:
        "mt-2 w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none placeholder:text-slate-500 dark:placeholder:text-slate-500 min-h-[110px]",

    overlay: "fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4",
    modal:
        "w-full max-w-2xl p-6 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl",
    modalCard:
        "p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-left",
    modalTitle: "text-lg font-black text-slate-900 dark:text-white",
    modalText: "text-xs text-slate-500 dark:text-slate-400 font-bold",
};

export default function Flashcards({ user }) {
    const userId = user?.id;

    const [level, setLevel] = useState("courses");

    const [courseId, setCourseId] = useState("");
    const [disciplineId, setDisciplineId] = useState("");
    const [subjectId, setSubjectId] = useState("");
    const [topicId, setTopicId] = useState("");
    const [deckId, setDeckId] = useState("");

    const [isLegacySubjects, setIsLegacySubjects] = useState(false);

    const [tree, setTree] = useState(initialTree);

    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    const [editMode, setEditMode] = useState(false);
    const [newName, setNewName] = useState("");

    const [cardForm, setCardForm] = useState({ pergunta: "", resposta: "", tags: "" });
    const [aiForm, setAiForm] = useState({ text: "", qtd: 12, aggressiveness: "medio" });

    const [createCardsOpen, setCreateCardsOpen] = useState(false);
    const [createMode, setCreateMode] = useState("");
    const [errorsPaste, setErrorsPaste] = useState("");
    const [bulkLoading, setBulkLoading] = useState(false);

    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfInfo, setPdfInfo] = useState("");
    const [studyIndex, setStudyIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [wrongCards, setWrongCards] = useState([]);
    const [rightCards, setRightCards] = useState([]);

    const selectedDeck = useMemo(
        () => tree.decks.find((d) => d.id === deckId),
        [tree.decks, deckId]
    );

    useEffect(() => {
        setStudyIndex(0);
        setShowAnswer(false);
        setWrongCards([]);
        setRightCards([]);
    }, [deckId, tree.cards.length]);

    const breadcrumb = useMemo(() => {
        const parts = [{ key: "courses", label: "Cursos" }];

        if (courseId) parts.push({ key: "disciplines", label: "Disciplinas" });
        if (disciplineId) parts.push({ key: "subjects", label: "Assuntos" });

        if (!isLegacySubjects && subjectId) parts.push({ key: "topics", label: "Tópicos" });

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

    // ✅ CORRIGIDO: CRUD usa flashcards-write
    async function callWrite(action, payload) {
        const token = await getTokenOrThrow();

        const { data, error } = await supabase.functions.invoke("flashcards-write", {
            body: { action, ...payload },
            headers: { Authorization: `Bearer ${token}` },
        });

        console.log("flashcards-write action:", action);
        console.log("flashcards-write payload:", payload);
        console.log("flashcards-write data:", data);
        console.log("flashcards-write error:", error);

        if (error) {
            const msg =
                error?.context?.body?.error ||
                error?.context?.body?.message ||
                error?.message ||
                "Falha na Edge Function (flashcards-write)";
            throw new Error(msg);
        }

        if (!data?.ok) throw new Error(data?.error || "Falha ao salvar.");
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

    // ✅ Topic dentro de subject: filtra por subject_id
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

    // ✅ Deck: sempre por topic_id (e opcional por subject_id)
    const loadDecks = useCallback(
        async (baseId, mode = "topic") => {
            setLoading(true);
            try {
                let q = supabase
                    .from("flash_decks")
                    .select("id,name,topic_id,subject_id,created_at")
                    .eq("user_id", userId);

                if (mode === "topic") q = q.eq("topic_id", baseId);
                if (mode === "subject") q = q.eq("subject_id", baseId);

                const res = await q.order("created_at", { ascending: false });
                setTree((p) => ({ ...p, decks: (res.data || []).map(normalizeNameRow) }));
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

        setCreateCardsOpen(false);
        setCreateMode("");
        setErrorsPaste("");

        setPdfInfo("");
        setPdfLoading(false);

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
            setTree((p) => ({ ...p, disciplines: [], subjects: [], topics: [], decks: [], cards: [] }));
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

    async function enter(nextLevel, id) {
        setNewName("");
        setCreateCardsOpen(false);
        setCreateMode("");
        setErrorsPaste("");
        setPdfInfo("");

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
                clearBelow("decks");
                setLevel("decks");
                await loadDecks(id, "topic"); // legacy: subjectId é topicId
                return;
            }

            setTopicId(id);
            clearBelow("decks");
            setLevel("decks");
            await loadDecks(id, "topic");
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

    function goBack() {
        setNewName("");
        setCreateCardsOpen(false);
        setCreateMode("");
        setErrorsPaste("");
        setPdfInfo("");

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

    const currentList = useMemo(() => {
        if (level === "courses") return tree.courses;
        if (level === "disciplines") return tree.disciplines;
        if (level === "subjects") return tree.subjects;
        if (level === "topics") return tree.topics;
        if (level === "decks") return tree.decks;
        return [];
    }, [level, tree]);

    function nextLevelForCurrent() {
        if (level === "courses") return "disciplines";
        if (level === "disciplines") return "subjects";
        if (level === "subjects") return isLegacySubjects ? "decks" : "topics";
        if (level === "topics") return "decks";
        if (level === "decks") return "cards";
        return null;
    }

    async function createHere() {
        const name = newName.trim();
        if (!name) return;

        try {
            if (level === "courses") {
                await callWrite("create_course", { name });
                setNewName("");
                await loadCourses();
                return;
            }

            if (level === "disciplines") {
                if (!courseId) return alert("Selecione um curso.");
                await callWrite("create_discipline", { name, course_id: courseId });
                setNewName("");
                await loadDisciplines(courseId);
                return;
            }

            if (level === "subjects") {
                if (!disciplineId) return alert("Selecione uma disciplina.");

                if (isLegacySubjects) {
                    await callWrite("create_topic_legacy", { name, discipline_id: disciplineId });
                    setNewName("");
                    await loadSubjects(disciplineId);
                    return;
                }

                await callWrite("create_subject", { name, discipline_id: disciplineId });
                setNewName("");
                await loadSubjects(disciplineId);
                return;
            }

            if (level === "topics") {
                if (!subjectId) return alert("Selecione um assunto.");
                await callWrite("create_topic", { name, subject_id: subjectId });
                setNewName("");
                await loadTopics(subjectId);
                return;
            }

            if (level === "decks") {
                // ✅ modo novo: deck por topicId
                // ✅ legado: a seleção de "assunto" já representa um topic_id
                const targetTopicId = isLegacySubjects ? subjectId : topicId;
                if (!targetTopicId) return alert("Selecione um tópico.");

                await callWrite("create_deck", {
                    name,
                    topic_id: targetTopicId,
                    subject_id: isLegacySubjects ? null : subjectId || null,
                });

                setNewName("");
                await loadDecks(targetTopicId, "topic");
                return;
            }
        } catch (e) {
            alert(e.message);
        }
    }

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
                await loadDecks(topicId, "topic");
            }
        } catch (e) {
            alert(e.message);
        }
    }

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

    // IA continua separada: chama generate-flashcards
    async function generateWithAI() {
        if (!deckId) return alert("Entre em um deck antes de gerar por IA.");
        if (!aiForm.text.trim()) return alert("Cole um texto base para a IA.");

        setAiLoading(true);
        try {
            const token = await getTokenOrThrow();

            const { data, error } = await supabase.functions.invoke("generate-flashcards", {
                body: {
                    text: aiForm.text,
                    qtd: Number(aiForm.qtd || 12),
                    aggressiveness: aiForm.aggressiveness,
                },
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
                const pergunta = String(c.pergunta || c.front || "").trim();
                const resposta = String(c.resposta || c.back || "").trim();
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

    async function createCardsFromErrorsPaste() {
        if (!deckId) return alert("Entre em um deck.");
        const pairs = parsePairs(errorsPaste);
        if (!pairs.length) return alert('Cole no formato "Pergunta | Resposta" (um por linha).');

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

    async function marcarResultado(card, acertou) {
        if (!card?.id || !userId) return;

        await supabase
            .from("flash_card_reviews")
            .insert([{ user_id: userId, card_id: card.id, resultado: acertou ? "acerto" : "erro" }]);

        if (acertou) {
            setRightCards((prev) => {
                if (prev.some((c) => c.id === card.id)) return prev;
                return [...prev, card];
            });
        } else {
            setWrongCards((prev) => {
                if (prev.some((c) => c.id === card.id)) return prev;
                return [...prev, card];
            });
        }

        setShowAnswer(false);
        setStudyIndex((prev) => Math.min(prev + 1, Math.max(0, tree.cards.length)));
    }

    async function criarDeckComErros() {
        const cardsErro = wrongCards;
        if (!cardsErro.length) return alert("Você ainda não marcou erros nesta rodada.");

        const targetTopicId = selectedDeck?.topic_id || (isLegacySubjects ? subjectId : topicId);
        if (!targetTopicId) return alert("Não consegui identificar o tópico deste deck.");

        const errorsDeckName = `🚨 Erros: ${selectedDeck?.nome || "Deck"}`;
        let errorDeckId = "";

        try {
            const { data: sameTopicDecks } = await supabase
                .from("flash_decks")
                .select("id,nome,name")
                .eq("user_id", userId)
                .eq("topic_id", targetTopicId);

            const existing = (sameTopicDecks || []).find((d) => (d.nome || d.name) === errorsDeckName);
            if (existing?.id) {
                errorDeckId = existing.id;
            } else {
                errorDeckId = await callWrite("create_deck", {
                    name: errorsDeckName,
                    topic_id: targetTopicId,
                    subject_id: isLegacySubjects ? null : subjectId || null,
                });
            }

            const { data: existingCards } = await supabase
                .from("flash_cards")
                .select("pergunta,resposta")
                .eq("user_id", userId)
                .eq("deck_id", errorDeckId);

            const existingKey = new Set((existingCards || []).map((c) => `${c.pergunta}__${c.resposta}`));
            const toInsert = cardsErro
                .filter((c) => !existingKey.has(`${c.pergunta}__${c.resposta}`))
                .map((c) => ({
                    user_id: userId,
                    deck_id: errorDeckId,
                    tipo: "normal",
                    pergunta: c.pergunta,
                    resposta: c.resposta,
                    tags: Array.from(new Set([...(Array.isArray(c.tags) ? c.tags : []), "erro"])).slice(0, 8),
                }));

            if (toInsert.length) {
                const { error } = await supabase.from("flash_cards").insert(toInsert);
                if (error) throw error;
            }

            alert(`✅ Deck de erros atualizado: ${toInsert.length} card(s) adicionados.`);
        } catch (e) {
            alert(e.message || "Não consegui criar o deck de erros.");
        }
    }

    async function handlePdfUpload(file) {
        if (!file) return;
        if (file.type !== "application/pdf") return alert("Envie um arquivo PDF.");

        setPdfLoading(true);
        setPdfInfo(`Lendo PDF: ${file.name}...`);

        try {
            const ab = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: ab }).promise;

            let text = "";
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const content = await page.getTextContent();
                const strings = content.items.map((it) => it.str);
                text += strings.join(" ") + "\n";
            }

            const cleaned = text.replace(/\s+/g, " ").trim();
            const maxChars = 15000;
            const clipped = cleaned.slice(0, maxChars);

            setAiForm((p) => ({ ...p, text: clipped }));
            setPdfInfo(`✅ PDF carregado (${pdf.numPages} páginas). Texto extraído e aplicado.`);
        } catch (e) {
            console.error(e);
            alert("Não consegui ler esse PDF. Tente outro arquivo (ou um PDF com texto selecionável).");
            setPdfInfo("");
        } finally {
            setPdfLoading(false);
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
        <div className={ui.wrap}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className={ui.headerTitle}>Flashcards</h2>
                    <p className={ui.headerSub}>Cursos → disciplinas → assuntos → tópicos → decks → cards</p>
                </div>

                <button onClick={() => setEditMode((v) => !v)} className={ui.btnEdit}>
                    <Pencil size={16} /> {editMode ? "Sair da edição" : "Modo edição"}
                </button>
            </div>

            <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 flex-wrap font-bold">
                    {[...breadcrumb].map((b, idx) => (
                        <span key={b.key} className={b.key === level ? "text-slate-900 dark:text-white font-black" : ""}>
                            {idx > 0 ? " / " : ""}
                            {b.label}
                        </span>
                    ))}
                </div>

                {showBack && (
                    <button onClick={goBack} className={ui.btnBack}>
                        <ChevronLeft size={16} /> Voltar
                    </button>
                )}
            </div>

            {editMode && level !== "cards" && (
                <div className={`${ui.panelSoft} mb-4`}>
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Criar em: {title}
                    </label>

                    <div className="flex gap-2 mt-3">
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder={`Novo ${title.slice(0, -1)}...`}
                            className={ui.input.replace("mt-2 ", "")}
                        />

                        <button onClick={createHere} disabled={!canCreate} className={ui.btnGhost} title="Adicionar">
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
            )}

            <div className={ui.panel}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{title}</h3>
                    {loading && (
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-bold animate-pulse">
                            Carregando...
                        </span>
                    )}
                </div>

                {level !== "cards" ? (
                    !currentList.length ? (
                        <div className="p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
                            <p className="font-black text-slate-700 dark:text-slate-200">Nada por aqui ainda.</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                Use o modo edição para criar itens.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {currentList.map((item) => {
                                const next = nextLevelForCurrent();
                                return (
                                    <button key={item.id} onClick={() => next && enter(next, item.id)} className={ui.tile}>
                                        <div className="flex items-center gap-3 text-left">
                                            <div>
                                                <p className={ui.tileTitle}>{item.nome}</p>
                                                <p className={ui.tileMeta}>Clique para abrir</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {editMode && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteHere(item.id, item.nome);
                                                    }}
                                                    className={ui.btnGhost}
                                                    title="Apagar"
                                                >
                                                    <Trash2 size={16} className="text-slate-600 dark:text-slate-200" />
                                                </button>
                                            )}
                                            <span className={ui.iconMuted}>›</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-500 dark:text-slate-400 font-bold">
                                Deck:{" "}
                                <span className="text-slate-900 dark:text-white font-black">{selectedDeck?.nome || "-"}</span>
                            </div>

                            {editMode && (
                                <button
                                    onClick={() => {
                                        setCreateCardsOpen(true);
                                        setCreateMode("");
                                        setPdfInfo("");
                                    }}
                                    className={ui.btnDark}
                                >
                                    Criar cards
                                </button>
                            )}
                        </div>

                        <div className={ui.panelSoft}>
                            <h4 className="text-base font-black text-slate-900 dark:text-white mb-3">Cards deste deck</h4>

                            {!tree.cards.length ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">Nenhum card ainda.</p>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                                        <span>
                                            Pergunta {Math.min(studyIndex + 1, tree.cards.length)}/{tree.cards.length}
                                        </span>
                                        <span className="flex items-center gap-3">
                                            <span>Acertos: {rightCards.length}</span>
                                            <span>Erros: {wrongCards.length}</span>
                                        </span>
                                    </div>

                                    {tree.cards[studyIndex] ? (
                                        <button
                                            onClick={() => setShowAnswer((v) => !v)}
                                            className="w-full [perspective:1000px]"
                                            type="button"
                                        >
                                            <div
                                                className="relative min-h-[220px] rounded-3xl border border-slate-200 dark:border-slate-800 transition-transform duration-500 [transform-style:preserve-3d]"
                                                style={{ transform: showAnswer ? "rotateY(180deg)" : "rotateY(0deg)" }}
                                            >
                                                <div className="absolute inset-0 p-6 rounded-3xl bg-white dark:bg-slate-900 [backface-visibility:hidden] flex flex-col justify-center">
                                                    <span className="text-[11px] uppercase tracking-widest text-slate-500 font-black">Pergunta</span>
                                                    <p className="text-lg md:text-xl font-black text-slate-900 dark:text-white mt-3">{tree.cards[studyIndex].pergunta}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 font-bold">Clique para virar o card</p>
                                                </div>
                                                <div className="absolute inset-0 p-6 rounded-3xl bg-slate-900 text-white [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col justify-center">
                                                    <span className="text-[11px] uppercase tracking-widest text-slate-300 font-black">Resposta</span>
                                                    <p className="text-lg md:text-xl font-black mt-3">{tree.cards[studyIndex].resposta}</p>
                                                    <p className="text-xs text-slate-300 mt-4 font-bold">Clique novamente para voltar</p>
                                                </div>
                                            </div>
                                        </button>
                                    ) : (
                                        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center">
                                            <p className="font-black text-slate-900 dark:text-white">Você terminou os cards desta rodada 🎉</p>
                                            <button
                                                onClick={() => {
                                                    setStudyIndex(0);
                                                    setRightCards([]);
                                                    setWrongCards([]);
                                                }}
                                                className="mt-3 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-black text-xs"
                                            >
                                                Recomeçar rodada
                                            </button>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => tree.cards[studyIndex] && marcarResultado(tree.cards[studyIndex], false)}
                                            disabled={!tree.cards[studyIndex]}
                                            className="px-4 py-3 rounded-2xl bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50 transition font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={16} /> Errei
                                        </button>
                                        <button
                                            onClick={() => tree.cards[studyIndex] && marcarResultado(tree.cards[studyIndex], true)}
                                            disabled={!tree.cards[studyIndex]}
                                            className="px-4 py-3 rounded-2xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle2 size={16} /> Acertei
                                        </button>
                                    </div>

                                    {editMode && (
                                        <button
                                            onClick={criarDeckComErros}
                                            disabled={!wrongCards.length}
                                            className="w-full px-4 py-3 rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Criar/atualizar deck com os erros desta rodada
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {createCardsOpen && (
                            <div className={ui.overlay}>
                                <div className={ui.modal}>
                                    <div className="flex items-center justify-between">
                                        <h4 className={ui.modalTitle}>Como você quer criar os cards?</h4>
                                        <button
                                            onClick={() => {
                                                setCreateCardsOpen(false);
                                                setCreateMode("");
                                                setPdfInfo("");
                                            }}
                                            className={ui.btnBack}
                                        >
                                            Fechar
                                        </button>
                                    </div>

                                    {!createMode && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                                            <button onClick={() => setCreateMode("manual")} className={ui.modalCard}>
                                                <div className="font-black text-slate-900 dark:text-white">Manual</div>
                                                <div className={ui.modalText}>Você escreve pergunta e resposta</div>
                                            </button>

                                            <button onClick={() => setCreateMode("errors")} className={ui.modalCard}>
                                                <div className="font-black text-slate-900 dark:text-white">Gerar card por linha</div>
                                                <div className={ui.modalText}>Cole “Pergunta | Resposta” (1 por linha)</div>
                                            </button>

                                            <button onClick={() => setCreateMode("ai")} className={ui.modalCard}>
                                                <div className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                                                    <Sparkles size={16} /> IA
                                                </div>
                                                <div className={ui.modalText}>Cole um texto ou use PDF</div>
                                            </button>
                                        </div>
                                    )}

                                    {createMode === "manual" && (
                                        <div className="mt-4">
                                            <div className="flex items-center justify-between">
                                                <div className="font-black text-slate-900 dark:text-white">Criar manual</div>
                                                <button
                                                    onClick={() => setCreateMode("")}
                                                    className="text-sm font-black underline text-slate-600 dark:text-slate-300"
                                                >
                                                    Voltar
                                                </button>
                                            </div>

                                            <input
                                                className={ui.input}
                                                placeholder="Pergunta"
                                                value={cardForm.pergunta}
                                                onChange={(e) => setCardForm((p) => ({ ...p, pergunta: e.target.value }))}
                                            />
                                            <textarea
                                                className={ui.textarea}
                                                placeholder="Resposta"
                                                value={cardForm.resposta}
                                                onChange={(e) => setCardForm((p) => ({ ...p, resposta: e.target.value }))}
                                            />
                                            <input
                                                className={ui.input}
                                                placeholder="tags (separadas por vírgula)"
                                                value={cardForm.tags}
                                                onChange={(e) => setCardForm((p) => ({ ...p, tags: e.target.value }))}
                                            />

                                            <div className="flex justify-end mt-4">
                                                <button
                                                    onClick={async () => {
                                                        await createCard();
                                                        setCreateCardsOpen(false);
                                                        setCreateMode("");
                                                        setPdfInfo("");
                                                    }}
                                                    className={ui.btnPrimary}
                                                >
                                                    Salvar card
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {createMode === "errors" && (
                                        <div className="mt-4">
                                            <div className="flex items-center justify-between">
                                                <div className="font-black text-slate-900 dark:text-white">Gerar card por linha</div>
                                                <button
                                                    onClick={() => setCreateMode("")}
                                                    className="text-sm font-black underline text-slate-600 dark:text-slate-300"
                                                >
                                                    Voltar
                                                </button>
                                            </div>

                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-bold mt-3">
                                                Formato: <span className="font-mono">Pergunta | Resposta</span> (um por linha)
                                            </p>

                                            <textarea
                                                className={ui.textarea}
                                                placeholder={`Ex:\nO que é phishing? | É um golpe para roubar dados...\nRansomware faz o quê? | Criptografa arquivos e pede resgate`}
                                                value={errorsPaste}
                                                onChange={(e) => setErrorsPaste(e.target.value)}
                                            />

                                            <div className="flex justify-end mt-4">
                                                <button
                                                    onClick={async () => {
                                                        const saved = await createCardsFromErrorsPaste();
                                                        if (saved > 0) {
                                                            setCreateCardsOpen(false);
                                                            setCreateMode("");
                                                            setPdfInfo("");
                                                        }
                                                    }}
                                                    disabled={bulkLoading}
                                                    className={ui.btnDark}
                                                >
                                                    {bulkLoading ? "Criando..." : "Criar cards"}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {createMode === "ai" && (
                                        <div className="mt-4">
                                            <div className="flex items-center justify-between">
                                                <div className="font-black text-slate-900 dark:text-white">Gerar por IA</div>
                                                <button
                                                    onClick={() => setCreateMode("")}
                                                    className="text-sm font-black underline text-slate-600 dark:text-slate-300"
                                                >
                                                    Voltar
                                                </button>
                                            </div>

                                            <div className="mt-3 flex flex-col gap-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                                    Opcional: enviar PDF
                                                </label>

                                                <div className="flex items-center gap-2">
                                                    <label className={`${ui.btnGhost} cursor-pointer`}>
                                                        <input
                                                            type="file"
                                                            accept="application/pdf"
                                                            className="hidden"
                                                            onChange={(e) => handlePdfUpload(e.target.files?.[0])}
                                                        />
                                                        <span className="flex items-center gap-2">
                                                            <Upload size={16} /> {pdfLoading ? "Lendo..." : "Selecionar PDF"}
                                                        </span>
                                                    </label>

                                                    {pdfInfo ? (
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">{pdfInfo}</span>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <textarea
                                                className={ui.textarea}
                                                placeholder="Cole aqui o texto base para gerar flashcards (ou carregue um PDF acima)..."
                                                value={aiForm.text}
                                                onChange={(e) => setAiForm((p) => ({ ...p, text: e.target.value }))}
                                            />

                                            <div className="grid grid-cols-2 gap-3 mt-3">
                                                <input
                                                    type="number"
                                                    min="3"
                                                    max="30"
                                                    className={ui.input.replace("mt-2 ", "")}
                                                    value={aiForm.qtd}
                                                    onChange={(e) => setAiForm((p) => ({ ...p, qtd: e.target.value }))}
                                                />
                                                <select
                                                    className={ui.input.replace("mt-2 ", "")}
                                                    value={aiForm.aggressiveness}
                                                    onChange={(e) => setAiForm((p) => ({ ...p, aggressiveness: e.target.value }))}
                                                >
                                                    <option value="prova">Prova</option>
                                                    <option value="medio">Médio</option>
                                                    <option value="longo">Longo prazo</option>
                                                </select>
                                            </div>

                                            <div className="flex justify-end mt-4">
                                                <button
                                                    onClick={async () => {
                                                        const saved = await generateWithAI();
                                                        if (saved > 0) {
                                                            setCreateCardsOpen(false);
                                                            setCreateMode("");
                                                            setPdfInfo("");
                                                        }
                                                    }}
                                                    disabled={aiLoading}
                                                    className={ui.btnEdit}
                                                >
                                                    {aiLoading ? "Gerando..." : "Gerar com IA"}
                                                </button>
                                            </div>

                                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-3">
                                                Se o PDF for scan/imagem, o texto pode não sair (aí precisa OCR).
                                            </p>
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
