import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Flame, CalendarDays, TrendingUp, RefreshCw, Sparkles, Info } from "lucide-react";

const TZ = "America/Fortaleza";

function toDateKey(dateOrIso) {
    const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
    return d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function buildLastNDays(n) {
    const today = new Date();
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
        const dt = addDays(today, -i);
        days.push({ key: toDateKey(dt), date: dt });
    }
    return days;
}

function computeStreakFrom(dayKeysSet, startKey) {
    let streak = 0;
    let cursor = new Date(startKey + "T12:00:00");
    while (dayKeysSet.has(toDateKey(cursor))) {
        streak += 1;
        cursor = addDays(cursor, -1);
    }
    return streak;
}

function computeCurrentStreak(dayKeysSet, todayKey) {
    if (dayKeysSet.has(todayKey)) {
        return computeStreakFrom(dayKeysSet, todayKey);
    }

    const yesterdayKey = toDateKey(addDays(new Date(`${todayKey}T12:00:00`), -1));
    return computeStreakFrom(dayKeysSet, yesterdayKey);
}

function computeBestStreak(dayKeysSet, orderedKeys) {
    let best = 0;
    let run = 0;
    for (const k of orderedKeys) {
        if (dayKeysSet.has(k)) {
            run += 1;
            if (run > best) best = run;
        } else run = 0;
    }
    return best;
}

export default function Constancia({ user }) {
    const [loading, setLoading] = useState(true);
    const [statsByDay, setStatsByDay] = useState({});
    const [error, setError] = useState(null);

    // ✅ animação compromisso (não mexe no streak)
    const [commitAnim, setCommitAnim] = useState(false);

    const last90 = useMemo(() => buildLastNDays(90), []);
    const last30 = useMemo(() => buildLastNDays(30), []);
    const todayKey = useMemo(() => toDateKey(new Date()), []);

    // ✅ regra: dia “conta” se tiver evidência real (cronômetro OU ciclo OU 1 tarefa concluída)
    const studiedDays = useMemo(() => {
        const keys = new Set();
        for (const [day, s] of Object.entries(statsByDay)) {
            const hasStudySession = (s.studySeconds || 0) > 0;
            const hasCycleSession = (s.cycleMinutes || 0) > 0;
            const hasTaskDone = (s.tasksAll || 0) >= 1; // ✅ 1 task concluída já conta

            if (hasStudySession || hasCycleSession || hasTaskDone) keys.add(day);
        }
        return keys;
    }, [statsByDay]);

    const currentStreak = useMemo(
        () => computeCurrentStreak(studiedDays, todayKey),
        [studiedDays, todayKey]
    );

    const bestStreak90 = useMemo(() => {
        const orderedKeys = last90.map((d) => d.key);
        return computeBestStreak(studiedDays, orderedKeys);
    }, [studiedDays, last90]);

    const studiedLast7 = useMemo(() => {
        const last7 = buildLastNDays(7).map((d) => d.key);
        return last7.filter((k) => studiedDays.has(k)).length;
    }, [studiedDays]);

    const todayStats = statsByDay[todayKey] || {};
    const todayMinutes = Math.round(((todayStats.studySeconds || 0) / 60) + (todayStats.cycleMinutes || 0));
    const todayTasks = todayStats.tasksAll || 0;

    function handleCommit() {
        setCommitAnim(true);
        setTimeout(() => setCommitAnim(false), 1900);
    }

    async function fetchConstancia() {
        if (!user?.id) return;
        setLoading(true);
        setError(null);

        try {
            const since = addDays(new Date(), -120).toISOString();

            const { data: sessoes, error: err1 } = await supabase
                .from("sessoes_estudo")
                .select("inicio_em, duracao_segundos")
                .eq("user_id", user.id)
                .gte("inicio_em", since);
            if (err1) throw err1;

            const { data: cicloSessions, error: err2 } = await supabase
                .from("study_cycle_sessions")
                .select("started_at, minutos")
                .eq("user_id", user.id)
                .gte("started_at", since);
            if (err2) throw err2;

            const { data: tarefas, error: err3 } = await supabase
                .from("tarefas")
                .select("concluida, concluida_em")
                .eq("user_id", user.id)
                .eq("concluida", true)
                .not("concluida_em", "is", null)
                .gte("concluida_em", since);
            if (err3) throw err3;

            const acc = {};

            for (const s of (sessoes || [])) {
                const key = toDateKey(s.inicio_em);
                if (!acc[key]) acc[key] = { studySeconds: 0, cycleMinutes: 0, tasksAll: 0 };
                acc[key].studySeconds += Number(s.duracao_segundos || 0);
            }

            for (const c of (cicloSessions || [])) {
                const key = toDateKey(c.started_at);
                if (!acc[key]) acc[key] = { studySeconds: 0, cycleMinutes: 0, tasksAll: 0 };
                acc[key].cycleMinutes += Number(c.minutos || 0);
            }

            for (const t of (tarefas || [])) {
                const key = toDateKey(t.concluida_em);
                if (!acc[key]) acc[key] = { studySeconds: 0, cycleMinutes: 0, tasksAll: 0 };
                acc[key].tasksAll += 1;
            }

            setStatsByDay(acc);
        } catch (e) {
            setError(e?.message || "Erro ao carregar constância.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchConstancia();

        const channel = supabase
            .channel("constancia-watch")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "sessoes_estudo", filter: `user_id=eq.${user?.id}` },
                () => fetchConstancia()
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "study_cycle_sessions", filter: `user_id=eq.${user?.id}` },
                () => fetchConstancia()
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "tarefas", filter: `user_id=eq.${user?.id}` },
                () => fetchConstancia()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const heatDays = useMemo(() => {
        const ordered = last30.map((d) => d.key);

        const max = Math.max(
            1,
            ...ordered.map((k) => {
                const s = statsByDay[k] || {};
                const minutes = ((s.studySeconds || 0) / 60) + (s.cycleMinutes || 0);
                const score = minutes + (s.tasksAll || 0) * 2;
                return Math.round(score);
            })
        );

        return ordered.map((k) => {
            const s = statsByDay[k] || {};
            const minutes = ((s.studySeconds || 0) / 60) + (s.cycleMinutes || 0);
            const score = minutes + (s.tasksAll || 0) * 2;

            const ratio = score / max;
            const level =
                ratio <= 0.05 ? 0 :
                    ratio <= 0.25 ? 1 :
                        ratio <= 0.50 ? 2 :
                            ratio <= 0.80 ? 3 : 4;

            return {
                key: k,
                level,
                studied: studiedDays.has(k),
                raw: {
                    minutes: Math.round(minutes),
                    cycleMinutes: s.cycleMinutes || 0,
                    tasksAll: s.tasksAll || 0,
                },
            };
        });
    }, [last30, statsByDay, studiedDays]);

    // ✅ confete (sem imagens): posições determinísticas por índice
    const confettiPieces = useMemo(() => {
        const n = 28;
        return Array.from({ length: n }, (_, i) => {
            const angle = (i / n) * Math.PI * 2;
            const radiusX = 140 + (i % 7) * 12;
            const radiusY = 120 + (i % 5) * 10;

            const dx = Math.cos(angle) * radiusX;
            const dy = Math.sin(angle) * radiusY - 40; // puxa um pouco pra cima
            const delay = (i % 10) * 0.03;

            // alterna formato
            const shape = i % 3; // 0 bolinha, 1 retângulo, 2 losango

            return { i, dx: Math.round(dx), dy: Math.round(dy), delay, shape };
        });
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-cyan-600 text-white">
                        <Flame size={20} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold">Constância</h2>
                        <p className="text-slate-600 dark:text-slate-400 text-sm">
                            Para registrar o dia, faça alguma atividade: cronômetro, ciclo ou tarefa concluída.
                        </p>
                    </div>
                </div>

                {/* ✅ Agora o topo fica só com atualizar */}
                <button
                    onClick={fetchConstancia}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:opacity-90 cursor-pointer"
                >
                    <RefreshCw size={16} />
                    Atualizar
                </button>
            </div>

            {error && (
                <div className="rounded-2xl border p-4 bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-200">
                    {error}
                </div>
            )}

            <div className="grid md:grid-cols-3 gap-4">
                {/* ✅ Sequência atual + botão "Eu me comprometo" aqui */}
                <div className="rounded-2xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                    {/* brilho decorativo */}
                    <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-cyan-400/20 blur-2xl" />
                    <div className="absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-cyan-600/10 blur-2xl" />

                    <div className="flex items-center gap-2 font-semibold">
                        <Flame size={18} /> Sequência atual
                    </div>

                    <p className="mt-3 text-4xl font-black text-cyan-600 dark:text-cyan-400">
                        {loading ? "…" : `${currentStreak} dia(s)`}
                    </p>

                    <div className="mt-3 flex flex-col gap-2">
                        <button
                            onClick={handleCommit}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cyan-600 text-white font-black hover:opacity-90 cursor-pointer
                         animate-[softPulse_2.2s_ease-in-out_infinite]"
                        >
                            <Sparkles size={16} />
                            Eu me comprometo
                        </button>

                        <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <Info size={14} className="mt-[1px]" />
                            <span>
                                <b>Importante:</b> o compromisso <b>não registra o dia</b>.
                                Para o dia contar, você precisa fazer <b>cronômetro</b>, <b>ciclo</b> ou <b>concluir 1 tarefa</b>.
                            </span>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 font-semibold">
                        <TrendingUp size={18} /> Melhor streak (90 dias)
                    </div>
                    <p className="mt-3 text-4xl font-black text-slate-900 dark:text-white">
                        {loading ? "…" : `${bestStreak90} dia(s)`}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        Baseado na janela dos últimos 90 dias.
                    </p>
                </div>

                <div className="rounded-2xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-2 font-semibold">
                        <CalendarDays size={18} /> Hoje / Últimos 7 dias
                    </div>
                    <p className="mt-3 text-4xl font-black text-slate-900 dark:text-white">
                        {loading ? "…" : `${studiedLast7}/7`}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        Hoje: {loading ? "…" : `${todayMinutes} min • ${todayTasks} tarefa(s)`}
                    </p>
                </div>
            </div>

            {/* Heatmap */}
            <div className="rounded-2xl border p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
                <div>
                    <h3 className="font-black text-lg">Mapa de consistência (30 dias)</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        A intensidade é visual (minutos + tarefas). O “dia conta” pela regra de evidência real.
                    </p>
                </div>

                <div className="mt-5 grid grid-cols-10 sm:grid-cols-15 md:grid-cols-20 gap-2">
                    {heatDays.map((d) => {
                        const bg =
                            d.level === 0 ? "bg-slate-100 dark:bg-slate-800/70" :
                                d.level === 1 ? "bg-cyan-200/70 dark:bg-cyan-900/30" :
                                    d.level === 2 ? "bg-cyan-300/80 dark:bg-cyan-800/35" :
                                        d.level === 3 ? "bg-cyan-400/90 dark:bg-cyan-700/40" :
                                            "bg-cyan-600 dark:bg-cyan-500/60";

                        const ring = d.studied ? "ring-2 ring-cyan-500/60" : "ring-0";
                        const title = `${d.key} • ${d.raw.minutes || 0} min • ciclo ${d.raw.cycleMinutes || 0}m • tarefas ${d.raw.tasksAll || 0}`;

                        return (
                            <div
                                key={d.key}
                                title={title}
                                className={`h-7 w-7 rounded-lg ${bg} ${ring} border border-slate-200 dark:border-slate-700`}
                            />
                        );
                    })}
                </div>
            </div>

            {/* ✅ ANIMAÇÃO MAIS ANIMADA (CONFETE + BOUNCE) */}
            {commitAnim && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" />

                    <div className="relative w-[92%] max-w-[520px]">
                        {/* confete */}
                        <div className="absolute inset-0 pointer-events-none">
                            {confettiPieces.map((p) => (
                                <span
                                    key={p.i}
                                    className={`absolute left-1/2 top-1/2 confetti ${p.shape === 0 ? "confetti-dot" : p.shape === 1 ? "confetti-rect" : "confetti-diamond"
                                        }`}
                                    style={{
                                        "--dx": `${p.dx}px`,
                                        "--dy": `${p.dy}px`,
                                        "--delay": `${p.delay}s`,
                                    }}
                                />
                            ))}
                        </div>

                        {/* card */}
                        <div className="relative px-8 py-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl
                            animate-[bounceIn_700ms_cubic-bezier(.2,1.2,.2,1)] overflow-hidden">
                            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-cyan-400/25 blur-3xl animate-pulse" />
                            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-cyan-600/15 blur-3xl animate-pulse" />

                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-cyan-600 text-white animate-[wiggle_900ms_ease-in-out]">
                                    <Sparkles size={24} />
                                </div>

                                <div>
                                    <p className="text-xl font-black">Compromisso ativado! ✨</p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                        Agora registra o dia fazendo: cronômetro, ciclo ou 1 tarefa concluída.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div className="h-full w-full bg-cyan-600 animate-[shrink_1700ms_linear]" />
                            </div>

                            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                (Esse botão não altera a sequência — ele só te dá o “push” visual 😉)
                            </div>
                        </div>
                    </div>

                    <style>{`
            @keyframes bounceIn {
              0% { transform: translateY(12px) scale(.90); opacity: 0; }
              55% { transform: translateY(-6px) scale(1.03); opacity: 1; }
              100% { transform: translateY(0) scale(1); }
            }
            @keyframes wiggle {
              0%, 100% { transform: rotate(0deg) scale(1); }
              20% { transform: rotate(-6deg) scale(1.02); }
              40% { transform: rotate(6deg) scale(1.02); }
              60% { transform: rotate(-3deg) scale(1.01); }
              80% { transform: rotate(3deg) scale(1.01); }
            }
            @keyframes shrink {
              0% { transform: translateX(0%); }
              100% { transform: translateX(-100%); }
            }
            @keyframes softPulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.03); }
            }

            .confetti {
              width: 10px;
              height: 10px;
              transform: translate(-50%, -50%);
              animation: confettiBurst 900ms ease-out var(--delay) forwards;
              opacity: 0;
            }
            .confetti-dot { border-radius: 9999px; background: rgba(34, 211, 238, 0.9); }
            .confetti-rect { border-radius: 4px; background: rgba(8, 145, 178, 0.9); width: 12px; height: 8px; }
            .confetti-diamond { background: rgba(103, 232, 249, 0.9); transform: translate(-50%, -50%) rotate(45deg); width: 10px; height: 10px; }

            @keyframes confettiBurst {
              0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8) rotate(0deg); }
              10% { opacity: 1; }
              100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(1) rotate(720deg); }
            }
          `}</style>
                </div>
            )}
        </div>
    );
}
