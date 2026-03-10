import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Play,
    Pause,
    RotateCcw,
    Calendar,
    Bell,
    History,
    Clock3,
    X,
} from "lucide-react";

import { supabase } from "../supabaseClient";

/* ============================
   COMPONENTE MODAL CENTRAL
============================ */
const ModalCentral = ({ open, onClose, title, message, variant = "info", actions }) => {
    if (!open) return null;

    const ring =
        variant === "alarm"
            ? "ring-rose-400/30 dark:ring-rose-500/30"
            : "ring-indigo-400/30 dark:ring-indigo-500/30";

    const badge =
        variant === "alarm"
            ? "bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30"
            : "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30";

    const glow =
        variant === "alarm"
            ? "shadow-[0_0_45px_-20px_rgba(244,63,94,0.55)]"
            : "shadow-[0_0_45px_-20px_rgba(99,102,241,0.55)]";

    return (
        <div className="fixed inset-0 z-[999999] bg-black/60 flex items-center justify-center p-4">
            <div
                className={`w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 ring-2 ${ring} ${glow}`}
            >
                <div className="flex items-start justify-between gap-4">
                    <div className={`px-3 py-1 rounded-full text-xs font-black ${badge}`}>
                        {variant === "alarm" ? "⏰ ALARME" : "✅ STATUS"}
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        aria-label="Fechar"
                    >
                        <X size={18} className="text-slate-500 dark:text-slate-300" />
                    </button>
                </div>

                <h3 className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
                    {title}
                </h3>

                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {message}
                </p>

                {actions?.length > 0 && (
                    <div className="mt-6 flex flex-col gap-3">
                        {actions.map((a) => (
                            <button
                                key={a.label}
                                onClick={a.onClick}
                                className={
                                    a.kind === "primary"
                                        ? "w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm cursor-pointer active:scale-[0.99] transition-all"
                                        : a.kind === "danger"
                                            ? "w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm cursor-pointer active:scale-[0.99] transition-all"
                                            : "w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-sm cursor-pointer active:scale-[0.99] transition-all"
                                }
                            >
                                {a.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/* ============================
   MODAL DETALHES ATIVIDADE
============================ */
const ModalAtividade = ({ open, onClose, atividade, formatarTempo }) => {
    if (!open || !atividade) return null;

    const inicio = new Date(atividade.inicio_em);
    const fim = new Date(inicio.getTime() + (atividade.duracao_segundos || 0) * 1000);

    return (
        <div className="fixed inset-0 z-[999999] bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">
                            Resumo da atividade
                        </p>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                            {atividade.materia}
                        </h3>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                        <X size={18} className="text-slate-500 dark:text-slate-300" />
                    </button>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">Conteúdo</p>
                        <p className="mt-1 font-bold text-slate-900 dark:text-white">
                            {atividade.conteudo || "—"}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">Tipo de estudo</p>
                        <p className="mt-1 font-bold text-slate-900 dark:text-white">
                            {atividade.tipo_estudo}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">Início</p>
                        <p className="mt-1 font-bold text-slate-900 dark:text-white">
                            {inicio.toLocaleString()}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">Fim</p>
                        <p className="mt-1 font-bold text-slate-900 dark:text-white">
                            {fim.toLocaleString()}
                        </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 md:col-span-2">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">Duração</p>
                        <p className="mt-1 font-black font-mono text-indigo-600 dark:text-indigo-400 text-xl">
                            {formatarTempo(atividade.duracao_segundos || 0)}
                        </p>
                    </div>

                    {(atividade.tipo_estudo === "Exercícios" || atividade.tipo_estudo === "Simulado") && (
                        <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-4 md:col-span-2">
                            <p className="text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                                Questões
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl bg-white/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-center">
                                    <p className="text-[11px] text-slate-500 dark:text-slate-300 font-black">Feitas</p>
                                    <p className="font-black text-slate-900 dark:text-white">
                                        {atividade.questoes_feitas || 0}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-white/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-center">
                                    <p className="text-[11px] text-slate-500 dark:text-slate-300 font-black">Acertos</p>
                                    <p className="font-black text-emerald-600">
                                        {atividade.questoes_acertos || 0}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-white/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 text-center">
                                    <p className="text-[11px] text-slate-500 dark:text-slate-300 font-black">Erros</p>
                                    <p className="font-black text-rose-500">
                                        {atividade.questoes_erros || 0}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 md:col-span-2">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-300">Anotações</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white whitespace-pre-wrap">
                            {atividade.anotacao?.trim() ? atividade.anotacao : "—"}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
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
   MODAL DE DURAÇÃO
============================ */
const DuracaoModal = ({ valorInicial, onClose, onSave }) => {
    const [temp, setTemp] = useState(valorInicial);

    const horas = Array.from({ length: 25 }, (_, i) => i);
    const minsSecs = Array.from({ length: 60 }, (_, i) => i);

    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl rounded-3xl bg-slate-900 text-white p-6 md:p-8 shadow-2xl border border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-2xl font-black mb-6">Duração</h3>

                <div className="grid grid-cols-3 gap-6 items-center text-center">
                    <div>
                        <p className="text-xs font-black text-slate-400 mb-2">Horas</p>
                        <select
                            value={temp.h}
                            onChange={(e) => setTemp({ ...temp, h: Number(e.target.value) })}
                            className="w-full text-center text-2xl font-black bg-transparent border-b-2 border-cyan-400 pb-2 outline-none"
                        >
                            {horas.map((n) => (
                                <option key={n} value={n} className="text-slate-900">
                                    {n}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <p className="text-xs font-black text-slate-400 mb-2">Min</p>
                        <select
                            value={temp.m}
                            onChange={(e) => setTemp({ ...temp, m: Number(e.target.value) })}
                            className="w-full text-center text-2xl font-black bg-transparent border-b-2 border-cyan-400 pb-2 outline-none"
                        >
                            {minsSecs.map((n) => (
                                <option key={n} value={n} className="text-slate-900">
                                    {n}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <p className="text-xs font-black text-slate-400 mb-2">Seg</p>
                        <select
                            value={temp.s}
                            onChange={(e) => setTemp({ ...temp, s: Number(e.target.value) })}
                            className="w-full text-center text-2xl font-black bg-transparent border-b-2 border-cyan-400 pb-2 outline-none"
                        >
                            {minsSecs.map((n) => (
                                <option key={n} value={n} className="text-slate-900">
                                    {n}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-6 mt-8 text-sm font-black">
                    <button onClick={onClose} className="text-rose-400 hover:text-rose-300 cursor-pointer">
                        CANCELAR
                    </button>

                    <button
                        onClick={() => onSave(temp)}
                        className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black cursor-pointer"
                    >
                        SALVAR
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ============================
   COMPONENTE PRINCIPAL
============================ */
const EstudarAgora = ({ user }) => {
    const [abaAtiva, setAbaAtiva] = useState("cronometro"); // manual | cronometro
    const [loading, setLoading] = useState(false);

    // Inputs gerais
    const [materia, setMateria] = useState("");
    const [conteudo, setConteudo] = useState("");
    const [tipoEstudo, setTipoEstudo] = useState("Teoria");
    const [anotacao, setAnotacao] = useState("");
    const [verMaisAtividades, setVerMaisAtividades] = useState(false);

    const buscarSugestoesConteudo = async () => {
        if (!user?.id) return;

        // Se você tiver materiaNome no seu cronômetro:
        const materiaAtual = (materia || "").trim();

        // 1) tenta puxar da tabela materia_conteudos usando o nome da matéria
        // primeiro precisamos achar a matéria no banco
        if (materiaAtual) {
            const { data: matData, error: matErr } = await supabase
                .from("materias")
                .select("id")
                .eq("user_id", user.id)
                .eq("nome", materiaAtual)
                .maybeSingle();

            if (!matErr && matData?.id) {
                const { data: conts } = await supabase
                    .from("materia_conteudos")
                    .select("titulo")
                    .eq("user_id", user.id)
                    .eq("materia_id", matData.id)
                    .order("created_at", { ascending: false })
                    .limit(8);

                const lista = (conts || [])
                    .map((c) => c.titulo)
                    .filter(Boolean);

                setConteudoSugestoes(lista);
                return;
            }
        }

        // 2) fallback: pega conteúdos recentes digitados nas sessões
        const { data: ultimos } = await supabase
            .from("sessoes_estudo")
            .select("conteudo")
            .eq("user_id", user.id)
            .order("inicio_em", { ascending: false })
            .limit(20);

        // remove repetidos
        const unicos = [];
        const seen = new Set();
        (ultimos || []).forEach((u) => {
            const t = (u.conteudo || "").trim();
            if (!t) return;
            const key = t.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            unicos.push(t);
        });

        setConteudoSugestoes(unicos.slice(0, 8));
    };


    // ✅ Matérias recentes (dropdown ao clicar)
    const [materiasRecentes, setMateriasRecentes] = useState([]);
    const [mostrarSugestoesMateria, setMostrarSugestoesMateria] = useState(false);
    const [materiaBusca, setMateriaBusca] = useState(""); // usado para filtrar sugestões
    const blurMateriaTimeoutRef = useRef(null);
    const [conteudoSugestoes, setConteudoSugestoes] = useState([]);
    const [showSugestoesConteudo, setShowSugestoesConteudo] = useState(false);
    const [conteudoBusca, setConteudoBusca] = useState("");
    const blurConteudoTimeoutRef = useRef(null);



    // Revisões
    const [agendarRevisao, setAgendarRevisao] = useState(false);
    const revisoesPreset = useMemo(
        () => [
            { label: "1 dia", days: 1 },
            { label: "3 dias", days: 3 },
            { label: "7 dias", days: 7 },
            { label: "15 dias", days: 15 },
            { label: "30 dias", days: 30 },
        ],
        []
    );
    const [revisoesSelecionadas, setRevisoesSelecionadas] = useState([1]);

    // Questões
    const [questoes, setQuestoes] = useState({ feitas: 0, acertos: 0, erros: 0 });

    // Manual
    const hojeISO = useMemo(() => new Date().toISOString().split("T")[0], []);
    const agoraHHMM = useMemo(() => {
        const d = new Date();
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }, []);
    const [dataInicio, setDataInicio] = useState(hojeISO);
    const [horaInicio, setHoraInicio] = useState(agoraHHMM);

    // Modal duração manual
    const [duracaoModalAberto, setDuracaoModalAberto] = useState(false);
    const [duracaoManual, setDuracaoManual] = useState({ h: 0, m: 0, s: 0 });

    // Cronômetro
    const [segundos, setSegundos] = useState(0);
    const [ativo, setAtivo] = useState(false);
    const [inicioCronometroEm, setInicioCronometroEm] = useState(null);
    const [cronometroHidratado, setCronometroHidratado] = useState(false);
    const cronometroStorageKey = useMemo(
        () => (user?.id ? `estudar-agora-cronometro:${user.id}` : null),
        [user?.id]
    );

    // Alarmes (configs)
    const [alarmeTipo, setAlarmeTipo] = useState("nenhum"); // nenhum | duracao | horario
    const [alarmeDuracaoMin, setAlarmeDuracaoMin] = useState("30");
    const [alarmeHorario, setAlarmeHorario] = useState(agoraHHMM);

    // Alarmes ativos e concluídos
    const [alarmesAtivos, setAlarmesAtivos] = useState([]);
    const [alarmesConcluidos, setAlarmesConcluidos] = useState([]);

    // timeouts apenas para alarmes POR HORÁRIO (para continuar mesmo pausado)
    const alarmesTimeoutsRef = useRef(new Map());

    // Últimas atividades
    const [ultimasAtividades, setUltimasAtividades] = useState([]);

    // Modal detalhes atividade
    const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
    const [modalAtividadeOpen, setModalAtividadeOpen] = useState(false);

    // Modal Central
    const [modalCentral, setModalCentral] = useState({
        open: false,
        title: "",
        message: "",
        variant: "info", // info | alarm
        actions: [],
    });

    // Toast
    const [toast, setToast] = useState({ show: false, title: "", message: "" });
    const toastTimer = useRef(null);

    const showToast = (title, message) => {
        clearTimeout(toastTimer.current);
        setToast({ show: true, title, message });
        toastTimer.current = setTimeout(() => {
            setToast({ show: false, title: "", message: "" });
        }, 4500);
    };

    /* ========= NOTIFICAÇÕES ========= */
    const suporteNotificacao = typeof window !== "undefined" && "Notification" in window;

    const pedirPermissaoNotificacao = async () => {
        if (!suporteNotificacao) return false;
        if (Notification.permission === "granted") return true;
        if (Notification.permission === "denied") return false;
        const perm = await Notification.requestPermission();
        return perm === "granted";
    };

    const playBeep = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.value = 880;
            gain.gain.value = 0.12;

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            setTimeout(() => {
                osc.stop();
                ctx.close();
            }, 1100);
        } catch (e) { }
    };

    const vibrar = () => {
        try {
            if ("vibrate" in navigator) navigator.vibrate([250, 120, 250, 120, 350]);
        } catch (e) { }
    };

    const dispararNotificacao = () => {
        if (suporteNotificacao && Notification.permission === "granted") {
            const n = new Notification("⏰ Alarme!", {
                body: `Sessão: ${materia || "Estudo"} • ${conteudo || "Sem conteúdo"}`,
                silent: false,
            });
            n.onclick = () => {
                window.focus();
                n.close();
            };
        }
    };

    /* ========= HELPERS ========= */
    const formatarTempo = (s) => {
        const total = Math.max(0, Number(s || 0));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const seg = total % 60;
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${seg
            .toString()
            .padStart(2, "0")}`;
    };

    const calcularRemainingSeg = (fireAt) => Math.max(0, Math.ceil((fireAt - Date.now()) / 1000));

    const msAteHorario = (hhmm) => {
        const [hh, mm] = String(hhmm || "00:00").split(":").map(Number);
        if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;

        const agora = new Date();
        const alvo = new Date();
        alvo.setHours(hh, mm, 0, 0);

        if (alvo.getTime() <= agora.getTime()) alvo.setDate(alvo.getDate() + 1);
        return alvo.getTime() - agora.getTime();
    };

    const duracaoManualEmSegundos = () => {
        const h = Number(duracaoManual.h || 0);
        const m = Number(duracaoManual.m || 0);
        const s = Number(duracaoManual.s || 0);
        return h * 3600 + m * 60 + s;
    };

    // soma das durações dos alarmes concluídos
    const totalAlarmesConcluidosSeg = useMemo(() => {
        return alarmesConcluidos.reduce((acc, a) => acc + (Number(a.duracaoSegundos) || 0), 0);
    }, [alarmesConcluidos]);

    // ✅ total que será salvo (prévia)
    const duracaoTotalParaSalvar = useMemo(() => {
        if (abaAtiva === "manual") return duracaoManualEmSegundos();
        if (segundos > 0) return segundos;
        return totalAlarmesConcluidosSeg;
    }, [abaAtiva, segundos, totalAlarmesConcluidosSeg]);

    /* ========= CRONÔMETRO ========= */
    useEffect(() => {
        if (showSugestoesConteudo) {
            buscarSugestoesConteudo();
        }
        // eslint-disable-next-line
    }, [showSugestoesConteudo, materia]);


    const ultimoTickMsRef = useRef(null);

    useEffect(() => {
        if (!cronometroStorageKey) {
            setCronometroHidratado(true);
            return;
        }

        try {
            const raw = localStorage.getItem(cronometroStorageKey);
            if (!raw) {
                setCronometroHidratado(true);
                return;
            }

            const parsed = JSON.parse(raw);
            const segundosSalvos = Math.max(0, Number(parsed?.segundos || 0));
            const ativoSalvo = Boolean(parsed?.ativo);
            const savedAtMs = Number(parsed?.savedAtMs || Date.now());
            const deltaSeg = ativoSalvo ? Math.max(0, Math.floor((Date.now() - savedAtMs) / 1000)) : 0;

            setSegundos(segundosSalvos + deltaSeg);
            setAtivo(ativoSalvo);
            setInicioCronometroEm(parsed?.inicioCronometroEm || null);
            ultimoTickMsRef.current = ativoSalvo ? Date.now() : null;
        } catch (e) {
            localStorage.removeItem(cronometroStorageKey);
        } finally {
            setCronometroHidratado(true);
        }
    }, [cronometroStorageKey]);

    useEffect(() => {
        if (!cronometroHidratado || !cronometroStorageKey) return;

        localStorage.setItem(
            cronometroStorageKey,
            JSON.stringify({
                segundos,
                ativo,
                inicioCronometroEm,
                savedAtMs: Date.now(),
            })
        );
    }, [cronometroHidratado, cronometroStorageKey, segundos, ativo, inicioCronometroEm]);

    useEffect(() => {
        if (!ativo) {
            ultimoTickMsRef.current = null;
            return undefined;
        }

        if (!ultimoTickMsRef.current) ultimoTickMsRef.current = Date.now();

        const atualizarCronometro = () => {
            const agora = Date.now();
            const ultimoTick = ultimoTickMsRef.current || agora;
            const deltaSeg = Math.floor((agora - ultimoTick) / 1000);

            if (deltaSeg <= 0) return;

            setSegundos((s) => s + deltaSeg);
            ultimoTickMsRef.current = ultimoTick + deltaSeg * 1000;
        };

        const intervalo = setInterval(atualizarCronometro, 250);
        return () => clearInterval(intervalo);
    }, [ativo]);

    const segundosRef = useRef(0);
    useEffect(() => {
        segundosRef.current = segundos;
    }, [segundos]);

    const iniciarCronometroSePrecisar = () => {
        if (!inicioCronometroEm) setInicioCronometroEm(new Date().toISOString());
        setAtivo(true);
    };

    const iniciarOuPausar = () => {
        if (!ativo && segundos === 0 && !inicioCronometroEm) setInicioCronometroEm(new Date().toISOString());
        setAtivo((v) => !v);
    };

    /* =========================================================
       ✅ RESET: NÃO APAGA ALARMES CONFIGURADOS
       - reseta apenas o cronômetro
       - mantém alarmes ativos visíveis
       - recalibra alarmes de duração para reiniciarem do zero
       - NÃO mexe nos timeouts de horário (continuam existindo)
    ========================================================== */
    const resetarCronometro = () => {
        setSegundos(0);
        setAtivo(false);
        setInicioCronometroEm(null);
        ultimoTickMsRef.current = null;

        // ✅ NÃO remove alarmes ativos
        // ✅ Apenas reinicia "duração" para contar do zero de novo
        setAlarmesAtivos((prev) =>
            prev.map((a) => {
                if (a.tipo === "duracao") {
                    return {
                        ...a,
                        startSeconds: 0,
                        remaining: a.targetSeconds,
                    };
                }
                // horário continua como está (fireAt permanece)
                return a;
            })
        );

        // NÃO apaga concluídos (pra você poder salvar só eles)
    };

    /* ========= ALARMES: add/remove ========= */
    const removerAlarmeAtivo = (id) => {
        setAlarmesAtivos((prev) => prev.filter((a) => a.id !== id));

        // só existe timeout para alarme por horário
        const timeout = alarmesTimeoutsRef.current.get(id);
        if (timeout) {
            clearTimeout(timeout);
            alarmesTimeoutsRef.current.delete(id);
        }
    };

    const cancelarAlarmeAtivo = (id) => {
        removerAlarmeAtivo(id);
        showToast("⛔ Alarme cancelado", "O alarme foi removido.");
    };

    /* ========= ALARMES CONCLUÍDOS: excluir (com confirmação) ========= */
    const confirmarExcluirAlarmeConcluido = (id) => {
        setModalCentral({
            open: true,
            variant: "info",
            title: "Excluir alarme concluído?",
            message: "Tem certeza que deseja excluir este alarme concluído? O tempo será subtraído do cronômetro e do total a salvar.",
            actions: [
                {
                    label: "Cancelar",
                    kind: "secondary",
                    onClick: () => setModalCentral((m) => ({ ...m, open: false })),
                },
                {
                    label: "Excluir",
                    kind: "danger",
                    onClick: () => {
                        const alarme = alarmesConcluidos.find((a) => a.id === id);
                        const tempo = Number(alarme?.duracaoSegundos || 0);

                        // ✅ subtrai do cronômetro
                        setSegundos((s) => Math.max(0, s - tempo));

                        // remove da lista
                        setAlarmesConcluidos((prev) => prev.filter((a) => a.id !== id));

                        setModalCentral((m) => ({ ...m, open: false }));
                        showToast("🗑️ Excluído", "O alarme concluído foi removido e o tempo foi subtraído.");
                    },
                },
            ],
        });
    };

    /* ========= ALARME: DISPARO ========= */
    const dispararAlarme = (alarmeData, duracaoConcluidaSeg) => {
        playBeep();
        vibrar();
        dispararNotificacao();

        // ✅ pausa o cronômetro, mas NÃO zera
        setAtivo(false);

        // ✅ adiciona concluído COM duração
        setAlarmesConcluidos((prev) => [
            ...prev,
            {
                id: `done-${Date.now()}`,
                tipo: alarmeData?.tipo,
                label: alarmeData?.label || "Alarme concluído",
                duracaoSegundos: Math.max(0, Number(duracaoConcluidaSeg || 0)),
                firedAt: Date.now(),
            },
        ]);

        setModalCentral({
            open: true,
            variant: "alarm",
            title: "⏰ Hora de pausar!",
            message:
                "Seu alarme disparou. O cronômetro foi pausado e NÃO zerou — você pode dar play e continuar do mesmo tempo.",
            actions: [
                {
                    label: "Fechar",
                    kind: "secondary",
                    onClick: () => setModalCentral((m) => ({ ...m, open: false })),
                },
            ],
        });
    };

    const alarmeJaAdicionado = (tipo, valor) => {
        if (!tipo || tipo === "nenhum") return false;
        if (tipo === "duracao") {
            return alarmesAtivos.some((a) => a.tipo === "duracao" && String(a.valorRaw) === String(valor));
        }
        if (tipo === "horario") {
            return alarmesAtivos.some((a) => a.tipo === "horario" && String(a.valorRaw) === String(valor));
        }
        return false;
    };

    /* =========================================================
       ✅ CRIAR ALARME ATIVO
       REGRA NOVA:
       - Só liga automaticamente se o cronômetro NUNCA foi iniciado.
       - Se você deu pause manualmente, NÃO dá play sozinho.
    ========================================================== */
    const criarAlarmeAtivo = async () => {
        if (alarmeTipo === "nenhum") {
            showToast("Selecione um tipo", "Escolha 'Por duração' ou 'Por horário'.");
            return;
        }

        // ✅ Auto-play SOMENTE se nunca iniciou (parado desde sempre)
        const cronometroNuncaIniciado =
            !inicioCronometroEm && segundosRef.current === 0 && !ativo;

        if (cronometroNuncaIniciado) {
            iniciarCronometroSePrecisar();
        }

        await pedirPermissaoNotificacao();

        if (alarmeTipo === "duracao") {
            const alvoSeg = Number(alarmeDuracaoMin || 0) * 60;
            if (alvoSeg <= 0) {
                showToast("Tempo inválido", "Escolha uma duração válida.");
                return;
            }

            if (alarmeJaAdicionado("duracao", alarmeDuracaoMin)) {
                showToast("⚠️ Alarme já adicionado", "Esse alarme por duração já está ativo.");
                return;
            }

            const id = `dur-${Date.now()}`;
            const alarmeData = {
                id,
                tipo: "duracao",
                valorRaw: alarmeDuracaoMin,
                label: `Duração • ${alarmeDuracaoMin} min`,
                targetSeconds: alvoSeg,
                startSeconds: segundosRef.current,
                remaining: alvoSeg,
            };

            setAlarmesAtivos((prev) => [...prev, alarmeData]);
            showToast("✅ Alarme ativado", `Vai disparar após ${alarmeDuracaoMin} min de estudo (pausa congela).`);
            return;
        }

        if (alarmeTipo === "horario") {
            if (alarmeJaAdicionado("horario", alarmeHorario)) {
                showToast("⚠️ Alarme já adicionado", "Esse alarme por horário já está ativo.");
                return;
            }

            const ms = msAteHorario(alarmeHorario);
            if (ms <= 0) {
                showToast("Horário inválido", "Não consegui calcular o horário do alarme.");
                return;
            }

            const id = `hr-${Date.now()}`;
            const fireAt = Date.now() + ms;

            const alarmeData = {
                id,
                tipo: "horario",
                valorRaw: alarmeHorario,
                label: `Horário • ${alarmeHorario}`,
                fireAt,
                remaining: Math.ceil(ms / 1000),
            };

            setAlarmesAtivos((prev) => [...prev, alarmeData]);

            // ✅ por horário: continua regressiva mesmo com cronômetro pausado
            const t = setTimeout(() => {
                dispararAlarme(alarmeData, segundosRef.current);
                removerAlarmeAtivo(id);
            }, ms);

            alarmesTimeoutsRef.current.set(id, t);

            showToast("✅ Alarme ativado", `Vai disparar às ${alarmeHorario}. (continua contando mesmo pausado)`);
        }
    };

    /* ========= COUNTDOWN (UI) ========= */
    useEffect(() => {
        if (alarmesAtivos.length === 0) return;

        const interval = setInterval(() => {
            setAlarmesAtivos((prev) =>
                prev.map((a) => {
                    if (a.tipo === "horario") {
                        return { ...a, remaining: calcularRemainingSeg(a.fireAt) };
                    }

                    if (a.tipo === "duracao") {
                        const passado = Math.max(0, segundosRef.current - a.startSeconds);
                        const remaining = Math.max(0, a.targetSeconds - passado);
                        return { ...a, remaining };
                    }

                    return a;
                })
            );
        }, 1000);

        return () => clearInterval(interval);
    }, [alarmesAtivos.length]);

    /* ========= DISPARO POR DURAÇÃO ========= */
    useEffect(() => {
        const duracaoAlarmes = alarmesAtivos.filter((a) => a.tipo === "duracao");
        if (duracaoAlarmes.length === 0) return;

        duracaoAlarmes.forEach((a) => {
            const passado = Math.max(0, segundos - a.startSeconds);
            const remaining = Math.max(0, a.targetSeconds - passado);

            if (remaining === 0) {
                dispararAlarme(a, a.targetSeconds);
                removerAlarmeAtivo(a.id);
            }
        });

        // eslint-disable-next-line
    }, [segundos, alarmesAtivos]);

    /* ========= QUESTÕES: validação ========= */
    const setFeitas = (val) => {
        const feitas = Math.max(0, Number(val || 0));
        let acertos = Number(questoes.acertos || 0);
        let erros = Number(questoes.erros || 0);

        if (acertos > feitas) acertos = feitas;
        if (erros > feitas) erros = feitas;
        if (acertos + erros > feitas) erros = Math.max(0, feitas - acertos);

        setQuestoes({ feitas, acertos, erros });
    };

    const setAcertos = (val) => {
        const acertos = Math.max(0, Number(val || 0));
        const feitas = Number(questoes.feitas || 0);
        let erros = Number(questoes.erros || 0);

        const acertosClamped = Math.min(acertos, feitas);
        if (acertosClamped + erros > feitas) erros = Math.max(0, feitas - acertosClamped);

        setQuestoes({ ...questoes, acertos: acertosClamped, erros });
    };

    const setErros = (val) => {
        const erros = Math.max(0, Number(val || 0));
        const feitas = Number(questoes.feitas || 0);
        let acertos = Number(questoes.acertos || 0);

        const errosClamped = Math.min(erros, feitas);
        if (acertos + errosClamped > feitas) acertos = Math.max(0, feitas - errosClamped);

        setQuestoes({ ...questoes, erros: errosClamped, acertos });
    };

    /* ========= REVISÕES ========= */
    const alternarDiaRevisao = (days) => {
        setRevisoesSelecionadas((atual) => {
            if (atual.includes(days)) {
                const novo = atual.filter((d) => d !== days);
                return novo.length === 0 ? [1] : novo;
            }
            return [...atual, days].sort((a, b) => a - b);
        });
    };

    const mapTipoRevisao = (tipo) => {
        // AgendaRevisoes usa: Teoria | Questões | Simulado
        if (tipo === "Exercícios") return "Questões";
        if (tipo === "Simulado") return "Simulado";
        return "Teoria";
    };

    const criarRevisoes = async (materiaBase, conteudoBase, tipoBase, metaQuestoesBase = 0) => {
        const inserts = revisoesSelecionadas.map((dias) => {
            const dataRev = new Date();
            dataRev.setDate(dataRev.getDate() + dias);

            return {
                user_id: user.id,
                titulo: materiaBase,
                conteudo: conteudoBase || "",
                data_revisao: dataRev.toISOString().split("T")[0],
                tipo_revisao: mapTipoRevisao(tipoBase),
                meta_questoes: Number(metaQuestoesBase) || 0,
                origem: "Estudar Agora",
                executada: false,
            };
        });

        const { error } = await supabase.from("revisoes_agendadas").insert(inserts);
        if (error) showToast("Erro ao agendar", error.message);
    };


    /* ========= SUPABASE: últimas atividades ========= */
    const buscarUltimasAtividades = async () => {
        const { data, error } = await supabase
            .from("sessoes_estudo")
            .select("*")
            .eq("user_id", user.id)
            .order("inicio_em", { ascending: false })
            .limit(50);

        if (!error && data) setUltimasAtividades(data);
    };
    // ✅ Matérias recentes: pega do histórico (últimas que você digitou)
    const buscarMateriasRecentes = async () => {
        try {
            const { data, error } = await supabase
                .from("sessoes_estudo")
                .select("materia")
                .eq("user_id", user.id)
                .order("inicio_em", { ascending: false })
                .limit(30);

            if (error) return;

            const unicas = [];
            const seen = new Set();

            (data || []).forEach((row) => {
                const nome = (row.materia || "").trim();
                if (!nome) return;
                const key = nome.toLowerCase();
                if (seen.has(key)) return;
                seen.add(key);
                unicas.push(nome);
            });

            setMateriasRecentes(unicas.slice(0, 12));
        } catch (e) {
            // silencioso
        }
    };



    useEffect(() => {
        buscarUltimasAtividades();
        buscarMateriasRecentes();
        // eslint-disable-next-line
    }, []);

    /* ========= SALVAR SESSÃO ========= */
    const salvarSessao = async () => {
        if (!materia.trim()) {
            setModalCentral({
                open: true,
                variant: "info",
                title: "Faltou matéria",
                message: "Defina uma matéria antes de salvar.",
                actions: [
                    { label: "Entendi", kind: "primary", onClick: () => setModalCentral((m) => ({ ...m, open: false })) },
                ],
            });
            return;
        }

        if (tipoEstudo === "Exercícios" || tipoEstudo === "Simulado") {
            const feitas = Number(questoes.feitas || 0);
            const acertos = Number(questoes.acertos || 0);
            const erros = Number(questoes.erros || 0);

            if (acertos > feitas || erros > feitas || acertos + erros > feitas) {
                setModalCentral({
                    open: true,
                    variant: "info",
                    title: "Números inconsistentes",
                    message: "Acertos/Erros não podem ultrapassar Questões feitas.",
                    actions: [
                        { label: "Ok", kind: "primary", onClick: () => setModalCentral((m) => ({ ...m, open: false })) },
                    ],
                });
                return;
            }
        }

        setLoading(true);

        try {
            let inicio_em_iso = null;
            let duracao_segundos = 0;
            const modo = abaAtiva;

            if (abaAtiva === "manual") {
                const inicioLocal = new Date(`${dataInicio}T${horaInicio}:00`);
                inicio_em_iso = inicioLocal.toISOString();
                duracao_segundos = duracaoManualEmSegundos();
            } else {
                inicio_em_iso = inicioCronometroEm ?? new Date().toISOString();

                duracao_segundos = segundos > 0 ? segundos : totalAlarmesConcluidosSeg;
            }

            const duracao_hms = formatarTempo(duracao_segundos);

            // ✅ NÃO salva se não marcou tempo nenhum
            if (duracao_segundos <= 0) {
                setLoading(false);

                setModalCentral({
                    open: true,
                    variant: "info",
                    title: "⏱️ Nenhum tempo foi marcado",
                    message:
                        "Para salvar uma atividade, inicie o cronômetro ou conclua pelo menos 1 alarme. (Tempo atual: 00:00:00)",
                    actions: [
                        {
                            label: "Entendi",
                            kind: "primary",
                            onClick: () =>
                                setModalCentral((m) => ({ ...m, open: false })),
                        },
                    ],
                });
                return;
            }


            const payload = {
                user_id: user.id,
                materia: materia.trim(),
                conteudo: conteudo.trim(),
                tipo_estudo: tipoEstudo,
                inicio_em: inicio_em_iso,
                duracao_segundos,
                duracao_hms,
                modo,
                anotacao: anotacao.trim(),

                questoes_feitas:
                    tipoEstudo === "Exercícios" || tipoEstudo === "Simulado" ? Number(questoes.feitas || 0) : 0,
                questoes_acertos:
                    tipoEstudo === "Exercícios" || tipoEstudo === "Simulado" ? Number(questoes.acertos || 0) : 0,
                questoes_erros:
                    tipoEstudo === "Exercícios" || tipoEstudo === "Simulado" ? Number(questoes.erros || 0) : 0,

                alarme_tipo: alarmeTipo,
                alarme_valor:
                    alarmeTipo === "duracao"
                        ? String(alarmeDuracaoMin)
                        : alarmeTipo === "horario"
                            ? String(alarmeHorario)
                            : null,
            };

            const { error } = await supabase.from("sessoes_estudo").insert([payload]);

            if (error) {
                setModalCentral({
                    open: true,
                    variant: "info",
                    title: "Erro ao salvar",
                    message: error.message,
                    actions: [
                        { label: "Ok", kind: "primary", onClick: () => setModalCentral((m) => ({ ...m, open: false })) },
                    ],
                });
                return;
            }
            // ✅ GARANTIR que Matérias e Conteúdos existam (para aba Matérias preencher automaticamente)
            // ✅ GARANTIR que Matérias e Conteúdos existam (para aba Matérias preencher automaticamente)
            const materiaNome = (materia || "").trim();
            const conteudoNome = (conteudo || "").trim();

            // Paleta de cores (cada matéria nova ganha uma diferente)
            const PALETA_CORES = [
                "#ef4444", // vermelho
                "#3b82f6", // azul
                "#22c55e", // verde
                "#facc15", // amarelo
                "#a855f7", // roxo
                "#fb923c", // laranja
                "#94a3b8", // cinza
                "#ec4899", // rosa
            ];

            // Gera cor estável pelo nome, mas tenta evitar repetir cor já usada
            const gerarCorParaMateria = (nome, coresUsadas) => {
                let hash = 0;
                for (let i = 0; i < nome.length; i++) {
                    hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
                }

                let cor = PALETA_CORES[hash % PALETA_CORES.length];

                // Se já tiver sendo usada, tenta pegar outra livre
                if (coresUsadas.includes(cor)) {
                    const livre = PALETA_CORES.find((c) => !coresUsadas.includes(c));
                    if (livre) cor = livre;
                }

                return cor;
            };

            // 1) ver se matéria já existe
            const { data: materiaExistente, error: errFindMat } = await supabase
                .from("materias")
                .select("id, nome, cor_hex")
                .eq("user_id", user.id)
                .eq("nome", materiaNome)
                .maybeSingle();

            let materiaRowFinal = materiaExistente;

            if (errFindMat) {
                throw errFindMat;
            }

            // 2) se não existe, cria com uma cor automática diferente
            if (!materiaExistente) {
                // pega cores já usadas pelo usuário
                const { data: matsCores } = await supabase
                    .from("materias")
                    .select("cor_hex")
                    .eq("user_id", user.id);

                const coresUsadas = (matsCores || [])
                    .map((m) => (m.cor_hex || "").toLowerCase())
                    .filter(Boolean);

                const corEscolhida = gerarCorParaMateria(materiaNome.toLowerCase(), coresUsadas);

                const { data: criada, error: errInsert } = await supabase
                    .from("materias")
                    .insert([
                        {
                            user_id: user.id,
                            nome: materiaNome,
                            cor_hex: corEscolhida,
                        },
                    ])
                    .select("*")
                    .single();

                if (errInsert) throw errInsert;
                materiaRowFinal = criada;
            }

            // fallback de compatibilidade: busca por nome caso insert/select retorne vazio
            if (!materiaRowFinal?.id) {
                const { data: fallbackMateria, error: fallbackError } = await supabase
                    .from("materias")
                    .select("id,nome,cor_hex")
                    .eq("user_id", user.id)
                    .eq("nome", materiaNome)
                    .maybeSingle();

                if (fallbackError) throw fallbackError;
                materiaRowFinal = fallbackMateria || null;
            }

            if (!materiaRowFinal?.id) {
                throw new Error("Não foi possível vincular a sessão a uma matéria.");
            }

            // 3) adiciona conteúdo se tiver
            if (conteudoNome) {
                const { error: conteudoError } = await supabase
                    .from("materia_conteudos")
                    .upsert(
                        [
                            {
                                user_id: user.id,
                                materia_id: materiaRowFinal.id, // bigint ✅
                                titulo: conteudoNome,
                            },
                        ],
                        { onConflict: "materia_id,titulo" }
                    );

                if (conteudoError) throw conteudoError;
            }


            // ✅ Se marcou agendar revisão, cria revisões completas para aparecer em Revisões + Calendário
            if (agendarRevisao) {
                const meta =
                    tipoEstudo === "Exercícios" || tipoEstudo === "Simulado"
                        ? Number(questoes.feitas || 0)
                        : 0;
                await criarRevisoes(materiaNome, conteudoNome, tipoEstudo, meta);
            }

            setAlarmesConcluidos([]);

            setModalCentral({
                open: true,
                variant: "info",
                title: "✅ Atividade registrada!",
                message: `📚 ${materiaNome}${conteudoNome ? ` — ${conteudoNome}` : ""}\n⏱️ ${formatarTempo(duracao_segundos)} registrado com sucesso.`,

                actions: [{ label: "Fechar", kind: "primary", onClick: () => setModalCentral((m) => ({ ...m, open: false })) }],
            });

            setMateria("");
            setConteudo("");
            setAnotacao("");
            setAgendarRevisao(false);
            setRevisoesSelecionadas([1]);
            setQuestoes({ feitas: 0, acertos: 0, erros: 0 });

            if (abaAtiva === "cronometro") resetarCronometro();
            if (abaAtiva === "manual") setDuracaoManual({ h: 0, m: 0, s: 0 });

            await buscarUltimasAtividades();
            await buscarMateriasRecentes();
        } finally {
            setLoading(false);
        }
    };

    const DuracaoTexto = useMemo(() => {
        const hh = String(duracaoManual.h).padStart(2, "0");
        const mm = String(duracaoManual.m).padStart(2, "0");
        const ss = String(duracaoManual.s).padStart(2, "0");
        return `${hh}:${mm}:${ss}`;
    }, [duracaoManual]);

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <ModalCentral
                open={modalCentral.open}
                onClose={() => setModalCentral((m) => ({ ...m, open: false }))}
                title={modalCentral.title}
                message={modalCentral.message}
                variant={modalCentral.variant}
                actions={modalCentral.actions}
            />

            <ModalAtividade
                open={modalAtividadeOpen}
                onClose={() => setModalAtividadeOpen(false)}
                atividade={atividadeSelecionada}
                formatarTempo={formatarTempo}
            />

            {toast.show && (
                <div className="fixed top-6 right-6 z-[99999] w-[320px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4">
                    <p className="font-black text-slate-900 dark:text-white">{toast.title}</p>
                    <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">{toast.message}</p>
                    <button
                        onClick={() => setToast({ show: false, title: "", message: "" })}
                        className="mt-3 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl shadow-inner">
                <button
                    onClick={() => setAbaAtiva("manual")}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all cursor-pointer
          ${abaAtiva === "manual" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 dark:text-slate-200"}`}
                >
                    Manual
                </button>

                <button
                    onClick={() => setAbaAtiva("cronometro")}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all cursor-pointer
          ${abaAtiva === "cronometro" ? "bg-indigo-600 text-white shadow-md" : "text-slate-600 dark:text-slate-200"}`}
                >
                    Cronômetro
                </button>
            </div>

            {/* Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-xl">
                {/* Inputs Base */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Matéria"
                            value={materia}
                            onChange={(e) => {
                                setMateria(e.target.value);
                                setMateriaBusca(e.target.value);
                                setMostrarSugestoesMateria(true);
                            }}
                            onFocus={() => {
                                if (blurMateriaTimeoutRef.current) clearTimeout(blurMateriaTimeoutRef.current);
                                setMateriaBusca(materia);
                                setMostrarSugestoesMateria(true);
                            }}
                            onBlur={() => {
                                // dá tempo de clicar na sugestão sem fechar antes
                                blurMateriaTimeoutRef.current = setTimeout(() => {
                                    setMostrarSugestoesMateria(false);
                                }, 150);
                            }}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />

                        {mostrarSugestoesMateria && materiasRecentes?.length > 0 && (
                            <div className="absolute left-0 right-0 mt-2 z-50 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                                <div className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40">
                                    Recentes
                                </div>

                                <div className="max-h-56 overflow-auto">
                                    {materiasRecentes
                                        .filter((m) => {
                                            const q = (materiaBusca || "").trim().toLowerCase();
                                            if (!q) return true;
                                            return m.toLowerCase().includes(q);
                                        })
                                        .map((m) => (
                                            <button
                                                type="button"
                                                key={m}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    setMateria(m);
                                                    setMateriaBusca(m);
                                                    setMostrarSugestoesMateria(false);
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-sm font-bold text-slate-900 dark:text-white"
                                            >
                                                {m}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>


                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Conteúdo"
                            value={conteudo}
                            onChange={(e) => {
                                setConteudo(e.target.value);
                                setConteudoBusca(e.target.value);
                                setShowSugestoesConteudo(true);
                            }}
                            onFocus={() => {
                                if (blurConteudoTimeoutRef.current) clearTimeout(blurConteudoTimeoutRef.current);
                                setConteudoBusca(conteudo);
                                setShowSugestoesConteudo(true);
                            }}
                            onBlur={() => {
                                blurConteudoTimeoutRef.current = setTimeout(() => {
                                    setShowSugestoesConteudo(false);
                                }, 150);
                            }}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />

                        {showSugestoesConteudo && conteudoSugestoes?.length > 0 && (
                            <div className="absolute left-0 right-0 mt-2 z-50 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                                <div className="px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40">
                                    Recentes
                                </div>

                                <div className="max-h-56 overflow-auto">
                                    {conteudoSugestoes
                                        .filter((c) => {
                                            const q = (conteudoBusca || "").trim().toLowerCase();
                                            if (!q) return true;
                                            return c.toLowerCase().includes(q);
                                        })
                                        .map((c) => (
                                            <button
                                                type="button"
                                                key={c}
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() => {
                                                    setConteudo(c);
                                                    setConteudoBusca(c);
                                                    setShowSugestoesConteudo(false);
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-sm font-bold text-slate-900 dark:text-white"
                                            >
                                                {c}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>


                    <select
                        value={tipoEstudo}
                        onChange={(e) => setTipoEstudo(e.target.value)}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 md:col-span-2 text-slate-900 dark:text-slate-100 font-black cursor-pointer"
                    >
                        <option value="Teoria">📖 Teoria</option>
                        <option value="Exercícios">📝 Exercícios</option>
                        <option value="Revisão">🔁 Revisão</option>
                        <option value="Simulado">📊 Simulado</option>
                    </select>
                </div>

                {/* Últimas atividades */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
                            <History size={16} />
                            Últimas atividades
                        </div>

                        {ultimasAtividades.length > 2 && (
                            <button
                                onClick={() => setVerMaisAtividades((v) => !v)}
                                className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                                {verMaisAtividades ? "Ver menos" : "Ver mais"}
                            </button>
                        )}
                    </div>

                    {ultimasAtividades.length === 0 ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">Nenhuma atividade registrada ainda.</p>
                    ) : (
                        <div className={`space-y-2 ${verMaisAtividades ? "max-h-56 overflow-y-auto pr-1 custom-scroll" : ""}`}>
                            {(verMaisAtividades ? ultimasAtividades : ultimasAtividades.slice(0, 2)).map((a) => (
                                <button
                                    key={a.id}
                                    onClick={() => {
                                        setAtividadeSelecionada(a);
                                        setModalAtividadeOpen(true);
                                    }}
                                    className="w-full text-left flex items-center justify-between text-sm p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:scale-[1.01] transition cursor-pointer"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-900 dark:text-white">{a.materia}</span>
                                        <span className="text-xs text-slate-600 dark:text-slate-300">
                                            {a.tipo_estudo} • {new Date(a.inicio_em).toLocaleString()}
                                        </span>
                                        {(a.tipo_estudo === "Exercícios" || a.tipo_estudo === "Simulado") && (
                                            <span className="text-[11px] mt-1 text-slate-500 dark:text-slate-300">
                                                Q: {a.questoes_feitas || 0} • ✅ {a.questoes_acertos || 0} • ❌ {a.questoes_erros || 0}
                                            </span>
                                        )}
                                    </div>

                                    <span className="font-mono font-black text-slate-800 dark:text-slate-100">
                                        {formatarTempo(a.duracao_segundos || 0)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Manual ou Cronômetro */}
                {abaAtiva === "manual" ? (
                    <div className="grid grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-800 pt-4">
                        <div className="space-y-1">
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300 flex items-center gap-2">
                                <Calendar size={16} className="text-indigo-600 dark:text-indigo-400" />
                                Data de início
                            </p>

                            <input
                                type="date"
                                value={dataInicio}
                                onChange={(e) => setDataInicio(e.target.value)}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                            />
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300 flex items-center gap-2">
                                <Clock3 size={16} className="text-indigo-600 dark:text-indigo-400" />
                                Hora de início
                            </p>

                            <input
                                type="time"
                                value={horaInicio}
                                onChange={(e) => setHoraInicio(e.target.value)}
                                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                            />
                        </div>

                        <div className="col-span-2">
                            <p className="text-xs font-black text-slate-500 dark:text-slate-300 mb-2">Duração</p>

                            <button
                                onClick={() => setDuracaoModalAberto(true)}
                                className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 flex items-center justify-between font-black cursor-pointer"
                            >
                                <span className="text-lg font-mono">{DuracaoTexto}</span>
                                <span className="text-indigo-600 dark:text-indigo-400 text-sm font-black">Alterar</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-6 border-t border-slate-200 dark:border-slate-800 pt-4">
                        <div className="text-6xl font-mono font-black tracking-tighter tabular-nums text-indigo-600 dark:text-indigo-400">
                            {formatarTempo(segundos)}
                        </div>

                        {/* ✅ Total a salvar */}
                        <div className="text-xs font-black text-slate-600 dark:text-slate-300 text-center">
                            <span className="text-slate-500 dark:text-slate-400">Total a salvar: </span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                                {formatarTempo(duracaoTotalParaSalvar)}
                            </span>

                            {abaAtiva === "cronometro" && segundos === 0 && totalAlarmesConcluidosSeg > 0 && (
                                <span className="ml-2 text-slate-500 dark:text-slate-400">(somente alarmes concluídos)</span>
                            )}
                        </div>

                        <div className="flex justify-center gap-4">
                            <button
                                onClick={iniciarOuPausar}
                                className={`p-4 rounded-full text-white cursor-pointer transition-all active:scale-95 ${ativo ? "bg-amber-500" : "bg-indigo-600"
                                    }`}
                            >
                                {ativo ? <Pause /> : <Play />}
                            </button>

                            <button
                                onClick={resetarCronometro}
                                className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer transition-all active:scale-95"
                            >
                                <RotateCcw />
                            </button>
                        </div>

                        {/* ✅ Alarmes */}
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                                    <Bell size={14} /> Alarme
                                </span>

                                <select
                                    value={alarmeTipo}
                                    onChange={(e) => setAlarmeTipo(e.target.value)}
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700
                  bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
                  text-sm font-black outline-none cursor-pointer"
                                >
                                    <option value="nenhum">Nenhum</option>
                                    <option value="duracao">Por duração</option>
                                    <option value="horario">Por horário</option>
                                </select>
                            </div>

                            {alarmeTipo === "duracao" && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Disparar em:</span>

                                    <select
                                        value={alarmeDuracaoMin}
                                        onChange={(e) => setAlarmeDuracaoMin(e.target.value)}
                                        className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700
                    bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
                    text-sm font-black outline-none cursor-pointer"
                                    >
                                        <option value="15">15 min</option>
                                        <option value="30">30 min</option>
                                        <option value="45">45 min</option>
                                        <option value="60">60 min</option>
                                        <option value="90">90 min</option>
                                    </select>
                                </div>
                            )}

                            {alarmeTipo === "horario" && (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                        <Clock3 size={16} className="text-indigo-600 dark:text-indigo-400" />
                                        Disparar às:
                                    </span>

                                    <input
                                        type="time"
                                        value={alarmeHorario}
                                        onChange={(e) => setAlarmeHorario(e.target.value)}
                                        className="bg-transparent text-sm outline-none font-black text-slate-900 dark:text-slate-100 cursor-pointer"
                                    />
                                </div>
                            )}

                            {(alarmeTipo === "duracao" || alarmeTipo === "horario") && (
                                <button
                                    onClick={criarAlarmeAtivo}
                                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm cursor-pointer"
                                >
                                    Ativar Alarme
                                </button>
                            )}

                            {/* Alarmes ativos */}
                            {alarmesAtivos.length > 0 && (
                                <div className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                                    <p className="text-xs font-black text-slate-700 dark:text-slate-200">Alarmes ativos</p>

                                    {alarmesAtivos.map((a) => (
                                        <div
                                            key={a.id}
                                            className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-3 py-2"
                                        >
                                            <div className="flex flex-col text-left">
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-100">{a.label}</span>
                                                <span className="text-[11px] font-mono font-black text-indigo-600 dark:text-indigo-400">
                                                    {formatarTempo(a.remaining)}
                                                </span>
                                            </div>

                                            <button
                                                onClick={() => cancelarAlarmeAtivo(a.id)}
                                                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                                                title="Cancelar alarme"
                                            >
                                                <X size={16} className="text-slate-500 dark:text-slate-300" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Alarmes concluídos */}
                            {alarmesConcluidos.length > 0 && (
                                <div className="mt-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20 p-3 space-y-2">
                                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-200">Alarmes concluídos</p>

                                    {alarmesConcluidos.map((a) => (
                                        <div
                                            key={a.id}
                                            className="flex items-center justify-between rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-white/70 dark:bg-slate-900 px-3 py-2"
                                        >
                                            <div className="flex flex-col text-left">
                                                <span className="text-xs font-black text-slate-800 dark:text-slate-100">{a.label}</span>
                                                <span className="text-[11px] font-mono font-black text-emerald-700 dark:text-emerald-300">
                                                    Tempo: {formatarTempo(a.duracaoSegundos || 0)}
                                                </span>
                                            </div>

                                            <button
                                                onClick={() => confirmarExcluirAlarmeConcluido(a.id)}
                                                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/20 cursor-pointer"
                                                title="Excluir alarme"
                                            >
                                                <X size={16} className="text-emerald-700 dark:text-emerald-300" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Questões */}
                {(tipoEstudo === "Exercícios" || tipoEstudo === "Simulado") && (
                    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-950/20 p-4 space-y-3">
                        <div className="grid grid-cols-3 gap-3 text-xs font-black text-slate-700 dark:text-slate-200">
                            <span className="text-center">Questões</span>
                            <span className="text-center">Acertos</span>
                            <span className="text-center">Erros</span>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <input
                                type="number"
                                placeholder="0"
                                value={questoes.feitas}
                                onChange={(e) => setFeitas(e.target.value)}
                                className="bg-white/70 dark:bg-slate-900 text-center outline-none font-black rounded-xl py-3 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                            />
                            <input
                                type="number"
                                placeholder="0"
                                value={questoes.acertos}
                                onChange={(e) => setAcertos(e.target.value)}
                                className="bg-white/70 dark:bg-slate-900 text-center outline-none font-black rounded-xl py-3 border border-slate-200 dark:border-slate-800 text-emerald-600"
                            />
                            <input
                                type="number"
                                placeholder="0"
                                value={questoes.erros}
                                onChange={(e) => setErros(e.target.value)}
                                className="bg-white/70 dark:bg-slate-900 text-center outline-none font-black rounded-xl py-3 border border-slate-200 dark:border-slate-800 text-rose-500"
                            />
                        </div>
                    </div>
                )}

                {/* Anotações */}
                <textarea
                    placeholder="Anotações..."
                    value={anotacao}
                    onChange={(e) => setAnotacao(e.target.value)}
                    className="w-full p-4 h-24 bg-slate-50 dark:bg-slate-800 rounded-2xl outline-none border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />

                {/* Revisões */}
                <div className="space-y-3">
                    <button
                        onClick={() => setAgendarRevisao((v) => !v)}
                        className={`text-sm font-black flex items-center gap-2 cursor-pointer ${agendarRevisao ? "text-indigo-600" : "text-slate-500 dark:text-slate-300"
                            }`}
                    >
                        <Calendar size={16} className="text-indigo-600 dark:text-indigo-400" />
                        {agendarRevisao ? "Revisões serão agendadas ✅" : "Agendar revisões (espaçadas)?"}
                    </button>

                    {agendarRevisao && (
                        <div className="flex flex-wrap gap-2">
                            {revisoesPreset.map((opt) => {
                                const ativoChip = revisoesSelecionadas.includes(opt.days);
                                return (
                                    <button
                                        key={opt.days}
                                        onClick={() => alternarDiaRevisao(opt.days)}
                                        className={`px-4 py-2 rounded-2xl text-sm font-black border transition-all active:scale-95 cursor-pointer
                    ${ativoChip
                                                ? "bg-indigo-600 text-white border-indigo-600"
                                                : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800"
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Salvar */}
                <button
                    onClick={() => salvarSessao()}
                    disabled={loading}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                >
                    {loading ? "SALVANDO..." : "SALVAR ATIVIDADE"}
                </button>
            </div>

            {duracaoModalAberto && (
                <DuracaoModal
                    valorInicial={duracaoManual}
                    onClose={() => setDuracaoModalAberto(false)}
                    onSave={(novoValor) => {
                        setDuracaoManual(novoValor);
                        setDuracaoModalAberto(false);
                    }}
                />
            )}
        </div>
    );
};

export default EstudarAgora;
