import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

// FullCalendar
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";

// Icons
import { Pencil, RefreshCw, Trash2, Filter } from "lucide-react";

/* ============================
   CONSTANTES
============================ */

// ✅ cores (tarefa)
const PRIORITY = {
    1: { label: "Baixa", hex: "#10b981" },
    2: { label: "Média", hex: "#f59e0b" },
    3: { label: "Alta", hex: "#f43f5e" },
};

// ✅ dificuldade (etiqueta no card do To-do)
const DIFICULDADE = {
    facil: { label: "Fácil", hex: "#22c55e" },
    media: { label: "Média", hex: "#f59e0b" },
    dificil: { label: "Difícil", hex: "#f43f5e" },
};

const safeNumber = (n, fallback = 0) => {
    const v = Number(n);
    return Number.isFinite(v) ? v : fallback;
};

const formatarHMS = (segundos) => {
    const s = Math.max(0, safeNumber(segundos, 0));
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
};

const dataLegivel = (d) => {
    try {
        return d ? new Date(d).toLocaleString("pt-BR") : "Sem data";
    } catch {
        return "Sem data";
    }
};

// ✅ cores principais (estudo/revisão)
const COR_ESTUDO = "#10b981"; // verde
const COR_REVISAO = "#2563eb"; // azul

// ✅ identificar subtipo da sessão (para cor)
const normalizarTipoSessao = (raw) => {
    const t = (raw || "").toString().toLowerCase();
    if (t.includes("simul")) return "simulado";
    if (t.includes("revis") || t.includes("quest") || t.includes("exerc"))
        return "revisao_questoes";
    return "teoria";
};

const labelTipoSessao = (key) => {
    if (key === "simulado") return "Simulado";
    if (key === "revisao_questoes") return "Revisão questões";
    return "Teoria";
};

const corSessao = (tipoKey) => {
    if (tipoKey === "revisao_questoes") return COR_REVISAO;
    return COR_ESTUDO; // teoria e simulado = verde
};

const pillDificuldade = (difKey) => {
    if (!difKey) return null;
    const d = DIFICULDADE[difKey];
    if (!d) return null;

    return (
        <span
            className="inline-flex items-center px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
            style={{
                background: `${d.hex}1A`,
                color: d.hex,
                borderColor: `${d.hex}40`,
            }}
        >
            {d.label}
        </span>
    );
};

const badgePrioridadeAbaixo = (prioridade) => {
    const pr = PRIORITY[prioridade || 1] || PRIORITY[1];
    return (
        <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
            style={{
                background: `${pr.hex}18`,
                color: pr.hex,
                borderColor: `${pr.hex}40`,
            }}
        >
            Prioridade {pr.label}
        </span>
    );
};

// ✅ contraste automático
const coresTextoParaFundo = (fundo) => {
    if (!fundo) return { title: "#0f172a", sub: "rgba(15,23,42,0.65)" };

    const strong =
        fundo === COR_ESTUDO ||
        fundo === COR_REVISAO ||
        fundo.startsWith("#0f172a") ||
        fundo.startsWith("#111827") ||
        fundo.startsWith("#0b1220") ||
        fundo.startsWith("#10b981") ||
        fundo.startsWith("#2563eb");

    if (strong) return { title: "#ffffff", sub: "rgba(255,255,255,0.78)" };
    return { title: "#0f172a", sub: "rgba(15,23,42,0.65)" };
};

const inicioDoDia = (d = new Date()) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const Calendario = ({ user }) => {
    const [allEventos, setAllEventos] = useState([]);
    const [loading, setLoading] = useState(true);

    // ✅ modo edição
    const [modoEdicao, setModoEdicao] = useState(false);
    const [apagando, setApagando] = useState(false);
    const [marcando, setMarcando] = useState(false);

    // ✅ modal detalhes
    const [modalAberto, setModalAberto] = useState(false);
    const [eventoSelecionado, setEventoSelecionado] = useState(null);

    /* ============================
       FILTROS (SIMPLES)
    ============================ */
    const [filtroOpen, setFiltroOpen] = useState(false);

    // all | tarefa | revisao | sessao
    const [tipoFiltro, setTipoFiltro] = useState("all");

    // prioridade só aparece se tipoFiltro === "tarefa"
    const [filtroPrioridade, setFiltroPrioridade] = useState("all"); // all | 1 | 2 | 3

    // somente atrasadas
    const [somenteAtrasadas, setSomenteAtrasadas] = useState(false);

    // ✅ realtime + load
    useEffect(() => {
        if (user?.id) buscarEventos();
        // eslint-disable-next-line
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;

        const chRev = supabase
            .channel("calendar_revisoes_agendadas_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "revisoes_agendadas",
                    filter: `user_id=eq.${user.id}`,
                },
                () => buscarEventos()
            )
            .subscribe();

        const chSes = supabase
            .channel("calendar_sessoes_estudo_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "sessoes_estudo",
                    filter: `user_id=eq.${user.id}`,
                },
                () => buscarEventos()
            )
            .subscribe();

        const chTar = supabase
            .channel("calendar_tarefas_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "tarefas",
                    filter: `user_id=eq.${user.id}`,
                },
                () => buscarEventos()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(chRev);
            supabase.removeChannel(chSes);
            supabase.removeChannel(chTar);
        };
        // eslint-disable-next-line
    }, [user?.id]);

    const buscarEventos = async () => {
        setLoading(true);
        try {
            const { data: revisoes } = await supabase
                .from("revisoes_agendadas")
                .select("*")
                .eq("user_id", user.id);

            const { data: sessoes } = await supabase
                .from("sessoes_estudo")
                .select("*")
                .eq("user_id", user.id);

            const { data: tarefas } = await supabase
                .from("tarefas")
                .select("*")
                .eq("user_id", user.id);

            // ✅ revisões (allDay)
            const eventosRevisoes = (revisoes || []).map((rev) => {
                const concluida = !!rev.executada;
                return {
                    id: `rev-${rev.id}`,
                    title: rev.titulo || "Revisão",
                    start: rev.data_revisao,
                    allDay: true,
                    backgroundColor: "transparent",
                    borderColor: "transparent",
                    textColor: "#0f172a",
                    extendedProps: {
                        tipo: "revisao",
                        supaId: rev.id,
                        executada: concluida,
                        titulo: rev.titulo,
                        conteudo: rev.conteudo,
                        tipoRevisao: rev.tipo_revisao, // só nos detalhes
                        origem: rev.origem,
                        qtdFeitas: safeNumber(rev.qtd_feitas, 0),
                        qtdAcertos: safeNumber(rev.qtd_acertos, 0),
                        qtdErros: safeNumber(rev.qtd_erros, 0),
                        metaQuestoes: safeNumber(rev.meta_questoes, 0),
                    },
                };
            });

            // ✅ sessões (horário real)
            const eventosSessoes = (sessoes || []).map((s) => {
                const inicio = s.inicio_em;
                const dur = safeNumber(s.duracao_segundos, 0);

                const fim =
                    dur > 0
                        ? new Date(new Date(inicio).getTime() + dur * 1000).toISOString()
                        : null;

                const tipoKey = normalizarTipoSessao(s.tipo_estudo);

                // ✅ status "concluída" (se existir)
                const statusSessaoExplicito =
                    s.concluida ?? s.finalizada ?? s.realizada ?? s.feita;

                // Quando não existe coluna de status na sessão, considera concluída
                // se a sessão já tem duração registrada e iniciou no passado.
                const concluidaSessao =
                    statusSessaoExplicito != null
                        ? !!statusSessaoExplicito
                        : dur > 0 && new Date(inicio) <= new Date();

                return {
                    id: `ses-${s.id}`,
                    title: s.materia ? `${s.materia}` : "Sessão de estudo",
                    start: inicio,
                    end: fim || undefined,
                    allDay: false,
                    backgroundColor: "transparent",
                    borderColor: "transparent",
                    textColor: "#0f172a",
                    extendedProps: {
                        tipo: "sessao",
                        supaId: s.id,
                        materia: s.materia,
                        conteudo: s.conteudo,
                        tipoEstudo: s.tipo_estudo,
                        duracaoSegundos: dur,
                        anotacao: s.anotacao,
                        sessaoKey: tipoKey,
                        concluidaSessao,
                    },
                };
            });

            // ✅ tarefas (allDay)
            const eventosTarefas = (tarefas || []).map((t) => {
                const prioridade = safeNumber(t.prioridade, 1);
                const cor = PRIORITY[prioridade]?.hex || PRIORITY[1].hex;

                const titulo = t.texto || "Tarefa";
                const concluida = !!t.concluida;
                const fimConclusao =
                    t.concluida_em || t.data_conclusao || t.finalizada_em || t.realizada_em || null;

                const rawDif = (t.dificuldade || t.nivel || t.level || "")
                    .toString()
                    .toLowerCase();

                let dificuldade = null;
                if (rawDif.includes("fac")) dificuldade = "facil";
                if (rawDif.includes("méd") || rawDif.includes("med")) dificuldade = "media";
                if (rawDif.includes("dif")) dificuldade = "dificil";

                return {
                    id: `task-${t.id}`,
                    title: titulo,
                    start: t.data_vencimento,
                    end: concluida && fimConclusao ? fimConclusao : undefined,
                    allDay: true,
                    backgroundColor: "transparent",
                    borderColor: "transparent",
                    textColor: "#0f172a",
                    extendedProps: {
                        tipo: "tarefa",
                        supaId: t.id,
                        prioridade,
                        corPrioridade: cor,
                        categoria: t.categoria || "To-do",
                        concluida,
                        concluidaEm: fimConclusao,
                        notas: t.notas,
                        dificuldade,
                    },
                };
            });

            setAllEventos([...eventosTarefas, ...eventosRevisoes, ...eventosSessoes]);
        } finally {
            setLoading(false);
        }
    };

    /* ============================
       FILTRAGEM (FRONT)
    ============================ */
    const eventosFiltrados = useMemo(() => {
        const hoje0 = inicioDoDia(new Date());
        const agora = new Date();

        const isOverdue = (ev) => {
            const p = ev.extendedProps || {};
            const tipo = p.tipo;

            // somente pendentes entram como "atrasadas"
            const pendente =
                tipo === "tarefa"
                    ? !p.concluida
                    : tipo === "revisao"
                        ? !p.executada
                        : !p.concluidaSessao;

            if (!pendente) return false;

            // tasks/revisões: atraso por dia (antes de hoje)
            if (tipo === "tarefa" || tipo === "revisao") {
                if (!ev.start) return false;
                const d = inicioDoDia(new Date(ev.start));
                return d < hoje0;
            }

            // sessões: atraso por horário (iniciou no passado e ainda não concluiu)
            if (tipo === "sessao") {
                if (!ev.start) return false;
                return new Date(ev.start) < agora;
            }

            return false;
        };

        return (allEventos || [])
            .filter((ev) => {
                const p = ev.extendedProps || {};
                const tipo = p.tipo;

                // tipo principal
                if (tipoFiltro !== "all" && tipo !== tipoFiltro) return false;

                // prioridade apenas quando filtrando To-do
                if (tipoFiltro === "tarefa" && filtroPrioridade !== "all") {
                    const alvo = Number(filtroPrioridade);
                    if (Number(p.prioridade || 1) !== alvo) return false;
                }

                // atrasadas
                if (somenteAtrasadas && !isOverdue(ev)) return false;

                return true;
            })
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }, [allEventos, tipoFiltro, filtroPrioridade, somenteAtrasadas]);

    const aoClicarEvento = (info) => {
        const ev = info.event;

        setEventoSelecionado({
            id: ev.id,
            title: ev.title,
            start: ev.start,
            end: ev.end,
            allDay: ev.allDay,
            ...ev.extendedProps,
        });

        setModalAberto(true);
    };

    const fecharModal = () => {
        setModalAberto(false);
        setEventoSelecionado(null);
    };

    /* ============================
       CONCLUIR (SINCRONIZA)
    ============================ */
    const toggleConcluida = async (t) => {
        if (!user?.id) return;
        if (!t?.tipo || !t?.supaId) return;

        try {
            setMarcando(true);

            if (t.tipo === "tarefa") {
                const novo = !t.concluida;
                const concluidaEm = novo ? new Date().toISOString() : null;
                const { error } = await supabase
                    .from("tarefas")
                    .update({ concluida: novo, concluida_em: concluidaEm })
                    .eq("id", t.supaId)
                    .eq("user_id", user.id);
                if (error) throw error;

                setEventoSelecionado((prev) => ({
                    ...prev,
                    concluida: novo,
                    concluidaEm,
                    end: concluidaEm,
                }));
            }

            if (t.tipo === "revisao") {
                const novo = !t.executada;
                const { error } = await supabase
                    .from("revisoes_agendadas")
                    .update({ executada: novo })
                    .eq("id", t.supaId)
                    .eq("user_id", user.id);
                if (error) throw error;

                setEventoSelecionado((prev) => ({ ...prev, executada: novo }));
            }

            if (t.tipo === "sessao") {
                const atual = !!t.concluidaSessao;
                const novo = !atual;

                const tentativas = ["concluida", "finalizada", "realizada", "feita"];
                let atualizado = false;

                for (const col of tentativas) {
                    const { error } = await supabase
                        .from("sessoes_estudo")
                        .update({ [col]: novo })
                        .eq("id", t.supaId)
                        .eq("user_id", user.id);

                    if (!error) {
                        atualizado = true;
                        break;
                    }
                }

                if (!atualizado) {
                    alert(
                        "Para marcar Sessões como concluídas, crie uma coluna booleana na tabela 'sessoes_estudo' (recomendado: 'concluida')."
                    );
                } else {
                    setEventoSelecionado((prev) => ({ ...prev, concluidaSessao: novo }));
                }
            }

            await buscarEventos();
        } catch (e) {
            console.log("Erro ao marcar como concluída:", e?.message || e);
            alert("Não consegui marcar como concluída. Veja o console.");
        } finally {
            setMarcando(false);
        }
    };

    /* ============================
       EXCLUIR
    ============================ */
    const excluirEvento = async (ev) => {
        if (!user?.id) return;
        if (!ev?.tipo || !ev?.supaId) return;

        const ok = window.confirm(
            `Excluir este evento?\n\n"${ev.title}"\n\nIsso remove do calendário e também do To-do/Revisões/Estudo.`
        );
        if (!ok) return;

        try {
            setApagando(true);

            if (ev.tipo === "tarefa") {
                const { error } = await supabase
                    .from("tarefas")
                    .delete()
                    .eq("id", ev.supaId)
                    .eq("user_id", user.id);
                if (error) throw error;
            }

            if (ev.tipo === "revisao") {
                const { error } = await supabase
                    .from("revisoes_agendadas")
                    .delete()
                    .eq("id", ev.supaId)
                    .eq("user_id", user.id);
                if (error) throw error;
            }

            if (ev.tipo === "sessao") {
                const { error } = await supabase
                    .from("sessoes_estudo")
                    .delete()
                    .eq("id", ev.supaId)
                    .eq("user_id", user.id);
                if (error) throw error;
            }

            fecharModal();
            await buscarEventos();
        } catch (e) {
            console.log("Erro ao excluir:", e?.message || e);
            alert("Não consegui excluir. Veja o console.");
        } finally {
            setApagando(false);
        }
    };

    const apagarTudoDoCalendario = async () => {
        if (!user?.id) return;

        const ok = window.confirm(
            "⚠️ ATENÇÃO!\n\nIsso apagará TUDO do sistema:\n- To-do list\n- Revisões\n- Sessões de estudo\n\nDeseja continuar?"
        );
        if (!ok) return;

        try {
            setApagando(true);

            const del1 = supabase.from("tarefas").delete().eq("user_id", user.id);
            const del2 = supabase
                .from("revisoes_agendadas")
                .delete()
                .eq("user_id", user.id);
            const del3 = supabase
                .from("sessoes_estudo")
                .delete()
                .eq("user_id", user.id);

            const [r1, r2, r3] = await Promise.all([del1, del2, del3]);

            if (r1.error) throw r1.error;
            if (r2.error) throw r2.error;
            if (r3.error) throw r3.error;

            fecharModal();
            await buscarEventos();
        } catch (e) {
            console.log("Erro ao apagar tudo:", e?.message || e);
            alert("Não consegui apagar tudo. Veja o console.");
        } finally {
            setApagando(false);
        }
    };

    /* ============================
       BADGES (MODAL)
    ============================ */
    const badgeTipo = (tipo, extra) => {
        if (tipo === "tarefa") {
            const pr = PRIORITY[extra?.prioridade || 1];
            return (
                <span
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                    style={{
                        background: `${pr?.hex}1A`,
                        color: pr?.hex,
                        borderColor: `${pr?.hex}40`,
                    }}
                >
                    To-do • {pr?.label || "Prioridade"}
                </span>
            );
        }

        if (tipo === "revisao") {
            const done = !!extra?.executada;
            return (
                <span
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                    style={{
                        background: `${COR_REVISAO}1A`,
                        color: COR_REVISAO,
                        borderColor: `${COR_REVISAO}40`,
                    }}
                >
                    {done ? "Revisão concluída" : "Revisão pendente"}
                </span>
            );
        }

        const key = extra?.sessaoKey || normalizarTipoSessao(extra?.tipoEstudo);
        const cor = corSessao(key);
        const done = !!extra?.concluidaSessao;

        return (
            <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border"
                style={{
                    background: `${cor}1A`,
                    color: cor,
                    borderColor: `${cor}40`,
                }}
            >
                Estudar agora • {done ? "Concluído" : "Pendente"}
            </span>
        );
    };

    /* ============================
       CARD EVENTO (WHITE NO MÊS / DARK NO DIA)
    ============================ */
    const renderEventoTrello = (arg) => {
        const ev = arg.event;
        const p = ev.extendedProps || {};
        const tipo = p.tipo;

        const viewType = arg.view?.type || "";
        const isDayView = viewType === "timeGridDay";

        const isDone =
            tipo === "tarefa"
                ? !!p.concluida
                : tipo === "revisao"
                    ? !!p.executada
                    : !!p.concluidaSessao;

        // ✅ bolinha pendente inclui Estudar agora
        const showDot =
            (tipo === "tarefa" && !p.concluida) ||
            (tipo === "revisao" && !p.executada) ||
            (tipo === "sessao" && !p.concluidaSessao);

        const title = ev.title || "Evento";

        // subtitle
        let subtitle = "";
        if (tipo === "tarefa") subtitle = p.categoria ? String(p.categoria) : "To-do";
        if (tipo === "revisao") subtitle = "Revisão";
        if (tipo === "sessao") {
            const key = p.sessaoKey || normalizarTipoSessao(p.tipoEstudo);
            subtitle = labelTipoSessao(key);
        }

        const timeText = arg.timeText ? String(arg.timeText) : "";

        // tarja só em revisões e sessões
        let stripe = "transparent";
        if (tipo === "revisao") stripe = COR_REVISAO;
        if (tipo === "sessao") {
            const key = p.sessaoKey || normalizarTipoSessao(p.tipoEstudo);
            stripe = corSessao(key);
        }

        // fundo do card
        let cardBg = isDayView ? "#0f172a" : "#ffffff";
        let borderColor = isDayView
            ? "rgba(148,163,184,0.25)"
            : "rgba(226,232,240,1)";

        // concluídos preenchidos com cor do tipo (exceto To-do)
        if (isDone) {
            if (tipo === "revisao") {
                cardBg = COR_REVISAO;
                borderColor = `${COR_REVISAO}AA`;
            }
            if (tipo === "sessao") {
                cardBg = stripe;
                borderColor = `${stripe}AA`;
            }
        }

        const txt = coresTextoParaFundo(cardBg);

        return (
            <div
                className="w-full rounded-2xl overflow-hidden transition-all cursor-pointer relative
        border shadow-[0_18px_50px_-32px_rgba(0,0,0,0.25)]
        hover:translate-y-[-1px] hover:shadow-[0_22px_60px_-35px_rgba(0,0,0,0.35)]"
                style={{ background: cardBg, borderColor }}
            >
                {/* tarja só se NÃO for To-do */}
                {tipo !== "tarefa" && <div style={{ height: 7, background: stripe }} />}

                {modoEdicao && (
                    <div className="absolute top-2 right-2">
                        <span
                            className="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border"
                            style={{
                                background: isDayView
                                    ? "rgba(255,255,255,0.10)"
                                    : "rgba(15,23,42,0.06)",
                                color: isDayView ? "rgba(255,255,255,0.9)" : "#0f172a",
                                borderColor: isDayView
                                    ? "rgba(255,255,255,0.12)"
                                    : "rgba(15,23,42,0.08)",
                            }}
                        >
                            editar
                        </span>
                    </div>
                )}

                <div className="px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <p
                                    className="text-[13px] font-black leading-tight truncate"
                                    style={{
                                        color: txt.title,
                                        textDecoration:
                                            tipo === "tarefa" && isDone ? "line-through" : "none",
                                        opacity: tipo === "tarefa" && isDone ? 0.7 : 1,
                                    }}
                                    title={title}
                                >
                                    {title}
                                </p>

                                {tipo === "tarefa" && pillDificuldade(p.dificuldade)}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <p className="text-[11px] font-bold truncate" style={{ color: txt.sub }}>
                                    {tipo === "sessao" && timeText ? `${timeText} • ${subtitle}` : subtitle}
                                </p>

                                {tipo === "tarefa" && badgePrioridadeAbaixo(p.prioridade)}
                            </div>
                        </div>

                        {/* bolinha pendente */}
                        {showDot ? (
                            <span
                                className="mt-1 inline-block w-2.5 h-2.5 rounded-full"
                                style={{
                                    background:
                                        tipo === "tarefa"
                                            ? p.corPrioridade || PRIORITY[1].hex
                                            : tipo === "revisao"
                                                ? COR_REVISAO
                                                : stripe,
                                }}
                            />
                        ) : (
                            <span className="mt-1 inline-block w-2.5 h-2.5 rounded-full opacity-0" />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    /* ============================
       MODAL DETALHES
    ============================ */
    const ModalDetalhes = () => {
        if (!modalAberto || !eventoSelecionado) return null;
        const t = eventoSelecionado;

        const box =
            "rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4";

        const done =
            t.tipo === "tarefa"
                ? !!t.concluida
                : t.tipo === "revisao"
                    ? !!t.executada
                    : !!t.concluidaSessao;

        const labelBtn = done ? "Marcar como pendente" : "Marcar como concluída";

        return (
            <div className="fixed inset-0 z-[999999] bg-black/70 flex items-center justify-center p-4">
                <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                Detalhes
                            </p>
                            <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white break-words">
                                {t.title}
                            </h3>
                            <div className="mt-3">{badgeTipo(t.tipo, t)}</div>
                        </div>

                        <button
                            onClick={fecharModal}
                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            aria-label="Fechar"
                        >
                            <span className="text-slate-500 dark:text-slate-300 text-xl font-black">
                                ✕
                            </span>
                        </button>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={box}>
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                Início
                            </p>
                            <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                {dataLegivel(t.start)}
                            </p>
                        </div>

                        <div className={box}>
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                Fim
                            </p>
                            <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                {t.end ? dataLegivel(t.end) : "—"}
                            </p>
                        </div>

                        {/* TAREFA */}
                        {t.tipo === "tarefa" && (
                            <>
                                <div className={box}>
                                    <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                        Categoria
                                    </p>
                                    <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                        {t.categoria || "To-do"}
                                    </p>
                                </div>

                                <div className={box}>
                                    <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                        Prioridade
                                    </p>
                                    <p className="mt-1 font-black text-slate-900 dark:text-white">
                                        {PRIORITY[t.prioridade || 1]?.label || "Baixa"}
                                    </p>
                                </div>

                                <div className={`${box} md:col-span-2`}>
                                    <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                        Dificuldade
                                    </p>
                                    <div className="mt-2">{pillDificuldade(t.dificuldade) || "—"}</div>
                                </div>

                                <div className={`${box} md:col-span-2`}>
                                    <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                        Notas
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white whitespace-pre-wrap">
                                        {t.notas?.trim() ? t.notas : "—"}
                                    </p>
                                </div>
                            </>
                        )}

                        {/* REVISÃO */}
                        {t.tipo === "revisao" && (
                            <>
                                <div className={box}>
                                    <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                        Tipo de revisão
                                    </p>
                                    <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                        {t.tipoRevisao || "—"}
                                    </p>
                                </div>

                                <div className={box}>
                                    <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                        Origem
                                    </p>
                                    <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                        {t.origem || "—"}
                                    </p>
                                </div>

                                <div className={`${box} md:col-span-2`}>
                                    <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                        Conteúdo
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white whitespace-pre-wrap">
                                        {t.conteudo?.trim() ? t.conteudo : "—"}
                                    </p>
                                </div>
                            </>
                        )}

                        {/* SESSÃO */}
                        {t.tipo === "sessao" && (
                            <>
                                <div className={box}>
                                    <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                        Matéria
                                    </p>
                                    <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                        {t.materia || "—"}
                                    </p>
                                </div>

                                <div className={box}>
                                    <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                        Tipo
                                    </p>
                                    <p className="mt-1 font-bold text-slate-900 dark:text-white">
                                        {t.tipoEstudo || "—"}
                                    </p>
                                </div>

                                <div className={`${box} md:col-span-2`}>
                                    <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                                        Duração
                                    </p>
                                    <p className="mt-1 font-black font-mono text-emerald-600 dark:text-emerald-400 text-xl">
                                        {formatarHMS(t.duracaoSegundos || 0)}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                        <button
                            onClick={() => toggleConcluida(t)}
                            disabled={marcando}
                            className={`px-5 py-3 rounded-2xl font-black cursor-pointer transition-all active:scale-95 border
                ${marcando
                                    ? "bg-slate-300 text-white opacity-70 cursor-not-allowed border-slate-300"
                                    : done
                                        ? "bg-slate-900 hover:bg-slate-800 text-white border-slate-800"
                                        : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
                                }`}
                        >
                            {marcando ? "Salvando..." : labelBtn}
                        </button>

                        {modoEdicao && (
                            <button
                                onClick={() => excluirEvento(t)}
                                disabled={apagando}
                                className={`px-5 py-3 rounded-2xl font-black cursor-pointer transition-all active:scale-95
                  ${apagando
                                        ? "bg-rose-300 text-white opacity-70 cursor-not-allowed"
                                        : "bg-rose-600 hover:bg-rose-500 text-white"
                                    }`}
                            >
                                {apagando ? "Excluindo..." : "Excluir este evento"}
                            </button>
                        )}

                        <button
                            onClick={fecharModal}
                            className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-black cursor-pointer"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    /* ============================
       CSS DO CALENDÁRIO
    ============================ */
    const calendarStyles = useMemo(() => {
        return `
      .fc { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial; }
      .fc .fc-toolbar-title { font-weight: 900; letter-spacing: -0.02em; color: #0f172a; }
      .dark .fc .fc-toolbar-title { color: #ffffff; }

      /* ✅ botões: mais respiro + menor */
      .fc .fc-button { border-radius: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; padding: 6px 10px; }
      .fc .fc-button-group { gap: 10px; }
      .fc .fc-button-group .fc-button { margin: 0 !important; }

      .fc .fc-button-primary { background: #4f46e5; border: none; }
      .fc .fc-button-primary:hover { background: #4338ca; }
      .fc .fc-button-primary:disabled { opacity: 0.65; }

      /* ✅ header dias da semana com contraste */
      .fc .fc-col-header { background: #0b1220; }
      .fc .fc-col-header-cell { background: #0b1220; border-color: rgba(255,255,255,0.06) !important; }
      .fc .fc-col-header-cell-cushion {
        color: rgba(255,255,255,0.92) !important;
        font-weight: 900 !important;
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.12em;
      }

      /* ✅ grades */
      .fc .fc-scrollgrid { border-radius: 24px; overflow: hidden; border: 1px solid rgba(148,163,184,0.25); }
      .fc .fc-daygrid-day-frame { padding: 6px; }
      .fc .fc-daygrid-event { margin-top: 6px; }
      .fc .fc-event { border: none !important; background: transparent !important; padding: 0 !important; }
      .fc .fc-event .fc-event-main { padding: 0 !important; }

      /* ✅ números do mês */
      .fc .fc-daygrid-day-number { font-weight: 900; color: rgba(15,23,42,0.85); }
      .dark .fc .fc-daygrid-day-number { color: rgba(255,255,255,0.85); }

      /* ✅ modo dia */
      .fc .fc-timegrid-axis,
      .fc .fc-timegrid-slot-label,
      .fc .fc-timegrid-axis-frame,
      .fc .fc-timegrid-slot-label-frame {
        background: #0b1220 !important;
        border-color: rgba(255,255,255,0.06) !important;
      }
      .fc .fc-timegrid-axis-cushion,
      .fc .fc-timegrid-slot-label-cushion {
        color: rgba(255,255,255,0.80) !important;
        font-weight: 900 !important;
      }

      .fc .fc-daygrid-more-link { font-weight: 900; }
    `;
    }, []);

    /* ============================
       UI FILTRO SIMPLES (DROPDOWN)
    ============================ */
    const resetarFiltros = () => {
        setTipoFiltro("all");
        setFiltroPrioridade("all");
        setSomenteAtrasadas(false);
    };

    return (
        <div className="w-full">
            {/* Header / Ações */}
            <div className="flex flex-col gap-3 mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                            Calendário
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            To-do + revisões + sessões (tudo sincronizado)
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Filtro simples (sem "FILTROS" no lado esquerdo) */}
                        <div className="relative">
                            <button
                                onClick={() => setFiltroOpen((v) => !v)}
                                className="p-3 rounded-2xl font-black cursor-pointer transition-all active:scale-95 border
                  bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700
                  hover:bg-slate-50 dark:hover:bg-slate-700"
                                title="Filtros"
                                aria-label="Filtros"
                            >
                                <Filter size={18} />
                            </button>

                            {filtroOpen && (
                                <div
                                    className="absolute right-0 mt-2 w-[320px] z-[99999] rounded-3xl border shadow-2xl overflow-hidden
                    bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                                >
                                    <div className="p-4">
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                                            Filtros
                                        </p>

                                        {/* Tipo */}
                                        <div className="mt-3">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                                                Tipo
                                            </label>

                                            <select
                                                value={tipoFiltro}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    setTipoFiltro(v);
                                                    if (v !== "tarefa") setFiltroPrioridade("all");
                                                }}
                                                className="mt-2 w-full px-4 py-3 rounded-2xl border font-black text-[11px] uppercase tracking-widest
                          bg-white dark:bg-slate-900 text-slate-900 dark:text-white
                          border-slate-200 dark:border-slate-700 cursor-pointer"
                                            >
                                                <option value="all">Todos</option>
                                                <option value="tarefa">To-do</option>
                                                <option value="revisao">Revisões</option>
                                                <option value="sessao">Estudar agora</option>
                                            </select>
                                        </div>

                                        {/* Prioridade (somente To-do) */}
                                        {tipoFiltro === "tarefa" && (
                                            <div className="mt-4">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">
                                                    Prioridade
                                                </label>

                                                <select
                                                    value={filtroPrioridade}
                                                    onChange={(e) => setFiltroPrioridade(e.target.value)}
                                                    className="mt-2 w-full px-4 py-3 rounded-2xl border font-black text-[11px] uppercase tracking-widest
                            bg-white dark:bg-slate-900 text-slate-900 dark:text-white
                            border-slate-200 dark:border-slate-700 cursor-pointer"
                                                >
                                                    <option value="all">Todas</option>
                                                    <option value="1">Baixa</option>
                                                    <option value="2">Média</option>
                                                    <option value="3">Alta</option>
                                                </select>
                                            </div>
                                        )}

                                        {/* Atrasadas */}
                                        <div className="mt-4">
                                            <label
                                                className="flex items-center justify-between gap-3 p-3 rounded-2xl border
                        border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-slate-900 dark:text-white">
                                                        Somente atrasadas
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                                        Pendentes com data anterior a hoje
                                                    </p>
                                                </div>

                                                <input
                                                    type="checkbox"
                                                    checked={somenteAtrasadas}
                                                    onChange={() => setSomenteAtrasadas((v) => !v)}
                                                    className="w-5 h-5 accent-indigo-600 cursor-pointer"
                                                />
                                            </label>
                                        </div>

                                        <div className="mt-4 flex items-center justify-end gap-2">
                                            <button
                                                onClick={resetarFiltros}
                                                className="px-4 py-2 rounded-2xl font-black text-[11px] uppercase tracking-widest border
                          bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white
                          border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-90"
                                            >
                                                Limpar
                                            </button>

                                            <button
                                                onClick={() => setFiltroOpen(false)}
                                                className="px-4 py-2 rounded-2xl font-black text-[11px] uppercase tracking-widest border
                          bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 cursor-pointer"
                                            >
                                                Aplicar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* edição */}
                        <button
                            onClick={() => setModoEdicao((v) => !v)}
                            className={`p-3 rounded-2xl font-black cursor-pointer transition-all active:scale-95 border
                ${modoEdicao
                                    ? "bg-slate-900 text-white border-slate-700 dark:bg-white dark:text-slate-900 dark:border-white"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200 dark:border-slate-700"
                                }`}
                            title={modoEdicao ? "Modo edição ativado" : "Ativar modo edição"}
                            aria-label="Modo edição"
                        >
                            <Pencil size={18} />
                        </button>

                        <button
                            onClick={buscarEventos}
                            className="p-3 rounded-2xl font-black cursor-pointer transition-all active:scale-95 border
                bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500
                shadow-[0_10px_25px_-10px_rgba(79,70,229,0.6)]"
                            title="Atualizar calendário"
                            aria-label="Atualizar"
                        >
                            <RefreshCw size={18} />
                        </button>

                        {modoEdicao && (
                            <button
                                onClick={apagarTudoDoCalendario}
                                disabled={apagando}
                                className={`p-3 rounded-2xl font-black cursor-pointer transition-all active:scale-95 border
                  ${apagando
                                        ? "bg-rose-300 text-white opacity-70 cursor-not-allowed border-rose-300"
                                        : "bg-rose-600 hover:bg-rose-500 text-white border-rose-500"
                                    }`}
                                title="Apagar tudo (tarefas + revisões + sessões)"
                                aria-label="Apagar tudo"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Loading */}
                {loading ? (
                    <div className="p-10 rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <p className="text-center text-slate-500 dark:text-slate-400 font-semibold">
                            Carregando calendário...
                        </p>
                    </div>
                ) : (
                    <div className="rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-6 shadow-xl">
                        <style>{calendarStyles}</style>

                        <FullCalendar
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                            locale={ptBrLocale}
                            initialView="dayGridMonth"
                            height="auto"
                            selectable={false}
                            dayMaxEvents={true}
                            weekends={true}
                            events={eventosFiltrados}
                            eventClick={aoClicarEvento}
                            eventContent={renderEventoTrello}
                            headerToolbar={{
                                left: "prev,next today",
                                center: "title",
                                right: "dayGridMonth,timeGridWeek,timeGridDay",
                            }}
                        />
                    </div>
                )}

                {/* ✅ Como ler o calendário */}
                <div className="mt-6 rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                        Como ler o calendário
                    </p>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">
                                Tarja superior
                            </p>
                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                A tarja aparece em <b>Revisões</b> e <b>Estudar agora</b>.
                            </p>

                            <div className="mt-3 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-2 rounded-full" style={{ background: COR_REVISAO }} />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Revisão (azul)
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-2 rounded-full" style={{ background: COR_ESTUDO }} />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Estudar agora (verde)
                                    </span>
                                </div>
                            </div>

                            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                To-do não tem tarja: mostra a prioridade abaixo do título.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">
                                Bolinha (pendente)
                            </p>

                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                A bolinha aparece quando o evento ainda <b>não foi concluído</b>.
                            </p>

                            <div className="mt-3 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: PRIORITY[3].hex }} />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        To-do pendente
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_REVISAO }} />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Revisão pendente
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: COR_ESTUDO }} />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Estudar agora pendente
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">
                                Concluir / sincronizar
                            </p>

                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                Clique no card → abra detalhes → marque como <b>concluído</b>.
                            </p>

                            <ul className="mt-3 text-sm text-slate-700 dark:text-slate-300 font-semibold list-disc pl-5 space-y-2">
                                <li>Atualiza o Supabase.</li>
                                <li>Sincroniza com as outras guias.</li>
                                <li>Concluído preenche o card com a cor do tipo.</li>
                                <li>To-do concluído fica riscado.</li>
                            </ul>

                            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                <b>Atrasadas</b> = pendentes com data anterior a hoje.
                            </p>
                        </div>
                    </div>
                </div>

                <ModalDetalhes />
            </div>
        </div>
    );
};

export default Calendario;
