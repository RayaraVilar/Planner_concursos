import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
    Sparkles,
    Plus,
    RefreshCw,
    UploadCloud,
    X,
    Star,
    StarOff,
    SkipForward,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Loader2,
    BookOpen,
    Layers,
} from "lucide-react";

/* =========================================================
   Helpers
========================================================= */

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

function classNames(...arr) {
    return arr.filter(Boolean).join(" ");
}

function safeSplitTags(text) {
    return String(text || "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12);
}

// ✅ Extrair texto de PDF no browser (frontend)
async function extractTextFromPDF(file) {
    const pdfjs = await import("pdfjs-dist/build/pdf");
    try {
        const worker = await import("pdfjs-dist/build/pdf.worker.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    } catch {
        // ok
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = "";
    const maxPages = Math.min(pdf.numPages, 12); // ✅ limite pra economizar tokens
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const strings = content.items.map((item) => item.str).join(" ");
        fullText += strings + "\n";
    }
    return fullText;
}

// ✅ Extrair texto de DOCX no browser (frontend)
async function extractTextFromDOCX(file) {
    const mammoth = await import("mammoth/mammoth.browser");
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value || "";
}

/* =========================================================
   Componente
========================================================= */

export default function Flashcards({ user }) {
    const [aba, setAba] = useState("biblioteca"); // biblioteca | estudar

    // filtros (curso > disciplina > assunto > deck)
    const [courses, setCourses] = useState([]);
    const [disciplines, setDisciplines] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [decks, setDecks] = useState([]);

    const [courseId, setCourseId] = useState("");
    const [disciplineId, setDisciplineId] = useState("");
    const [subjectId, setSubjectId] = useState("");
    const [deckId, setDeckId] = useState("");

    // cards do deck selecionado
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingDeck, setLoadingDeck] = useState(false);

    // modais
    const [openDeckModal, setOpenDeckModal] = useState(false);
    const [openCardModal, setOpenCardModal] = useState(false);
    const [openAiModal, setOpenAiModal] = useState(false);

    // ✅ modais novos (criação em cascata)
    const [openCourseModal, setOpenCourseModal] = useState(false);
    const [openDisciplineModal, setOpenDisciplineModal] = useState(false);
    const [openSubjectModal, setOpenSubjectModal] = useState(false);

    // inputs curso/disciplina/assunto
    const [newCourseName, setNewCourseName] = useState("");
    const [newDisciplineName, setNewDisciplineName] = useState("");
    const [newSubjectName, setNewSubjectName] = useState("");

    // Novo Deck
    const [newDeckName, setNewDeckName] = useState("");

    // Novo Card (manual)
    const [cardTipo, setCardTipo] = useState("normal"); // normal | cloze
    const [pergunta, setPergunta] = useState("");
    const [resposta, setResposta] = useState("");
    const [clozeText, setClozeText] = useState("");
    const [clozeAnswer, setClozeAnswer] = useState("");
    const [tagsText, setTagsText] = useState("");

    // IA
    const [aiQtd, setAiQtd] = useState(20);
    const [aiAgg, setAiAgg] = useState("medio"); // prova | medio | longo
    const [aiText, setAiText] = useState("");
    const [aiFile, setAiFile] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const fileInputRef = useRef(null);

    // Estudo
    const [studyIndex, setStudyIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);

    // stats
    const [stats, setStats] = useState({
        total: 0,
        acertos: 0,
        erros: 0,
        duvidas: 0,
        favoritos: 0,
        taxaAcerto: 0,
        cardsComErro1x: 0,
        cardsComErro2x: 0,
    });

    const [reviewCounts, setReviewCounts] = useState({});
    const [creatingErrorDeck, setCreatingErrorDeck] = useState(false);
    const [hasReviewTable, setHasReviewTable] = useState(true);



    const deckSelecionado = useMemo(
        () => decks.find((d) => d.id === deckId),
        [decks, deckId]
    );

    const cursoSelecionado = useMemo(
        () => courses.find((c) => c.id === courseId),
        [courses, courseId]
    );
    const disciplinaSelecionada = useMemo(
        () => disciplines.find((d) => d.id === disciplineId),
        [disciplines, disciplineId]
    );
    const assuntoSelecionado = useMemo(
        () => subjects.find((s) => s.id === subjectId),
        [subjects, subjectId]
    );

    /* =========================================================
       Carregar curso/disciplinas/assuntos/decks
    ========================================================= */

    useEffect(() => {
        if (!user?.id) return;
        fetchCourses();
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;
        (async () => {
            const { error } = await supabase.from("flash_card_reviews").select("card_id", { count: "exact", head: true }).limit(1);
            if (error) {
                console.warn("flash_card_reviews indisponível, usando fallback em flash_cards", error.message);
                setHasReviewTable(false);
                return;
            }
            setHasReviewTable(true);
        })();
    }, [user?.id]);

    useEffect(() => {
        if (!courseId) {
            setDisciplines([]);
            setDisciplineId("");
            setSubjects([]);
            setSubjectId("");
            setDecks([]);
            setDeckId("");
            return;
        }
        fetchDisciplines(courseId);
    }, [courseId]);

    useEffect(() => {
        if (!disciplineId) {
            setSubjects([]);
            setSubjectId("");
            setDecks([]);
            setDeckId("");
            return;
        }
        fetchSubjects(disciplineId);
    }, [disciplineId]);

    useEffect(() => {
        if (!subjectId) {
            setDecks([]);
            setDeckId("");
            return;
        }
        fetchDecks(subjectId);
    }, [subjectId]);

    useEffect(() => {
        if (!deckId) {
            setCards([]);
            setStats({
                total: 0,
                acertos: 0,
                erros: 0,
                duvidas: 0,
                favoritos: 0,
                taxaAcerto: 0,
                cardsComErro1x: 0,
                cardsComErro2x: 0,
            });
            setReviewCounts({});
            return;
        }
        fetchCards(deckId);
        fetchDeckStats(deckId);
    }, [deckId]);

    async function fetchCourses() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("flash_courses")
                .select("id, name")
                .eq("user_id", user.id)
                .order("name", { ascending: true });

            if (error) throw error;
            setCourses(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function fetchDisciplines(course_id) {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("flash_disciplines")
                .select("id, name, course_id")
                .eq("user_id", user.id)
                .eq("course_id", course_id)
                .order("name", { ascending: true });

            if (error) throw error;
            setDisciplines(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function fetchSubjects(discipline_id) {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("flash_topics")
                .select("id, name, discipline_id")
                .eq("user_id", user.id)
                .eq("discipline_id", discipline_id)
                .order("name", { ascending: true });

            if (error) throw error;
            setSubjects(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function fetchDecks(subject_id) {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("flash_decks")
                .select("id, name, topic_id, created_at")
                .eq("user_id", user.id)
                .eq("topic_id", subject_id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setDecks(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function fetchCards(deck_id) {
        setLoadingDeck(true);
        try {
            const { data, error } = await supabase
                .from("flash_cards")
                .select(
                    "id, deck_id, tipo, pergunta, resposta, cloze_text, cloze_answer, tags, is_favorite, wrong_total, wrong_streak, created_at"
                )
                .eq("user_id", user.id)
                .eq("deck_id", deck_id)
                .order("created_at", { ascending: true });

            if (error) throw error;
            setCards((data || []).map((card) => ({ ...card, favoritos: !!card.is_favorite })));
            setStudyIndex(0);
            setShowAnswer(false);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingDeck(false);
        }
    }

    async function fetchDeckStats(deck_id) {
        try {
            if (!hasReviewTable) {
                const favoritos = (cards || []).filter((c) => !!c.favoritos).length;
                const cardsComErro1x = (cards || []).filter((c) => (c.wrong_total || 0) >= 1).length;
                const cardsComErro2x = (cards || []).filter((c) => (c.wrong_total || 0) >= 2).length;
                setStats((prev) => ({
                    ...prev,
                    total: cards.length || 0,
                    favoritos,
                    cardsComErro1x,
                    cardsComErro2x,
                }));
                return;
            }

            const { data, error } = await supabase
                .from("flash_card_reviews")
                .select("card_id, resultado")
                .eq("user_id", user.id)
                .eq("deck_id", deck_id);

            if (error) throw error;

            const acertos = (data || []).filter((x) => x.resultado === "acertou").length;
            const erros = (data || []).filter((x) => x.resultado === "errou").length;
            const duvidas = (data || []).filter((x) => x.resultado === "duvida").length;

            const byCard = {};
            for (const item of data || []) {
                const current = byCard[item.card_id] || { acertou: 0, errou: 0, duvida: 0 };
                if (item.resultado === "acertou") current.acertou += 1;
                if (item.resultado === "errou") current.errou += 1;
                if (item.resultado === "duvida") current.duvida += 1;
                byCard[item.card_id] = current;
            }

            setReviewCounts(byCard);

            const cardsComErro1x = Object.values(byCard).filter((x) => x.errou >= 1).length;
            const cardsComErro2x = Object.values(byCard).filter((x) => x.errou >= 2).length;
            const totalRespondidas = acertos + erros + duvidas;
            const taxaAcerto = totalRespondidas ? Math.round((acertos / totalRespondidas) * 100) : 0;
            const favoritos = (cards || []).filter((c) => !!c.favoritos).length;

            setStats({
                total: cards.length || 0,
                acertos,
                erros,
                duvidas,
                favoritos,
                taxaAcerto,
                cardsComErro1x,
                cardsComErro2x,
            });
        } catch {
            // ok
        }
    }

    /* =========================================================
       ✅ CRIAR Curso / Disciplina / Assunto
    ========================================================= */

    async function criarCurso() {
        try {
            const nome = newCourseName.trim();
            if (!nome) return alert("Digite o nome do curso.");

            const { data, error } = await supabase
                .from("flash_courses")
                .insert({ user_id: user.id, name: nome })
                .select("id")
                .single();

            if (error) throw error;

            setOpenCourseModal(false);
            setNewCourseName("");

            await fetchCourses();
            setCourseId(data.id);
        } catch (e) {
            console.error(e);
            alert("Erro ao criar curso. Verifique RLS/tabelas no Supabase.");
        }
    }

    async function criarDisciplina() {
        try {
            if (!courseId) return alert("Selecione um curso primeiro.");

            const nome = newDisciplineName.trim();
            if (!nome) return alert("Digite o nome da disciplina.");

            const { data, error } = await supabase
                .from("flash_disciplines")
                .insert({ user_id: user.id, course_id: courseId, name: nome })
                .select("id")
                .single();

            if (error) throw error;

            setOpenDisciplineModal(false);
            setNewDisciplineName("");

            await fetchDisciplines(courseId);
            setDisciplineId(data.id);
        } catch (e) {
            console.error(e);
            alert("Erro ao criar disciplina. Verifique RLS/tabelas no Supabase.");
        }
    }

    async function criarAssunto() {
        try {
            if (!disciplineId) return alert("Selecione uma disciplina primeiro.");

            const nome = newSubjectName.trim();
            if (!nome) return alert("Digite o nome do assunto.");

            const { data, error } = await supabase
                .from("flash_topics")
                .insert({ user_id: user.id, discipline_id: disciplineId, name: nome })
                .select("id")
                .single();

            if (error) throw error;

            setOpenSubjectModal(false);
            setNewSubjectName("");

            await fetchSubjects(disciplineId);
            setSubjectId(data.id);
        } catch (e) {
            console.error(e);
            alert("Erro ao criar assunto. Verifique RLS/tabelas no Supabase.");
        }
    }

    /* =========================================================
       Criar Deck (manual)
    ========================================================= */

    async function criarDeck() {
        try {
            if (!subjectId) return alert("Selecione um Assunto antes de criar um deck.");
            const nome = newDeckName.trim();
            if (!nome) return alert("Digite um nome para o Deck.");

            const { data, error } = await supabase
                .from("flash_decks")
                .insert({
                    user_id: user.id,
                    topic_id: subjectId,
                    name: nome,
                })
                .select("id")
                .single();

            if (error) throw error;

            setOpenDeckModal(false);
            setNewDeckName("");

            await fetchDecks(subjectId);
            setDeckId(data.id);
        } catch (e) {
            console.error(e);
            alert("Erro ao criar deck. Verifique RLS/tabelas no Supabase.");
        }
    }

    /* =========================================================
       Criar Card (manual)
    ========================================================= */

    async function criarCardManual() {
        try {
            if (!deckId) return alert("Selecione um Deck antes de criar um card.");

            const tags = safeSplitTags(tagsText);

            if (cardTipo === "normal") {
                if (!pergunta.trim() || !resposta.trim()) return alert("Preencha pergunta e resposta.");
            } else {
                if (!clozeText.trim() || !clozeAnswer.trim())
                    return alert("Preencha o texto com cloze e a resposta.");
            }

            const payload =
                cardTipo === "normal"
                    ? {
                        user_id: user.id,
                        deck_id: deckId,
                        tipo: "normal",
                        pergunta: pergunta.trim(),
                        resposta: resposta.trim(),
                        tags,
                        is_favorite: false,
                    }
                    : {
                        user_id: user.id,
                        deck_id: deckId,
                        tipo: "cloze",
                        pergunta: clozeText.trim(),
                        resposta: clozeAnswer.trim(),
                        cloze_text: clozeText.trim(),
                        cloze_answer: clozeAnswer.trim(),
                        tags,
                        is_favorite: false,
                    };

            const { error } = await supabase.from("flash_cards").insert(payload);
            if (error) throw error;

            setOpenCardModal(false);
            resetCardForm();
            await fetchCards(deckId);
            await fetchDeckStats(deckId);
        } catch (e) {
            console.error(e);
            alert("Erro ao criar card. Verifique RLS/tabelas no Supabase.");
        }
    }

    function resetCardForm() {
        setCardTipo("normal");
        setPergunta("");
        setResposta("");
        setClozeText("");
        setClozeAnswer("");
        setTagsText("");
    }

    /* =========================================================
       Favorito (toggle)
    ========================================================= */

    async function toggleFavorito(card) {
        try {
            const { error } = await supabase
                .from("flash_cards")
                .update({ is_favorite: !card.favoritos })
                .eq("id", card.id)
                .eq("user_id", user.id);

            if (error) throw error;

            setCards((prev) =>
                prev.map((c) => (c.id === card.id ? { ...c, favoritos: !c.favoritos } : c))
            );
        } catch (e) {
            console.error(e);
        }
    }

    async function ensureDeckExists(nome) {
        const { data: existing } = await supabase
            .from("flash_decks")
            .select("id")
            .eq("user_id", user.id)
            .eq("topic_id", subjectId)
            .eq("name", nome)
            .maybeSingle();

        if (existing?.id) return existing.id;

        const { data: created, error: createErr } = await supabase
            .from("flash_decks")
            .insert({ user_id: user.id, topic_id: subjectId, name: nome })
            .select("id")
            .single();

        if (createErr) throw createErr;
        await fetchDecks(subjectId);
        return created.id;
    }

    function sameCard(a, b) {
        return (
            a.tipo === b.tipo
            && String(a.pergunta || "") === String(b.pergunta || "")
            && String(a.resposta || "") === String(b.resposta || "")
            && String(a.cloze_text || "") === String(b.cloze_text || "")
            && String(a.cloze_answer || "") === String(b.cloze_answer || "")
        );
    }

    async function criarDeckComErros({ minErros = 1, automatico = false } = {}) {
        try {
            if (!subjectId || !deckId) return alert("Selecione um deck para montar os erros.");

            const cardsComErros = cards.filter((card) => (reviewCounts[card.id]?.errou || 0) >= minErros);
            if (!cardsComErros.length) {
                return alert(`Nenhum card com ${minErros} erro(s) ainda.`);
            }

            setCreatingErrorDeck(true);

            const nomeDeckErro =
                minErros >= 2
                    ? `Erros recorrentes • ${deckSelecionado?.name || "Deck"}`
                    : `Erros (>=1) • ${deckSelecionado?.name || "Deck"}`;

            const deckErroId = await ensureDeckExists(nomeDeckErro);

            const { data: jaNoDeck, error: existingErr } = await supabase
                .from("flash_cards")
                .select("tipo, pergunta, resposta, cloze_text, cloze_answer")
                .eq("user_id", user.id)
                .eq("deck_id", deckErroId);

            if (existingErr) throw existingErr;

            const novos = cardsComErros
                .filter((card) => !(jaNoDeck || []).some((x) => sameCard(card, x)))
                .map((card) => ({
                    user_id: user.id,
                    deck_id: deckErroId,
                    tipo: card.tipo,
                    pergunta: card.pergunta || card.cloze_text || "(sem pergunta)",
                    resposta: card.resposta || card.cloze_answer || "(sem resposta)",
                    cloze_text: card.cloze_text,
                    cloze_answer: card.cloze_answer,
                    tags: Array.isArray(card.tags) ? card.tags : [],
                    is_favorite: false,
                }));

            if (novos.length) {
                const { error: insErr } = await supabase.from("flash_cards").insert(novos);
                if (insErr) throw insErr;
            }

            if (!automatico) {
                alert(`Deck criado/atualizado com ${novos.length} nova(s) questão(ões).`);
            }
        } catch (e) {
            console.error(e);
            if (!automatico) alert("Não foi possível criar o deck de erros.");
        } finally {
            setCreatingErrorDeck(false);
        }
    }

    /* =========================================================
       IA - Geração de cards
    ========================================================= */

    async function handlePickFile(e) {
        const f = e.target.files?.[0];
        if (!f) return;
        setAiFile(f);
    }

    async function gerarComIA() {
        try {
            if (!user?.id) return;

            if (!subjectId && !aiText && !aiFile) {
                alert("Selecione Curso/Disciplina/Assunto OU escreva um resumo OU envie arquivo.");
                return;
            }

            setAiLoading(true);

            // ✅ extrai texto se tiver arquivo
            let extractedText = "";
            if (aiFile) {
                const name = aiFile.name.toLowerCase();

                if (name.endsWith(".pdf")) extractedText = await extractTextFromPDF(aiFile);
                else if (name.endsWith(".docx")) extractedText = await extractTextFromDOCX(aiFile);
                else if (name.endsWith(".txt") || name.endsWith(".md")) extractedText = await aiFile.text();
                else {
                    alert("Arquivo inválido. Envie PDF, DOCX, TXT ou MD.");
                    setAiLoading(false);
                    return;
                }
            }

            const finalText =
                (aiText?.trim()?.length > 20 ? aiText.trim() : "") ||
                (extractedText?.trim()?.length > 20 ? extractedText.trim() : "");

            const qtdFinal = clamp(Number(aiQtd) || 20, 5, 30); // ✅ limite custo

            const body = {
                user_id: user.id,
                qtd: qtdFinal,
                aggressiveness: aiAgg,
                text: finalText || null,

                course: cursoSelecionado?.name || null,
                discipline: disciplinaSelecionada?.name || null,
                subjects: assuntoSelecionado?.name ? [assuntoSelecionado.name] : null,
            };

            const { data, error } = await supabase.functions.invoke("generate-flashcards", { body });
            if (error) throw error;
            if (!data?.ok) throw new Error(data?.error || "Falha ao gerar cards.");

            const generated = data?.cards || [];
            if (!Array.isArray(generated) || generated.length === 0)
                throw new Error("A IA não retornou cards válidos.");

            // ✅ se não tiver deck, cria automaticamente
            let targetDeckId = deckId;

            if (!targetDeckId) {
                if (!subjectId) {
                    alert("Selecione Assunto e crie um Deck (ou selecione um).");
                    setAiLoading(false);
                    return;
                }

                const autoName = `Deck IA • ${assuntoSelecionado?.name || "Assunto"} • ${new Date()
                    .toLocaleDateString("pt-BR")}`;

                const { data: created, error: errDeck } = await supabase
                    .from("flash_decks")
                    .insert({
                        user_id: user.id,
                        topic_id: subjectId,
                        name: autoName,
                    })
                    .select("id")
                    .single();

                if (errDeck) throw errDeck;
                targetDeckId = created.id;

                await fetchDecks(subjectId);
                setDeckId(targetDeckId);
            }

            const payload = generated
                .map((c) => {
                    const tipo = c?.tipo === "cloze" ? "cloze" : "normal";
                    const tags = Array.isArray(c?.tags) ? c.tags.map((t) => String(t).toLowerCase()) : [];

                    if (tipo === "normal") {
                        if (!c?.pergunta || !c?.resposta) return null;
                        return {
                            user_id: user.id,
                            deck_id: targetDeckId,
                            tipo: "normal",
                            pergunta: String(c.pergunta).slice(0, 600),
                            resposta: String(c.resposta).slice(0, 3000),
                            tags: tags.slice(0, 8),
                            is_favorite: false,
                        };
                    }

                    if (!c?.cloze_text || !c?.cloze_answer) return null;
                    return {
                        user_id: user.id,
                        deck_id: targetDeckId,
                        tipo: "cloze",
                        pergunta: String(c.cloze_text).slice(0, 600),
                        resposta: String(c.cloze_answer).slice(0, 3000),
                        cloze_text: String(c.cloze_text).slice(0, 3000),
                        cloze_answer: String(c.cloze_answer).slice(0, 600),
                        tags: tags.slice(0, 8),
                        is_favorite: false,
                    };
                })
                .filter(Boolean);

            const { error: errInsert } = await supabase.from("flash_cards").insert(payload);
            if (errInsert) throw errInsert;

            alert(`✅ ${payload.length} cards gerados e adicionados ao deck!`);

            setOpenAiModal(false);
            setAiText("");
            setAiFile(null);

            await fetchCards(targetDeckId);
            await fetchDeckStats(targetDeckId);
        } catch (e) {
            console.error(e);
            alert(`Erro ao gerar com IA: ${String(e?.message || e)}`);
        } finally {
            setAiLoading(false);
        }
    }

    /* =========================================================
       Estudo
    ========================================================= */

    const currentCard = cards?.[studyIndex] || null;

    const progresso = useMemo(() => {
        const total = cards.length || 0;
        if (!total) return 0;
        return Math.round(((studyIndex + 1) / total) * 100);
    }, [studyIndex, cards.length]);

    function pularCard() {
        if (!cards.length) return;
        setShowAnswer(false);
        setStudyIndex((i) => (i + 1) % cards.length);
    }

    function virarCard() {
        setShowAnswer((v) => !v);
    }

    async function registrarResultado(resultado) {
        try {
            if (!currentCard) return;

            const statusFinal = resultado === "acerto" ? "acertou" : resultado;

            if (hasReviewTable) {
                await supabase.from("flash_card_reviews").insert({
                    user_id: user.id,
                    deck_id: deckId,
                    card_id: currentCard.id,
                    resultado: statusFinal,
                });
            } else {
                const updatePayload =
                    statusFinal === "errou"
                        ? { wrong_total: (currentCard.wrong_total || 0) + 1, wrong_streak: (currentCard.wrong_streak || 0) + 1 }
                        : { wrong_streak: 0 };
                await supabase.from("flash_cards").update(updatePayload).eq("id", currentCard.id).eq("user_id", user.id);
            }

            const contagemAtual = reviewCounts[currentCard.id] || { acertou: 0, errou: 0, duvida: 0 };
            const novaContagem = {
                ...contagemAtual,
                acertou: statusFinal === "acertou" ? contagemAtual.acertou + 1 : contagemAtual.acertou,
                errou: statusFinal === "errou" ? contagemAtual.errou + 1 : contagemAtual.errou,
                duvida: statusFinal === "duvida" ? contagemAtual.duvida + 1 : contagemAtual.duvida,
            };

            setReviewCounts((prev) => ({ ...prev, [currentCard.id]: novaContagem }));

            setStats((s) => {
                const acertos = statusFinal === "acertou" ? s.acertos + 1 : s.acertos;
                const erros = statusFinal === "errou" ? s.erros + 1 : s.erros;
                const duvidas = statusFinal === "duvida" ? s.duvidas + 1 : s.duvidas;
                const totalRespondidas = acertos + erros + duvidas;
                return {
                    ...s,
                    acertos,
                    erros,
                    duvidas,
                    cardsComErro1x: statusFinal === "errou" && novaContagem.errou === 1 ? s.cardsComErro1x + 1 : s.cardsComErro1x,
                    cardsComErro2x: statusFinal === "errou" && novaContagem.errou === 2 ? s.cardsComErro2x + 1 : s.cardsComErro2x,
                    taxaAcerto: totalRespondidas ? Math.round((acertos / totalRespondidas) * 100) : 0,
                };
            });

            if (statusFinal === "errou" && novaContagem.errou === 2) {
                await criarDeckComErros({ minErros: 2, automatico: true });
            }

            setShowAnswer(false);
            if (studyIndex < cards.length - 1) {
                setStudyIndex((i) => i + 1);
            }
        } catch (e) {
            console.error(e);
        }
    }

    /* =========================================================
       UI
    ========================================================= */

    return (
        <div className="w-full">
            {/* Top */}
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-3xl font-black tracking-tight uppercase">FLASHCARDS</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Conectado: {user?.email}
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setAba("biblioteca")}
                        className={classNames(
                            "px-4 py-2 rounded-full text-sm font-semibold transition",
                            aba === "biblioteca"
                                ? "bg-cyan-600 text-white"
                                : "bg-slate-200/60 text-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200"
                        )}
                    >
                        Biblioteca
                    </button>

                    <button
                        onClick={() => setAba("estudar")}
                        className={classNames(
                            "px-4 py-2 rounded-full text-sm font-semibold transition",
                            aba === "estudar"
                                ? "bg-cyan-600 text-white"
                                : "bg-slate-200/60 text-slate-700 dark:bg-slate-800 dark:text-slate-200 hover:bg-slate-200"
                        )}
                    >
                        Practice Mode
                    </button>
                </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-2 mb-4">
                <button
                    onClick={() => setOpenAiModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow transition"
                >
                    <Sparkles size={18} />
                    AI Create
                </button>

                <button
                    onClick={() => setOpenDeckModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
                >
                    <Plus size={18} />
                    Novo Deck
                </button>

                <button
                    onClick={() => setOpenCardModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
                >
                    <Plus size={18} />
                    Novo Card
                </button>
            </div>

            {/* Filtros */}
            <div className="rounded-2xl p-5 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    {/* Curso */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-500 dark:text-slate-400">Curso</label>
                            <button
                                onClick={() => setOpenCourseModal(true)}
                                className="text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                                title="Criar curso"
                            >
                                + Curso
                            </button>
                        </div>

                        <select
                            value={courseId}
                            onChange={(e) => setCourseId(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700 focus:outline-none"
                        >
                            <option value="">Selecione...</option>
                            {courses.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Disciplina */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-500 dark:text-slate-400">Disciplina</label>
                            <button
                                onClick={() => {
                                    if (!courseId) return alert("Selecione um curso primeiro.");
                                    setOpenDisciplineModal(true);
                                }}
                                className="text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                                title="Criar disciplina"
                            >
                                + Disciplina
                            </button>
                        </div>

                        <select
                            value={disciplineId}
                            onChange={(e) => setDisciplineId(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700 focus:outline-none"
                            disabled={!courseId}
                        >
                            <option value="">{courseId ? "Selecione..." : "Selecione o curso"}</option>
                            {disciplines.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Assunto */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-xs text-slate-500 dark:text-slate-400">Assunto</label>
                            <button
                                onClick={() => {
                                    if (!disciplineId) return alert("Selecione uma disciplina primeiro.");
                                    setOpenSubjectModal(true);
                                }}
                                className="text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                                title="Criar assunto"
                            >
                                + Assunto
                            </button>
                        </div>

                        <select
                            value={subjectId}
                            onChange={(e) => setSubjectId(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700 focus:outline-none"
                            disabled={!disciplineId}
                        >
                            <option value="">{disciplineId ? "Selecione..." : "Selecione a disciplina"}</option>
                            {subjects.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Deck */}
                    <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400">Deck</label>

                        <select
                            value={deckId}
                            onChange={(e) => setDeckId(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700 focus:outline-none"
                            disabled={!subjectId}
                        >
                            <option value="">{subjectId ? "Selecione..." : "Selecione o assunto"}</option>
                            {decks.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>

                        <div className="flex justify-end mt-2">
                            <button
                                onClick={async () => {
                                    if (subjectId) await fetchDecks(subjectId);
                                    if (deckId) {
                                        await fetchCards(deckId);
                                        await fetchDeckStats(deckId);
                                    }
                                }}
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-60"
                            >
                                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                                {loading ? "Atualizando..." : "Atualizar"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Conteúdo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                    {/* Biblioteca */}
                    {aba === "biblioteca" && (
                        <>
                            <div className="rounded-2xl p-5 bg-slate-950/60 border border-slate-800 text-white min-h-[260px]">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold">Meus Decks</h3>
                                    <span className="text-xs text-slate-400">{decks.length} deck(s)</span>
                                </div>

                                {!subjectId ? (
                                    <div className="text-slate-400 text-sm mt-8">
                                        Selecione um <b>Assunto</b> para ver os decks.
                                    </div>
                                ) : decks.length === 0 ? (
                                    <div className="text-slate-400 text-sm mt-8">
                                        Nenhum deck nesse assunto ainda.
                                    </div>
                                ) : (
                                    <div className="mt-3 space-y-2 max-h-[220px] overflow-auto pr-2">
                                        {decks.map((d) => (
                                            <button
                                                key={d.id}
                                                onClick={() => setDeckId(d.id)}
                                                className={classNames(
                                                    "w-full text-left px-4 py-3 rounded-xl border transition",
                                                    deckId === d.id
                                                        ? "bg-cyan-600/20 border-cyan-500 text-white"
                                                        : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                                                )}
                                            >
                                                <div className="font-semibold">{d.name}</div>
                                                <div className="text-xs text-slate-400 mt-1">
                                                    {new Date(d.created_at).toLocaleDateString("pt-BR")}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Estatísticas */}
                            <div className="rounded-2xl p-5 bg-slate-950/60 border border-slate-800 text-white min-h-[260px]">
                                <h3 className="font-bold mb-2">Estatísticas do Deck</h3>

                                {!deckId ? (
                                    <div className="text-slate-400 text-sm mt-8">
                                        Selecione um deck para ver estatísticas.
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-sm text-slate-300">
                                            <span className="font-semibold">Deck:</span>{" "}
                                            {deckSelecionado?.name || "—"}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mt-4">
                                            <div className="rounded-xl p-3 bg-slate-900/50 border border-slate-800">
                                                <div className="text-xs text-slate-400">Total</div>
                                                <div className="text-2xl font-black">{cards.length}</div>
                                            </div>

                                            <div className="rounded-xl p-3 bg-slate-900/50 border border-slate-800">
                                                <div className="text-xs text-slate-400">Favoritos</div>
                                                <div className="text-2xl font-black">
                                                    {(cards || []).filter((c) => !!c.favoritos).length}
                                                </div>
                                            </div>

                                            <div className="rounded-xl p-3 bg-slate-900/50 border border-slate-800">
                                                <div className="text-xs text-slate-400">Acertos</div>
                                                <div className="text-2xl font-black">{stats.acertos}</div>
                                            </div>

                                            <div className="rounded-xl p-3 bg-slate-900/50 border border-slate-800">
                                                <div className="text-xs text-slate-400">Erros</div>
                                                <div className="text-2xl font-black">{stats.erros}</div>
                                            </div>

                                            <div className="rounded-xl p-3 bg-slate-900/50 border border-slate-800">
                                                <div className="text-xs text-slate-400">Taxa de acerto</div>
                                                <div className="text-2xl font-black">{stats.taxaAcerto}%</div>
                                            </div>

                                            <div className="rounded-xl p-3 bg-slate-900/50 border border-slate-800">
                                                <div className="text-xs text-slate-400">Erradas (1x+)</div>
                                                <div className="text-2xl font-black">{stats.cardsComErro1x}</div>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <div className="text-xs text-slate-400 mb-1">Progresso</div>
                                            <div className="h-2 rounded-full bg-slate-900/70 border border-slate-800 overflow-hidden">
                                                <div
                                                    className="h-full bg-cyan-500"
                                                    style={{
                                                        width: cards.length ? `${Math.min(100, progresso)}%` : "0%",
                                                    }}
                                                />
                                            </div>
                                            <div className="text-xs text-slate-400 mt-1">
                                                {cards.length ? `${progresso}%` : "0%"}
                                            </div>
                                        </div>

                                        <div className="mt-4 grid grid-cols-1 gap-2">
                                            <button
                                                onClick={() => criarDeckComErros({ minErros: 2 })}
                                                disabled={creatingErrorDeck}
                                                className="px-3 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-sm font-semibold disabled:opacity-60"
                                            >
                                                Criar deck de erros recorrentes (2x)
                                            </button>
                                            <button
                                                onClick={() => criarDeckComErros({ minErros: 1 })}
                                                disabled={creatingErrorDeck}
                                                className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-sm font-semibold disabled:opacity-60"
                                            >
                                                Criar deck com erradas ao menos 1x
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}

                    {/* Estudar */}
                    {aba === "estudar" && (
                        <div className="md:col-span-2 rounded-2xl p-5 bg-slate-950/60 border border-slate-800 text-white min-h-[420px]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BookOpen size={18} className="text-cyan-400" />
                                    <h3 className="font-bold">Modo Estudo</h3>
                                </div>

                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    {deckSelecionado ? (
                                        <span className="px-3 py-1 rounded-full border border-slate-800 bg-slate-900/60">
                                            {deckSelecionado.name}
                                        </span>
                                    ) : (
                                        <span>Selecione um deck</span>
                                    )}
                                </div>
                            </div>

                            {!deckId ? (
                                <div className="text-slate-400 text-sm mt-10">
                                    Selecione um deck para estudar.
                                </div>
                            ) : loadingDeck ? (
                                <div className="flex items-center gap-2 mt-10 text-slate-300">
                                    <Loader2 className="animate-spin" size={18} />
                                    Carregando cards...
                                </div>
                            ) : cards.length === 0 ? (
                                <div className="text-slate-400 text-sm mt-10">
                                    Esse deck ainda não tem cards.
                                </div>
                            ) : (
                                <>
                                    {/* progresso */}
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between text-xs text-slate-400">
                                            <span>
                                                Card {studyIndex + 1} de {cards.length}
                                            </span>
                                            <span>{progresso}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-slate-900/70 border border-slate-800 overflow-hidden mt-2">
                                            <div className="h-full bg-cyan-500" style={{ width: `${progresso}%` }} />
                                        </div>
                                    </div>

                                    {/* card */}
                                    <div
                                        className="mt-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950/60 to-slate-900/40 p-6 cursor-pointer select-none"
                                        onClick={virarCard}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="text-xs text-slate-400">
                                                {currentCard?.tipo === "cloze" ? "Cloze" : "Pergunta"}
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFavorito(currentCard);
                                                }}
                                                className="p-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 transition"
                                                title="Favoritar"
                                            >
                                                {currentCard?.favoritos ? (
                                                    <Star className="text-yellow-400" size={18} />
                                                ) : (
                                                    <StarOff className="text-slate-300" size={18} />
                                                )}
                                            </button>
                                        </div>

                                        <div className="mt-6 text-center text-lg md:text-2xl font-semibold leading-relaxed">
                                            {!showAnswer ? (
                                                currentCard?.tipo === "cloze" ? (
                                                    <span>{currentCard?.cloze_text}</span>
                                                ) : (
                                                    <span>{currentCard?.pergunta}</span>
                                                )
                                            ) : currentCard?.tipo === "cloze" ? (
                                                <span className="text-cyan-200">{currentCard?.cloze_answer}</span>
                                            ) : (
                                                <span className="text-cyan-200">{currentCard?.resposta}</span>
                                            )}
                                        </div>

                                        <div className="mt-6 text-center text-xs text-slate-500">
                                            Clique no card para {showAnswer ? "voltar" : "ver a resposta"}
                                        </div>

                                        {/* tags */}
                                        {(currentCard?.tags || []).length > 0 && (
                                            <div className="mt-5 flex flex-wrap gap-2 justify-center">
                                                {currentCard.tags.slice(0, 6).map((t, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-xs px-3 py-1 rounded-full border border-slate-800 bg-slate-900/40 text-slate-300"
                                                    >
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* ações */}
                                    <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-2">
                                        <button
                                            onClick={pularCard}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900/60 border border-slate-800 hover:bg-slate-800 transition"
                                        >
                                            <SkipForward size={18} />
                                            Pular
                                        </button>

                                        <button
                                            onClick={() => registrarResultado("erro")}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 hover:bg-rose-500/25 transition"
                                        >
                                            <XCircle size={18} />
                                            Errei
                                        </button>

                                        <button
                                            onClick={() => registrarResultado("duvida")}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500/25 transition"
                                        >
                                            <HelpCircle size={18} />
                                            Dúvida
                                        </button>

                                        <button
                                            onClick={() => registrarResultado("acerto")}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/25 transition"
                                        >
                                            <CheckCircle2 size={18} />
                                            Acertei
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* =====================================================
          MODAIS
      ====================================================== */}

            {openCourseModal && (
                <Modal title="Criar Curso" onClose={() => setOpenCourseModal(false)}>
                    <label className="text-xs text-slate-400">Nome do Curso</label>
                    <input
                        value={newCourseName}
                        onChange={(e) => setNewCourseName(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700"
                        placeholder="Ex: SEFAZ / TJ / ENEM"
                    />

                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            onClick={() => setOpenCourseModal(false)}
                            className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={criarCurso}
                            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700"
                        >
                            Criar
                        </button>
                    </div>
                </Modal>
            )}

            {openDisciplineModal && (
                <Modal title="Criar Disciplina" onClose={() => setOpenDisciplineModal(false)}>
                    <div className="text-xs text-slate-400">
                        Curso selecionado: <b>{cursoSelecionado?.name || "—"}</b>
                    </div>

                    <div className="mt-3">
                        <label className="text-xs text-slate-400">Nome da Disciplina</label>
                        <input
                            value={newDisciplineName}
                            onChange={(e) => setNewDisciplineName(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700"
                            placeholder="Ex: Direito Constitucional"
                        />
                    </div>

                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            onClick={() => setOpenDisciplineModal(false)}
                            className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={criarDisciplina}
                            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700"
                        >
                            Criar
                        </button>
                    </div>
                </Modal>
            )}

            {openSubjectModal && (
                <Modal title="Criar Assunto" onClose={() => setOpenSubjectModal(false)}>
                    <div className="text-xs text-slate-400">
                        Disciplina selecionada: <b>{disciplinaSelecionada?.name || "—"}</b>
                    </div>

                    <div className="mt-3">
                        <label className="text-xs text-slate-400">Nome do Assunto</label>
                        <input
                            value={newSubjectName}
                            onChange={(e) => setNewSubjectName(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700"
                            placeholder="Ex: Controle de Constitucionalidade"
                        />
                    </div>

                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            onClick={() => setOpenSubjectModal(false)}
                            className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={criarAssunto}
                            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700"
                        >
                            Criar
                        </button>
                    </div>
                </Modal>
            )}

            {openDeckModal && (
                <Modal title="Criar Deck" onClose={() => setOpenDeckModal(false)}>
                    <div className="text-xs text-slate-400">
                        Assunto selecionado: <b>{assuntoSelecionado?.name || "—"}</b>
                    </div>

                    <div className="mt-3">
                        <label className="text-xs text-slate-400">Nome do Deck</label>
                        <input
                            value={newDeckName}
                            onChange={(e) => setNewDeckName(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700"
                            placeholder="Ex: Flashcards prova"
                        />
                    </div>

                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            onClick={() => setOpenDeckModal(false)}
                            className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={criarDeck}
                            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700"
                        >
                            Criar
                        </button>
                    </div>
                </Modal>
            )}

            {openCardModal && (
                <Modal title="Criar Card Manual" onClose={() => setOpenCardModal(false)} wide>
                    <div className="text-xs text-slate-400">
                        Deck selecionado: <b>{deckSelecionado?.name || "—"}</b>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <button
                            onClick={() => setCardTipo("normal")}
                            className={classNames(
                                "px-3 py-2 rounded-xl border text-sm font-semibold transition",
                                cardTipo === "normal"
                                    ? "bg-cyan-600/20 border-cyan-500 text-white"
                                    : "bg-slate-900/50 border-slate-800 text-slate-300 hover:bg-slate-800"
                            )}
                        >
                            Normal (Pergunta/Resposta)
                        </button>

                        <button
                            onClick={() => setCardTipo("cloze")}
                            className={classNames(
                                "px-3 py-2 rounded-xl border text-sm font-semibold transition",
                                cardTipo === "cloze"
                                    ? "bg-cyan-600/20 border-cyan-500 text-white"
                                    : "bg-slate-900/50 border-slate-800 text-slate-300 hover:bg-slate-800"
                            )}
                        >
                            Cloze (Omissão)
                        </button>
                    </div>

                    {cardTipo === "normal" ? (
                        <>
                            <div className="mt-4">
                                <label className="text-xs text-slate-400">Pergunta</label>
                                <textarea
                                    value={pergunta}
                                    onChange={(e) => setPergunta(e.target.value)}
                                    rows={3}
                                    className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700"
                                    placeholder="Ex: O que é legalidade?"
                                />
                            </div>

                            <div className="mt-3">
                                <label className="text-xs text-slate-400">Resposta</label>
                                <textarea
                                    value={resposta}
                                    onChange={(e) => setResposta(e.target.value)}
                                    rows={4}
                                    className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700"
                                    placeholder="Ex: Princípio que obriga a Administração a..."
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mt-4">
                                <label className="text-xs text-slate-400">Cloze Text</label>
                                <textarea
                                    value={clozeText}
                                    onChange={(e) => setClozeText(e.target.value)}
                                    rows={4}
                                    className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700"
                                    placeholder='Ex: O princípio da {{c1::legalidade}} está no art. 37.'
                                />
                            </div>

                            <div className="mt-3">
                                <label className="text-xs text-slate-400">Resposta (omissão)</label>
                                <input
                                    value={clozeAnswer}
                                    onChange={(e) => setClozeAnswer(e.target.value)}
                                    className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700"
                                    placeholder="Ex: legalidade"
                                />
                            </div>
                        </>
                    )}

                    <div className="mt-3">
                        <label className="text-xs text-slate-400">Tags (vírgula)</label>
                        <input
                            value={tagsText}
                            onChange={(e) => setTagsText(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700"
                            placeholder="ex: administrativo, principios, art-37"
                        />
                    </div>

                    <div className="mt-5 flex justify-end gap-2">
                        <button
                            onClick={() => {
                                setOpenCardModal(false);
                                resetCardForm();
                            }}
                            className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={criarCardManual}
                            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700"
                        >
                            Criar Card
                        </button>
                    </div>
                </Modal>
            )}

            {openAiModal && (
                <Modal title="Gerar Flashcards com IA" onClose={() => setOpenAiModal(false)} wide>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Conteúdo */}
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-white">
                            <div className="flex items-center gap-2 font-bold">
                                <Layers size={18} className="text-cyan-400" />
                                Conteúdo
                            </div>

                            <div className="mt-4">
                                <label className="text-xs text-slate-400">Resumo / Texto</label>
                                <textarea
                                    value={aiText}
                                    onChange={(e) => setAiText(e.target.value)}
                                    rows={6}
                                    className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700"
                                    placeholder="Cole um resumo aqui (ou deixe vazio e gere pelos filtros)"
                                />
                            </div>

                            <div className="mt-4">
                                <label className="text-xs text-slate-400">Upload (PDF / DOCX / TXT / MD)</label>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.docx,.txt,.md"
                                    onChange={handlePickFile}
                                    className="hidden"
                                />

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:bg-slate-800 transition"
                                >
                                    <UploadCloud size={18} />
                                    Selecionar arquivo
                                </button>

                                {aiFile && (
                                    <div className="mt-2 text-xs text-slate-300 flex items-center justify-between">
                                        <span>
                                            Arquivo: <b>{aiFile.name}</b>
                                        </span>
                                        <button onClick={() => setAiFile(null)} className="text-slate-400 hover:text-white">
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Config */}
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-white">
                            <div className="flex items-center gap-2 font-bold">
                                <Sparkles size={18} className="text-cyan-400" />
                                Configurações
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-4">
                                <div>
                                    <label className="text-xs text-slate-400">Qtd (máx. 30)</label>
                                    <input
                                        type="number"
                                        min={5}
                                        max={30}
                                        value={aiQtd}
                                        onChange={(e) => setAiQtd(e.target.value)}
                                        className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-slate-400">Agressividade</label>
                                    <select
                                        value={aiAgg}
                                        onChange={(e) => setAiAgg(e.target.value)}
                                        className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-950/70 text-white border border-slate-700"
                                    >
                                        <option value="prova">Prova amanhã</option>
                                        <option value="medio">Equilibrado</option>
                                        <option value="longo">Longo prazo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mt-4 text-xs text-slate-400">
                                Se você não enviar texto, a IA usa:
                                <div className="mt-2 space-y-1">
                                    <div>• Curso: <b>{cursoSelecionado?.name || "—"}</b></div>
                                    <div>• Disciplina: <b>{disciplinaSelecionada?.name || "—"}</b></div>
                                    <div>• Assunto: <b>{assuntoSelecionado?.name || "—"}</b></div>
                                </div>
                            </div>

                            <div className="mt-5 flex justify-end gap-2">
                                <button
                                    onClick={() => setOpenAiModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800"
                                >
                                    Cancelar
                                </button>

                                <button
                                    onClick={gerarComIA}
                                    disabled={aiLoading}
                                    className={classNames(
                                        "px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 inline-flex items-center gap-2",
                                        aiLoading && "opacity-70 cursor-not-allowed"
                                    )}
                                >
                                    {aiLoading ? (
                                        <>
                                            <Loader2 className="animate-spin" size={16} />
                                            Gerando...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={16} />
                                            Gerar
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

/* =========================================================
  Modal
========================================================= */

function Modal({ title, onClose, children, wide = false }) {
    return (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
            <div
                className={classNames(
                    "w-full rounded-3xl border border-slate-800 bg-slate-950 text-white shadow-2xl",
                    wide ? "max-w-5xl" : "max-w-xl"
                )}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
                    <div className="font-black tracking-tight">{title}</div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 transition">
                        <X size={18} />
                    </button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}
