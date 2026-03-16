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
    LayoutGrid,
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

/* ==============================
   ✅ Widgets disponíveis
================================ */
const WIDGET_LIBRARY = [
    { type: "streak", title: "Ofensiva (sequência)", icon: Flame, description: "Gamificado: Eu me comprometo + animação." },
    { type: "ultimos_5_dias", title: "Últimos 5 dias", icon: BarChart3, description: "Horas líquidas reais (baseado no histórico)." },
    { type: "motivacional", title: "Frase motivacional", icon: Quote, description: "Uma frase curta para manter o foco." },
    { type: "todo", title: "To-do real", icon: CheckSquare, description: "Crie e conclua tarefas com progresso real." },
    { type: "calendario_mini", title: "Agenda dos próximos 7 dias", icon: CalendarDays, description: "Resumo real de tarefas e revisões por dia." },
    { type: "cronometro_basico", title: "Progresso semanal", icon: Timer, description: "Meta semanal de horas com base nas sessões reais." },
    { type: "revisoes_futuras", title: "Revisões futuras", icon: Sparkles, description: "Mostra próximas revisões pendentes reais." },
];

/* ==============================
   ✅ Card arrastável
================================ */
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

/* ==============================
   ✅ Widget: Últimos 5 dias REAL
================================ */
function Ultimos5DiasWidget({ user }) {
    const [days, setDays] = useState([]); // [{date, label, seconds}]
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

            // pega do começo do dia de 4 dias atrás até agora
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

            // monta os 5 dias
            const base = [];
            for (let i = 4; i >= 0; i--) {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() - i);
                base.push({
                    date: toYMD(d),
                    label: labelDia(d),
                    seconds: 0,
                });
            }

            // soma por dia local
            const map = new Map(base.map((b) => [b.date, 0]));
            for (const row of data || []) {
                const localDate = toYMD(new Date(row.inicio_em));
                map.set(localDate, (map.get(localDate) || 0) + Number(row.duracao_segundos || 0));
            }

            const final = base.map((b) => ({
                ...b,
                seconds: map.get(b.date) || 0,
            }));

            setDays(final);
            setLoading(false);
        };

        run();
    }, [user?.id]);

    const hours = days.map((d) => d.seconds / 3600);
    const max = Math.max(1, ...hours);
    const totalHours = hours.reduce((a, b) => a + b, 0);

    return (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
            <div className="flex items-center justify-between">
                <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                    Últimos 5 dias (reais)
                </p>
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
                        const height = Math.max(8, Math.round((h / max) * 80)); // px
                        return (
                            <div key={d.date} className="flex flex-col items-center gap-2">
                                <div className="w-full rounded-2xl bg-slate-200 dark:bg-slate-700 h-[96px] flex items-end p-1">
                                    <div
                                        className="w-full rounded-2xl bg-cyan-600 dark:bg-cyan-500 transition-all"
                                        style={{ height: `${height}px` }}
                                        title={`${h.toFixed(2)}h`}
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
                Baseado no que você registrou em <span className="font-black">Estudar Agora</span>.
            </p>
        </div>
    );
}

/* ==============================
   ✅ Widget: Ofensiva + animação
================================ */
function StreakWidget({ user }) {
    const [info, setInfo] = useState({
        committed: false,
        streak: 0,
        best: 0,
        last_visit: null,
    });
    const [loading, setLoading] = useState(true);

    const [celebrate, setCelebrate] = useState(false);
    const [celebrateText, setCelebrateText] = useState("Mandou bem!");

    const todayYMD = () => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    };

    const showCelebrate = (text) => {
        setCelebrateText(text);
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 2400);
    };

    useEffect(() => {
        if (!user?.id) return;

        const run = async () => {
            setLoading(true);

            const { data, error } = await supabase
                .from("user_streaks")
                .select("*")
                .eq("user_id", user.id)
                .maybeSingle();

            if (error) {
                setLoading(false);
                return;
            }

            // se não existir ainda, cria linha padrão
            if (!data) {
                const payload = {
                    user_id: user.id,
                    committed: false,
                    streak: 0,
                    best: 0,
                    last_visit: null,
                };
                await supabase.from("user_streaks").insert([payload]);
                setInfo(payload);
                setLoading(false);
                return;
            }

            setInfo({
                committed: !!data.committed,
                streak: Number(data.streak || 0),
                best: Number(data.best || 0),
                last_visit: data.last_visit,
            });

            // ✅ Se já está comprometida, ao entrar no site no dia → animação + streak por visita
            const today = todayYMD();
            if (data.committed && data.last_visit !== today) {
                const newStreak = Number(data.streak || 0) + 1;
                const newBest = Math.max(Number(data.best || 0), newStreak);

                await supabase
                    .from("user_streaks")
                    .update({ streak: newStreak, best: newBest, last_visit: today })
                    .eq("user_id", user.id);

                setInfo((prev) => ({
                    ...prev,
                    streak: newStreak,
                    best: newBest,
                    last_visit: today,
                }));

                showCelebrate("Muito bem! Continue assim 🔥");
            }

            setLoading(false);
        };

        run();
    }, [user?.id]);

    const commit = async () => {
        const today = todayYMD();

        // ao se comprometer: inicia streak em 1 e grava visita
        await supabase
            .from("user_streaks")
            .update({
                committed: true,
                streak: Math.max(1, Number(info.streak || 0)),
                best: Math.max(Number(info.best || 0), 1),
                last_visit: today,
            })
            .eq("user_id", user.id);

        setInfo((p) => ({
            ...p,
            committed: true,
            streak: Math.max(1, Number(p.streak || 0)),
            best: Math.max(Number(p.best || 0), 1),
            last_visit: today,
        }));

        showCelebrate("Compromisso ativado! Você consegue 💪✨");
    };

    return (
        <div className="relative rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4 overflow-hidden">
            {/* ✅ Animação central */}
            {celebrate && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-[92%] max-w-sm rounded-3xl border border-slate-200/20 bg-slate-950 text-white p-6 text-center shadow-2xl animate-[pop_240ms_ease-out]">
                        <div className="mx-auto w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center mb-3">
                            <PartyPopper className="text-cyan-400" />
                        </div>
                        <p className="font-black text-lg">{celebrateText}</p>
                        <p className="text-xs text-slate-300 mt-1">
                            Abrindo o workspace você mantém a sequência 🌙
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
                        Ofensiva
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">
                        Sequência de dias que você entrou e manteve o foco.
                    </p>
                </div>

                <div className="px-3 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-300">Maior</p>
                    <p className="text-lg font-black text-cyan-600 dark:text-cyan-400 leading-tight">
                        {info.best}
                    </p>
                </div>
            </div>

            {loading ? (
                <p className="text-xs text-slate-500 dark:text-slate-300 mt-3">
                    Carregando…
                </p>
            ) : (
                <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between">
                    <div>
                        <p className="text-xs text-slate-500 dark:text-slate-300">Sequência atual</p>
                        <p className="text-3xl font-black text-slate-900 dark:text-white">
                            {info.streak} <span className="text-base font-black text-slate-500 dark:text-slate-300">dias</span>
                        </p>
                    </div>

                    {!info.committed ? (
                        <button
                            onClick={commit}
                            className="px-4 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm cursor-pointer"
                        >
                            EU ME COMPROMETO
                        </button>
                    ) : (
                        <div className="px-4 py-3 rounded-2xl bg-cyan-600/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-black text-sm">
                            Comprometida ✅
                        </div>
                    )}
                </div>
            )}

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                Você pode mudar essa lógica depois para contar “dias com estudo registrado”.
            </p>
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
                    placeholder="Nova tarefa"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                />
                <button className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-black cursor-pointer">
                    Add
                </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-auto pr-1">
                {loading && <p className="text-xs text-slate-500 dark:text-slate-300">Carregando…</p>}
                {!loading && tarefas.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-300">Sem tarefas ainda.</p>}

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
            {!loading && items.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-300">Nada pendente nos próximos dias 🎉</p>}

            {items.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3 py-2">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">{r.titulo || "Sem título"}</p>
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

    useEffect(() => {
        if (!user?.id) return;

        const run = async () => {
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
            for (let i = 0; i < 7; i++) {
                const d = new Date(hoje);
                d.setDate(d.getDate() + i);
                const key = ymd(d);
                mapa.set(key, { key, label: d.toLocaleDateString("pt-BR", { weekday: "short" }), tarefas: 0, revisoes: 0 });
            }

            for (const t of tarefas || []) {
                if (mapa.has(t.prazo)) mapa.get(t.prazo).tarefas += 1;
            }
            for (const r of revisoes || []) {
                if (mapa.has(r.data_revisao)) mapa.get(r.data_revisao).revisoes += 1;
            }

            setDias(Array.from(mapa.values()));
        };

        run();
    }, [user?.id]);

    return (
        <div className="space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-300">Próximos 7 dias</p>
            <div className="grid grid-cols-7 gap-2">
                {dias.map((d) => (
                    <div key={d.key} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-2 text-center">
                        <p className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-300">{d.label.replace('.', '')}</p>
                        <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-black mt-1">T {d.tarefas}</p>
                        <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-black">R {d.revisoes}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ProgressoSemanalWidget({ user }) {
    const [horas, setHoras] = useState(0);
    const meta = 20;

    useEffect(() => {
        if (!user?.id) return;

        const run = async () => {
            const hoje = new Date();
            const diaSemana = (hoje.getDay() + 6) % 7;
            const segunda = new Date(hoje);
            segunda.setDate(hoje.getDate() - diaSemana);
            segunda.setHours(0, 0, 0, 0);

            const { data } = await supabase
                .from("sessoes_estudo")
                .select("duracao_segundos")
                .eq("user_id", user.id)
                .gte("inicio_em", segunda.toISOString());

            const total = (data || []).reduce((acc, x) => acc + Number(x.duracao_segundos || 0), 0);
            setHoras(total / 3600);
        };

        run();
    }, [user?.id]);

    const percentual = Math.min(100, Math.round((horas / meta) * 100));

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm font-black text-slate-800 dark:text-slate-100">Meta da semana</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">{horas.toFixed(1)}h / {meta}h</p>
            </div>
            <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${percentual}%` }} />
            </div>
            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{percentual}% concluído</p>
        </div>
    );
}

/* ==============================
   ✅ Conteúdo por widget
================================ */
function WidgetContent({ widget, user }) {
    if (widget.type === "streak") return <StreakWidget user={user} />;
    if (widget.type === "ultimos_5_dias") return <Ultimos5DiasWidget user={user} />;

    if (widget.type === "motivacional") {
        return (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 p-4">
                <p className="text-sm text-slate-700 dark:text-slate-200 font-semibold">
                    “Você está mandando muito bem. Continue assim!”
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Depois eu coloco frases aleatórias + personalizadas 💬
                </p>
            </div>
        );
    }

    if (widget.type === "todo") return <TodoWidget user={user} />;

    if (widget.type === "calendario_mini") return <AgendaMiniWidget user={user} />;

    if (widget.type === "cronometro_basico") return <ProgressoSemanalWidget user={user} />;

    if (widget.type === "revisoes_futuras") return <RevisoesFuturasWidget user={user} />;

    return null;
}

/* ==============================
   ✅ Workspace
================================ */
export default function Workspace({ user }) {
    const [widgets, setWidgets] = useState([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [selectedTypes, setSelectedTypes] = useState([]);

    const saveTimer = useRef(null);

    // ✅ Importantíssimo: evita o load sobrescrever seus cliques
    const didEditRef = useRef(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const ids = useMemo(() => widgets.map((w) => w.id), [widgets]);

    // ✅ Carrega layout do Supabase
    useEffect(() => {
        if (!user?.id) return;

        const load = async () => {
            const { data, error } = await supabase
                .from("workspace_layouts")
                .select("layout")
                .eq("user_id", user.id)
                .maybeSingle();

            // ✅ Se você já clicou/arrastou, NÃO sobrescreve
            if (didEditRef.current) return;

            if (!error && data?.layout?.widgets) {
                setWidgets(data.layout.widgets);
            } else {
                setWidgets([]);
            }
        };

        load();
    }, [user?.id]);

    // ✅ Salva layout no Supabase (debounce)
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
            {/* Top bar */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-cyan-600 text-white">
                            <LayoutGrid size={20} />
                        </div>

                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                Workspace
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Arraste para reorganizar • Salva automaticamente
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => { setPickerOpen(true); setSelectedTypes([]); }}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm cursor-pointer sm:self-auto self-start"
                    >
                        <Plus size={18} />
                        Adicionar widget
                    </button>
                </div>
            </div>

            {/* Empty state */}
            {widgets.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
                    <p className="font-black text-slate-800 dark:text-slate-100 text-lg">
                        Seu workspace está vazio
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Clique em <span className="font-black">Adicionar widget</span> para montar do seu jeito.
                    </p>
                </div>
            )}

            {/* Widgets grid */}
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

            {/* Widget Picker modal */}
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
                            Selecione um bloco para colocar no workspace.
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
                                className="w-full py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black"
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
