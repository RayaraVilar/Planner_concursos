import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
    Plus,
    GripVertical,
    Trash2,
    Quote,
    CheckSquare,
    CalendarDays,
    Timer,
    BarChart3,
    Sparkles,
    Flame,
    PartyPopper,
    Check,
} from "lucide-react";

import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    arrayMove,
    rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const WIDGET_LIBRARY = [
    { type: "streak", title: "Constância", icon: Flame, description: "Acompanhe sua sequência com base nos estudos e tarefas concluídas." },
    { type: "ultimos_5_dias", title: "Últimos 5 dias", icon: BarChart3, description: "Veja quanto tempo você estudou em cada um dos últimos dias." },
    { type: "motivacional", title: "Resumo do dia", icon: Quote, description: "Receba uma mensagem personalizada com base no seu ritmo atual." },
    { type: "todo", title: "Tarefas", icon: CheckSquare, description: "Adicione tarefas rápidas e acompanhe o andamento da sua lista." },
    { type: "calendario_mini", title: "Próximos 7 dias", icon: CalendarDays, description: "Confira as tarefas e revisões previstas para a semana." },
    { type: "cronometro_basico", title: "Meta semanal", icon: Timer, description: "Compare o total estudado nesta semana com a sua meta sugerida." },
    { type: "revisoes_futuras", title: "Revisões futuras", icon: Sparkles, description: "Veja o que já está agendado para revisão nos próximos dias." },
];

const TZ = "America/Fortaleza";

function toDateKey(dateOrIso) {
    const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function buildLastNDays(n) {
    const today = new Date();
    return Array.from({ length: n }, (_, index) => {
        const date = addDays(today, -(n - 1 - index));
        return { key: toDateKey(date), date };
    });
}

function computeStreakFrom(dayKeysSet, startKey) {
    let streak = 0;
    let cursor = new Date(`${startKey}T12:00:00`);
    while (dayKeysSet.has(toDateKey(cursor))) {
        streak += 1;
        cursor = addDays(cursor, -1);
    }
    return streak;
}

function computeCurrentStreak(dayKeysSet, todayKey) {
    if (!todayKey) return 0;
    if (dayKeysSet.has(todayKey)) return computeStreakFrom(dayKeysSet, todayKey);
    const yesterdayKey = toDateKey(addDays(new Date(`${todayKey}T12:00:00`), -1));
    return computeStreakFrom(dayKeysSet, yesterdayKey);
}

function computeBestStreak(dayKeysSet, orderedKeys) {
    let best = 0;
    let run = 0;
    orderedKeys.forEach((key) => {
        if (dayKeysSet.has(key)) {
            run += 1;
            if (run > best) best = run;
        } else {
            run = 0;
        }
    });
    return best;
}

function fmtHours(value) {
    return `${Number(value || 0).toFixed(1)}h`;
}

function SortableWidgetCard({ widget, onRemove, children }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: widget.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-4
      ${isDragging ? "opacity-80 ring-2 ring-cyan-500" : ""}`}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <button
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing"
                        title="Arrastar"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical size={18} className="text-slate-500 dark:text-slate-300" />
                    </button>

                    <p className="font-black text-slate-800 dark:text-slate-100">
                        {widget.title}
                    </p>
                </div>

                <button
                    onClick={() => onRemove(widget.id)}
                    className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 dark:text-rose-400 cursor-pointer"
                    title="Remover widget"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            {children}
        </div>
    );
}

function Ultimos5DiasWidget({ user }) {
    const [days, setDays] = useState([]);
    const [loading, setLoading] = useState(true);

    const toYMD = (d) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    };

    const labelDia = (d) =>
        d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");

    useEffect(() => {
        if (!user?.id) return;

        const run = async () => {
            setLoading(true);

            const start = new Date();
            start.setHours(0, 0, 0, 0);
            start.setDate(start.getDate() - 4);

            const { data, error } = await supabase
                .from("sessoes_estudo")
                .select("inicio_em, duracao_segundos")
                .eq("user_id", user.id)
                .gte("inicio_em", start.toISOString())
                .order("inicio_em", { ascending: true });

            if (error) {
                setDays([]);
                setLoading(false);
                return;
            }

            const base = [];
            for (let i = 4; i >= 0; i -= 1) {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() - i);
                base.push({
                    date: toYMD(d),
                    label: labelDia(d),
                    seconds: 0,
                });
            }

            const map = new Map(base.map((b) => [b.date, 0]));
            for (const row of data || []) {
                const localDate = toYMD(new Date(row.inicio_em));
                map.set(localDate, (map.get(localDate) || 0) + Number(row.duracao_segundos || 0));
            }

            setDays(base.map((b) => ({ ...b, seconds: map.get(b.date) || 0 })));
            setLoading(false);
        };

        run();
    }, [user?.id]);

    const hours = days.map((d) => d.seconds / 3600);
    const max = Math.max(1, ...hours);
    const totalHours = hours.reduce((a, b) => a + b, 0);

    return (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                        Ritmo recente
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                        Total acumulado nos últimos cinco dias.
                    </p>
                </div>
                <p className="text-xs font-black text-cyan-600 dark:text-cyan-400">
                    {totalHours.toFixed(1)}h
                </p>
            </div>

            {loading ? (
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-3">
                    Carregando…
                </p>
            ) : (
                <div className="mt-4 grid grid-cols-5 gap-3 items-end">
                    {days.map((d) => {
                        const h = d.seconds / 3600;
                        const height = Math.max(8, Math.round((h / max) * 80));
                        return (
                            <div key={d.date} className="flex flex-col items-center gap-2">
                                <div className="w-full rounded-2xl bg-slate-200 dark:bg-slate-700 h-[96px] flex items-end p-1">
                                    <div
                                        className="w-full rounded-2xl bg-cyan-600 dark:bg-cyan-500 transition-all"
                                        style={{ height: `${height}px` }}
                                        title={`${h.toFixed(2)} horas`}
                                    />
                                </div>
                                <p className="text-[11px] font-black text-slate-600 dark:text-slate-300">
                                    {d.label}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                Os valores consideram as sessões registradas em Estudar Agora.
            </p>
        </div>
    );
}

function StreakWidget({ user }) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [statsByDay, setStatsByDay] = useState({});
    const [celebrate, setCelebrate] = useState(false);
    const celebrateTimer = useRef(null);
    const lastCelebratedKeyRef = useRef("");

    const todayKey = useMemo(() => toDateKey(new Date()), []);
    const last90 = useMemo(() => buildLastNDays(90), []);

    const studiedDays = useMemo(() => {
        const keys = new Set();
        Object.entries(statsByDay).forEach(([day, stats]) => {
            const hasStudySession = (stats.studySeconds || 0) > 0;
            const hasCycleSession = (stats.cycleMinutes || 0) > 0;
            const hasTaskDone = (stats.tasksDone || 0) > 0;
            if (hasStudySession || hasCycleSession || hasTaskDone) keys.add(day);
        });
        return keys;
    }, [statsByDay]);

    const currentStreak = useMemo(
        () => computeCurrentStreak(studiedDays, todayKey),
        [studiedDays, todayKey]
    );

    const bestStreak = useMemo(
        () => computeBestStreak(studiedDays, last90.map((item) => item.key)),
        [last90, studiedDays]
    );

    const activeDaysLast7 = useMemo(() => {
        const last7 = buildLastNDays(7).map((item) => item.key);
        return last7.filter((key) => studiedDays.has(key)).length;
    }, [studiedDays]);

    const todayStats = statsByDay[todayKey] || {};
    const todayMinutes = Math.round(((todayStats.studySeconds || 0) / 60) + (todayStats.cycleMinutes || 0));
    const todayTasks = todayStats.tasksDone || 0;
    const statusText = todayMinutes > 0 || todayTasks > 0
        ? "Hoje já conta para a sua sequência."
        : "Registre um estudo ou conclua uma tarefa para manter a sequência.";

    useEffect(() => {
        if (!user?.id) return;

        const fetchStats = async () => {
            setLoading(true);
            setError("");
            try {
                const since = addDays(new Date(), -120).toISOString();
                const [{ data: sessoes, error: err1 }, { data: cycleSessions, error: err2 }, { data: tarefas, error: err3 }] = await Promise.all([
                    supabase
                        .from("sessoes_estudo")
                        .select("inicio_em, duracao_segundos")
                        .eq("user_id", user.id)
                        .gte("inicio_em", since),
                    supabase
                        .from("study_cycle_sessions")
                        .select("started_at, minutos")
                        .eq("user_id", user.id)
                        .gte("started_at", since),
                    supabase
                        .from("tarefas")
                        .select("concluida_em")
                        .eq("user_id", user.id)
                        .eq("concluida", true)
                        .not("concluida_em", "is", null)
                        .gte("concluida_em", since),
                ]);

                if (err1 || err2 || err3) throw err1 || err2 || err3;

                const acc = {};
                for (const s of sessoes || []) {
                    const key = toDateKey(s.inicio_em);
                    if (!key) continue;
                    if (!acc[key]) acc[key] = { studySeconds: 0, cycleMinutes: 0, tasksDone: 0 };
                    acc[key].studySeconds += Number(s.duracao_segundos || 0);
                }
                for (const c of cycleSessions || []) {
                    const key = toDateKey(c.started_at);
                    if (!key) continue;
                    if (!acc[key]) acc[key] = { studySeconds: 0, cycleMinutes: 0, tasksDone: 0 };
                    acc[key].cycleMinutes += Number(c.minutos || 0);
                }
                for (const t of tarefas || []) {
                    const key = toDateKey(t.concluida_em);
                    if (!key) continue;
                    if (!acc[key]) acc[key] = { studySeconds: 0, cycleMinutes: 0, tasksDone: 0 };
                    acc[key].tasksDone += 1;
                }
                setStatsByDay(acc);
            } catch (e) {
                setError(e?.message || "Não foi possível carregar sua constância.");
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
        const channel = supabase
            .channel(`workspace-streak-${user.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "sessoes_estudo", filter: `user_id=eq.${user.id}` }, fetchStats)
            .on("postgres_changes", { event: "*", schema: "public", table: "study_cycle_sessions", filter: `user_id=eq.${user.id}` }, fetchStats)
            .on("postgres_changes", { event: "*", schema: "public", table: "tarefas", filter: `user_id=eq.${user.id}` }, fetchStats)
            .subscribe();

        return () => {
            if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    useEffect(() => {
        const hasProgressToday = todayMinutes > 0 || todayTasks > 0;
        if (!hasProgressToday || !todayKey || lastCelebratedKeyRef.current === todayKey) return;
        setCelebrate(true);
        lastCelebratedKeyRef.current = todayKey;
        if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
        celebrateTimer.current = setTimeout(() => setCelebrate(false), 2200);
    }, [todayKey, todayMinutes, todayTasks]);

    if (loading) {
        return <p className="text-xs text-slate-500 dark:text-slate-300 mt-3">Carregando…</p>;
    }

    if (error) {
        return <p className="text-xs text-rose-500 dark:text-rose-400">{error}</p>;
    }

    return (
        <div className="relative rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 overflow-hidden">
            {celebrate && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 backdrop-blur-sm">
                    <div className="w-[92%] max-w-sm rounded-3xl border border-slate-200/20 bg-slate-950 text-white p-6 text-center shadow-2xl animate-[pop_240ms_ease-out]">
                        <div className="mx-auto w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center mb-3">
                            <PartyPopper className="text-cyan-400" />
                        </div>
                        <p className="font-black text-lg">Seu dia já está valendo 🔥</p>
                        <p className="text-xs text-slate-300 mt-1">
                            Continue registrando seus estudos para fortalecer a sequência.
                        </p>
                    </div>

                    <style>{`
            @keyframes pop {
              0% { transform: scale(.92); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
                </div>
            )}

            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                        Sua constância
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                        A sequência considera sessões de estudo, ciclo e tarefas concluídas.
                    </p>
                </div>

                <div className="px-3 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-300">Melhor marca</p>
                    <p className="text-lg font-black text-cyan-600 dark:text-cyan-400 leading-tight">
                        {bestStreak}
                    </p>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                    <p className="text-xs text-slate-500 dark:text-slate-300">Sequência atual</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{currentStreak} dias</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                    <p className="text-xs text-slate-500 dark:text-slate-300">Hoje</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{todayMinutes} min</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                    <p className="text-xs text-slate-500 dark:text-slate-300">Últimos 7 dias</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{activeDaysLast7}/7</p>
                </div>
            </div>

            <div className="mt-3 rounded-2xl border border-cyan-200 dark:border-cyan-900/60 bg-cyan-50 dark:bg-cyan-950/20 px-3 py-2">
                <p className="text-xs font-semibold text-cyan-800 dark:text-cyan-300">{statusText}</p>
                <p className="text-[11px] text-cyan-700/80 dark:text-cyan-200/80 mt-1">
                    {todayTasks > 0 ? `${todayTasks} tarefa${todayTasks > 1 ? "s" : ""} concluída${todayTasks > 1 ? "s" : ""} hoje.` : "Nenhuma tarefa concluída hoje ainda."}
                </p>
            </div>
        </div>
    );
}

function TodoWidget({ user }) {
    const [tarefas, setTarefas] = useState([]);
    const [texto, setTexto] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;

        const run = async () => {
            const { data } = await supabase
                .from("tarefas")
                .select("id, texto, concluida")
                .eq("user_id", user.id)
                .order("id", { ascending: true })
                .limit(8);

            setTarefas(data || []);
            setLoading(false);
        };

        run();
    }, [user?.id]);

    const adicionar = async (e) => {
        e.preventDefault();
        if (!texto.trim()) return;

        const { data, error } = await supabase
            .from("tarefas")
            .insert([{ texto: texto.trim(), concluida: false, user_id: user.id }])
            .select("id, texto, concluida")
            .single();

        if (!error && data) {
            setTarefas((prev) => [...prev, data]);
            setTexto("");
        }
    };

    const alternar = async (id, concluida) => {
        await supabase.from("tarefas").update({ concluida: !concluida }).eq("id", id);
        setTarefas((prev) => prev.map((t) => (t.id === id ? { ...t, concluida: !concluida } : t)));
    };

    const remover = async (id) => {
        await supabase.from("tarefas").delete().eq("id", id);
        setTarefas((prev) => prev.filter((t) => t.id !== id));
    };

    const concluidas = tarefas.filter((t) => t.concluida).length;
    const progresso = tarefas.length ? Math.round((concluidas / tarefas.length) * 100) : 0;

    return (
        <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <p className="text-xs text-slate-500 dark:text-slate-300">Progresso da lista</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{progresso}%</p>
                </div>
                <p className="text-xs font-black text-cyan-600 dark:text-cyan-400">{concluidas}/{tarefas.length || 0} concluídas</p>
            </div>

            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="h-full bg-cyan-600 dark:bg-cyan-500" style={{ width: `${progresso}%` }} />
            </div>

            <form onSubmit={adicionar} className="flex gap-2">
                <input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder="Escreva a próxima tarefa"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                />
                <button className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-black cursor-pointer">
                    Adicionar
                </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-auto pr-1">
                {loading && <p className="text-xs text-slate-500 dark:text-slate-300">Carregando…</p>}
                {!loading && tarefas.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-300">Você ainda não tem tarefas nesta lista.</p>}

                {tarefas.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-2 py-2">
                        <button
                            onClick={() => alternar(t.id, t.concluida)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer ${t.concluida ? "bg-cyan-600 border-cyan-600" : "border-slate-300 dark:border-slate-600"}`}
                        >
                            {t.concluida && <Check size={13} className="text-white" />}
                        </button>
                        <p className={`flex-1 text-sm ${t.concluida ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"}`}>{t.texto}</p>
                        <button onClick={() => remover(t.id)} className="p-1 text-rose-500 cursor-pointer" title="Apagar">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RevisoesFuturasWidget({ user }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;

        const run = async () => {
            const hoje = new Date().toISOString().slice(0, 10);
            const { data } = await supabase
                .from("revisoes_agendadas")
                .select("id, titulo, data_revisao, tipo_revisao")
                .eq("user_id", user.id)
                .eq("executada", false)
                .gte("data_revisao", hoje)
                .order("data_revisao", { ascending: true })
                .limit(5);

            setItems(data || []);
            setLoading(false);
        };

        run();
    }, [user?.id]);

    return (
        <div className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-300">Próximas revisões pendentes</p>
            {loading && <p className="text-xs text-slate-500 dark:text-slate-300">Carregando…</p>}
            {!loading && items.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">Nenhuma revisão pendente nos próximos dias.</p>}

            {items.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">{r.titulo || "Revisão sem título"}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                        {new Date(`${r.data_revisao}T12:00:00`).toLocaleDateString("pt-BR")} • {r.tipo_revisao || "Revisão"}
                    </p>
                </div>
            ))}
        </div>
    );
}

function AgendaMiniWidget({ user }) {
    const [dias, setDias] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;

        const run = async () => {
            setLoading(true);
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const fim = new Date(hoje);
            fim.setDate(fim.getDate() + 6);

            const ymd = (d) => d.toISOString().slice(0, 10);
            const inicioYmd = ymd(hoje);
            const fimYmd = ymd(fim);

            const [{ data: tarefas }, { data: revisoes }] = await Promise.all([
                supabase
                    .from("tarefas")
                    .select("id, prazo")
                    .eq("user_id", user.id)
                    .gte("prazo", inicioYmd)
                    .lte("prazo", fimYmd),
                supabase
                    .from("revisoes_agendadas")
                    .select("id, data_revisao")
                    .eq("user_id", user.id)
                    .gte("data_revisao", inicioYmd)
                    .lte("data_revisao", fimYmd),
            ]);

            const mapa = new Map();
            for (let i = 0; i < 7; i += 1) {
                const d = new Date(hoje);
                d.setDate(d.getDate() + i);
                const key = ymd(d);
                mapa.set(key, {
                    key,
                    label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
                    tarefas: 0,
                    revisoes: 0,
                });
            }

            for (const t of tarefas || []) {
                if (mapa.has(t.prazo)) mapa.get(t.prazo).tarefas += 1;
            }
            for (const r of revisoes || []) {
                if (mapa.has(r.data_revisao)) mapa.get(r.data_revisao).revisoes += 1;
            }

            setDias(Array.from(mapa.values()));
            setLoading(false);
        };

        run();
    }, [user?.id]);

    const totalAgenda = dias.reduce((acc, dia) => acc + dia.tarefas + dia.revisoes, 0);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-300">Visão da próxima semana</p>
                <p className="text-xs font-black text-cyan-600 dark:text-cyan-400">{totalAgenda} itens</p>
            </div>
            {loading ? (
                <p className="text-xs text-slate-500 dark:text-slate-300">Carregando…</p>
            ) : (
                <div className="grid grid-cols-7 gap-2">
                    {dias.map((d) => (
                        <div key={d.key} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-2 text-center">
                            <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-300">{d.label}</p>
                            <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-black mt-1">{d.tarefas} tarefa{d.tarefas === 1 ? "" : "s"}</p>
                            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-black">{d.revisoes} revisão{d.revisoes === 1 ? "" : "ões"}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ProgressoSemanalWidget({ user }) {
    const [horas, setHoras] = useState(0);
    const [meta, setMeta] = useState(10);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;

        const run = async () => {
            setLoading(true);
            const hoje = new Date();
            const diaSemana = (hoje.getDay() + 6) % 7;
            const segunda = new Date(hoje);
            segunda.setDate(hoje.getDate() - diaSemana);
            segunda.setHours(0, 0, 0, 0);

            const quatroSemanasAtras = new Date(segunda);
            quatroSemanasAtras.setDate(quatroSemanasAtras.getDate() - 21);

            const [{ data: sessoes }, { data: cicloSessoes }] = await Promise.all([
                supabase
                    .from("sessoes_estudo")
                    .select("duracao_segundos, inicio_em")
                    .eq("user_id", user.id)
                    .gte("inicio_em", quatroSemanasAtras.toISOString()),
                supabase
                    .from("study_cycle_sessions")
                    .select("minutos, started_at")
                    .eq("user_id", user.id)
                    .gte("started_at", quatroSemanasAtras.toISOString()),
            ]);

            const weekTotals = [0, 0, 0, 0];
            const addToBucket = (dateValue, hoursValue) => {
                const date = new Date(dateValue);
                if (Number.isNaN(date.getTime())) return;
                const diffDays = Math.floor((date - quatroSemanasAtras) / 86400000);
                if (diffDays < 0) return;
                const bucket = Math.min(3, Math.floor(diffDays / 7));
                weekTotals[bucket] += hoursValue;
            };

            (sessoes || []).forEach((item) => addToBucket(item.inicio_em, Number(item.duracao_segundos || 0) / 3600));
            (cicloSessoes || []).forEach((item) => addToBucket(item.started_at, Number(item.minutos || 0) / 60));

            setHoras(weekTotals[3] || 0);
            const historicWeeks = weekTotals.slice(0, 3).filter((value) => value > 0);
            const average = historicWeeks.length
                ? historicWeeks.reduce((acc, value) => acc + value, 0) / historicWeeks.length
                : 8;
            setMeta(Math.max(4, Math.round(average || 8)));
            setLoading(false);
        };

        run();
    }, [user?.id]);

    const percentual = meta > 0 ? Math.min(100, Math.round((horas / meta) * 100)) : 0;
    const restante = Math.max(0, meta - horas);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">Meta da semana</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">Meta sugerida com base nas últimas semanas.</p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-300">{fmtHours(horas)} / {fmtHours(meta)}</p>
            </div>
            {loading ? (
                <p className="text-xs text-slate-500 dark:text-slate-300">Carregando…</p>
            ) : (
                <>
                    <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${percentual}%` }} />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                        <p className="font-black text-emerald-600 dark:text-emerald-400">{percentual}% concluído</p>
                        <p className="text-slate-500 dark:text-slate-300">Faltam {fmtHours(restante)} para a meta</p>
                    </div>
                </>
            )}
        </div>
    );
}

function MotivationalWidget({ user }) {
    const [loading, setLoading] = useState(true);
    const [insight, setInsight] = useState({
        title: "",
        body: "",
        footer: "",
    });

    useEffect(() => {
        if (!user?.id) return;

        const run = async () => {
            setLoading(true);
            const hoje = new Date();
            const inicioDia = new Date(hoje);
            inicioDia.setHours(0, 0, 0, 0);
            const inicioSemana = new Date(inicioDia);
            const diaSemana = (inicioSemana.getDay() + 6) % 7;
            inicioSemana.setDate(inicioSemana.getDate() - diaSemana);

            const [
                { data: sessoesHoje },
                { data: sessoesSemana },
                { data: tarefasHoje },
                { data: revisoesPendentes },
            ] = await Promise.all([
                supabase
                    .from("sessoes_estudo")
                    .select("duracao_segundos")
                    .eq("user_id", user.id)
                    .gte("inicio_em", inicioDia.toISOString()),
                supabase
                    .from("sessoes_estudo")
                    .select("duracao_segundos")
                    .eq("user_id", user.id)
                    .gte("inicio_em", inicioSemana.toISOString()),
                supabase
                    .from("tarefas")
                    .select("id")
                    .eq("user_id", user.id)
                    .eq("concluida", true)
                    .gte("concluida_em", inicioDia.toISOString()),
                supabase
                    .from("revisoes_agendadas")
                    .select("id")
                    .eq("user_id", user.id)
                    .eq("executada", false)
                    .gte("data_revisao", toDateKey(inicioDia)),
            ]);

            const horasHoje = (sessoesHoje || []).reduce((acc, item) => acc + Number(item.duracao_segundos || 0), 0) / 3600;
            const horasSemana = (sessoesSemana || []).reduce((acc, item) => acc + Number(item.duracao_segundos || 0), 0) / 3600;
            const tarefasFeitasHoje = (tarefasHoje || []).length;
            const revisoes = (revisoesPendentes || []).length;

            if (horasHoje >= 2) {
                setInsight({
                    title: "Excelente ritmo hoje",
                    body: `Você já acumulou ${fmtHours(horasHoje)} de estudo hoje. Aproveite para encerrar com uma revisão leve e consolidar o conteúdo.`,
                    footer: revisoes > 0 ? `Você ainda tem ${revisoes} revisão${revisoes === 1 ? "" : "ões"} pendente${revisoes === 1 ? "" : "s"}.` : "Sua agenda de revisões está em dia para os próximos dias.",
                });
            } else if (horasHoje > 0 || tarefasFeitasHoje > 0) {
                setInsight({
                    title: "Você já começou bem",
                    body: `Seu dia já teve progresso: ${fmtHours(horasHoje)} estudadas e ${tarefasFeitasHoje} tarefa${tarefasFeitasHoje === 1 ? "" : "s"} concluída${tarefasFeitasHoje === 1 ? "" : "s"}.`,
                    footer: `Na semana, você soma ${fmtHours(horasSemana)} de estudo registrado.`,
                });
            } else if (revisoes > 0) {
                setInsight({
                    title: "Um passo agora faz diferença",
                    body: `Há ${revisoes} revisão${revisoes === 1 ? "" : "ões"} aguardando você. Começar por uma delas já coloca o dia em movimento.`,
                    footer: `Seu total estudado nesta semana está em ${fmtHours(horasSemana)}.`,
                });
            } else {
                setInsight({
                    title: "Hoje é um ótimo dia para avançar",
                    body: "Organize uma sessão curta, registre seu estudo e mantenha o ritmo construído nos outros módulos.",
                    footer: `Até aqui, a semana soma ${fmtHours(horasSemana)} de estudo registrado.`,
                });
            }
            setLoading(false);
        };

        run();
    }, [user?.id]);

    if (loading) {
        return <p className="text-xs text-slate-500 dark:text-slate-300 mt-3">Carregando…</p>;
    }

    return (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-sm font-black text-slate-800 dark:text-slate-100">{insight.title}</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 font-semibold mt-2">
                {insight.body}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {insight.footer}
            </p>
        </div>
    );
}

function WidgetContent({ widget, user }) {
    if (widget.type === "streak") return <StreakWidget user={user} />;
    if (widget.type === "ultimos_5_dias") return <Ultimos5DiasWidget user={user} />;
    if (widget.type === "motivacional") return <MotivationalWidget user={user} />;
    if (widget.type === "todo") return <TodoWidget user={user} />;
    if (widget.type === "calendario_mini") return <AgendaMiniWidget user={user} />;
    if (widget.type === "cronometro_basico") return <ProgressoSemanalWidget user={user} />;
    if (widget.type === "revisoes_futuras") return <RevisoesFuturasWidget user={user} />;

    return null;
}

export default function Workspace({ user }) {
    const [widgets, setWidgets] = useState([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [selectedTypes, setSelectedTypes] = useState([]);

    const saveTimer = useRef(null);
    const didEditRef = useRef(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const ids = useMemo(() => widgets.map((w) => w.id), [widgets]);

    useEffect(() => {
        if (!user?.id) return;

        const load = async () => {
            const { data, error } = await supabase
                .from("workspace_layouts")
                .select("layout")
                .eq("user_id", user.id)
                .maybeSingle();

            if (didEditRef.current) return;

            if (!error && data?.layout?.widgets) {
                setWidgets(data.layout.widgets);
            } else {
                setWidgets([]);
            }
        };

        load();
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) return;

        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            const payload = {
                user_id: user.id,
                layout: { widgets },
                updated_at: new Date().toISOString(),
            };

            await supabase.from("workspace_layouts").upsert(payload, {
                onConflict: "user_id",
            });
        }, 600);

        return () => clearTimeout(saveTimer.current);
    }, [widgets, user?.id]);

    const addWidget = (type) => {
        didEditRef.current = true;

        const base = WIDGET_LIBRARY.find((w) => w.type === type);
        if (!base) return;

        const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        setWidgets((prev) => [
            ...prev,
            {
                id,
                type: base.type,
                title: base.title,
            },
        ]);
    };

    const toggleSelectType = (type) => {
        setSelectedTypes((prev) =>
            prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
        );
    };

    const addSelectedWidgets = () => {
        if (selectedTypes.length === 0) return;
        selectedTypes.forEach((type) => addWidget(type));
        setSelectedTypes([]);
        setPickerOpen(false);
    };

    const removeWidget = (id) => {
        didEditRef.current = true;
        setWidgets((prev) => prev.filter((w) => w.id !== id));
    };

    const handleDragEnd = (event) => {
        didEditRef.current = true;

        const { active, over } = event;
        if (!over) return;
        if (active.id === over.id) return;

        setWidgets((prev) => {
            const oldIndex = prev.findIndex((w) => w.id === active.id);
            const newIndex = prev.findIndex((w) => w.id === over.id);
            return arrayMove(prev, oldIndex, newIndex);
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                        Seu workspace
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Organize seus widgets e acompanhe seus dados em tempo real.
                    </p>
                </div>

                <button
                    onClick={() => { setPickerOpen(true); setSelectedTypes([]); }}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-[#06B6D4] hover:bg-cyan-500 text-white font-black text-sm cursor-pointer"
                >
                    <Plus size={18} />
                    Adicionar widget
                </button>
            </div>

            {widgets.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
                    <p className="font-black text-slate-800 dark:text-slate-100 text-lg">
                        Seu workspace está vazio
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Adicione os widgets que mais ajudam na sua rotina e monte seu painel do seu jeito.
                    </p>
                </div>
            )}

            {widgets.length > 0 && (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={ids} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {widgets.map((w) => (
                                <SortableWidgetCard
                                    key={w.id}
                                    widget={w}
                                    onRemove={removeWidget}
                                >
                                    <WidgetContent widget={w} user={user} />
                                </SortableWidgetCard>
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {pickerOpen && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
                    onClick={() => setPickerOpen(false)}
                >
                    <div
                        className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="text-xl font-black text-slate-900 dark:text-white">
                            Adicionar widget
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                            Escolha os blocos que você quer acompanhar no workspace.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                            {WIDGET_LIBRARY.map((w) => {
                                const Icon = w.icon;
                                return (
                                    <button
                                        key={w.type}
                                        onClick={() => toggleSelectType(w.type)}
                                        className={`text-left rounded-2xl border p-4 transition-all cursor-pointer ${selectedTypes.includes(w.type)
                                            ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30"
                                            : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                                <Icon size={18} className="text-cyan-600 dark:text-cyan-400" />
                                            </div>

                                            {selectedTypes.includes(w.type) && (
                                                <div className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center">
                                                    <Check size={12} />
                                                </div>
                                            )}

                                            <div className="flex-1">
                                                <p className="font-black text-slate-900 dark:text-white text-sm">
                                                    {w.title}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                                                    {w.description}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                                onClick={addSelectedWidgets}
                                disabled={selectedTypes.length === 0}
                                className="w-full py-3 rounded-2xl bg-[#06B6D4] hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black"
                            >
                                Adicionar selecionados ({selectedTypes.length})
                            </button>
                            <button
                                onClick={() => { setSelectedTypes([]); setPickerOpen(false); }}
                                className="w-full py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-black hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
