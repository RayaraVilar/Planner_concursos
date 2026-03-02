import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import {
    BarChart3,
    Clock3,
    Target,
    Layers,
    CalendarCheck2,
    RefreshCw,
    PieChart as PieIcon,
} from "lucide-react";

const fmtHoras = (minutos) => `${(Number(minutos || 0) / 60).toFixed(1)}h`;

const cardThemes = [
    {
        wrap: "from-cyan-500/10 via-sky-500/10 to-indigo-500/10 dark:from-cyan-500/20 dark:via-sky-500/10 dark:to-indigo-500/20",
        icon: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
    },
    {
        wrap: "from-violet-500/10 via-fuchsia-500/10 to-pink-500/10 dark:from-violet-500/20 dark:via-fuchsia-500/10 dark:to-pink-500/20",
        icon: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
    },
    {
        wrap: "from-emerald-500/10 via-teal-500/10 to-cyan-500/10 dark:from-emerald-500/20 dark:via-teal-500/10 dark:to-cyan-500/20",
        icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    },
    {
        wrap: "from-amber-500/10 via-orange-500/10 to-rose-500/10 dark:from-amber-500/20 dark:via-orange-500/10 dark:to-rose-500/20",
        icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    },
];

const materiasColors = ["bg-cyan-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500"];

function safeBool(v) {
    return v === true || v === "true" || v === 1 || v === "1";
}

function sumBy(arr, fn) {
    return (arr || []).reduce((acc, x) => acc + Number(fn(x) || 0), 0);
}

export default function DashboardGeral({ user }) {
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState("");
    const [dados, setDados] = useState({
        sessoes: [],
        cicloSessoes: [],
        cicloMaterias: [],
        cards: [],
        tarefas: [],
        revisoes: [],
    });

    const carregar = async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setErro("");

        try {
            const [
                { data: sessoes, error: e1 },
                { data: cicloSessoes, error: e2 },
                { data: cicloMateriasRaw, error: e3 },
                { data: cardsRaw, error: e4 },
                { data: tarefas, error: e5 },
                { data: revisoes, error: e6 },
            ] = await Promise.all([
                supabase
                    .from("sessoes_estudo")
                    .select("duracao_segundos, modo, materia, inicio_em")
                    .eq("user_id", user.id),

                supabase
                    .from("study_cycle_sessions")
                    .select("minutos, started_at, subject_id")
                    .eq("user_id", user.id),

                // ✅ seu schema tem: nome, meta_minutos, minutos_planejados, minutos_feitos
                supabase
                    .from("study_cycle_subjects")
                    .select("id, nome, meta_minutos, minutos_planejados, minutos_feitos")
                    .eq("user_id", user.id),

                // ✅ seu schema tem: is_favorite, repetitions, wrong_total, etc.
                supabase
                    .from("flash_cards")
                    .select("id, is_favorite, repetitions, wrong_total, created_at")
                    .eq("user_id", user.id),

                supabase
                    .from("tarefas")
                    .select("id, concluida, concluida_em, created_at")
                    .eq("user_id", user.id),

                supabase
                    .from("revisoes_agendadas")
                    .select("id, executada, qtd_feitas, qtd_acertos, data_revisao")
                    .eq("user_id", user.id),
            ]);

            const erroQuery = e1 || e2 || e3 || e4 || e5 || e6;
            if (erroQuery) throw erroQuery;

            const cicloMaterias = (cicloMateriasRaw || []).map((s) => ({
                ...s,
                meta_minutos: Number(s.meta_minutos ?? 0),
                minutos_planejados: Number(s.minutos_planejados ?? s.meta_minutos ?? 0),
                minutos_feitos: Number(s.minutos_feitos ?? 0),
            }));

            const cards = (cardsRaw || []).map((c) => ({
                ...c,
                favoritos: safeBool(c.is_favorite),
                repetitions: Number(c.repetitions ?? 0),
                wrong_total: Number(c.wrong_total ?? 0),
            }));

            setDados({
                sessoes: sessoes || [],
                cicloSessoes: cicloSessoes || [],
                cicloMaterias,
                cards,
                tarefas: tarefas || [],
                revisoes: revisoes || [],
            });
        } catch (e) {
            setErro(e?.message || "Não foi possível carregar as estatísticas.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const stats = useMemo(() => {
        const totalSegSessoes = sumBy(dados.sessoes, (s) => s.duracao_segundos);
        const segCronometro = sumBy(
            dados.sessoes.filter((s) => s.modo === "cronometro"),
            (s) => s.duracao_segundos
        );
        const segManual = sumBy(
            dados.sessoes.filter((s) => s.modo === "manual"),
            (s) => s.duracao_segundos
        );

        const minutosCiclo = sumBy(dados.cicloSessoes, (s) => s.minutos);
        const minutosPlanejadosCiclo = sumBy(dados.cicloMaterias, (s) => s.minutos_planejados);
        const minutosFeitosCiclo = sumBy(dados.cicloMaterias, (s) => s.minutos_feitos);

        const tarefasTotal = dados.tarefas.length;
        const tarefasConcluidas = dados.tarefas.filter((t) => t.concluida).length;

        const revisoesTotal = dados.revisoes.length;
        const revisoesConcluidas = dados.revisoes.filter((r) => r.executada).length;
        const revisoesQuestoesFeitas = sumBy(dados.revisoes, (r) => r.qtd_feitas);
        const revisoesAcertos = sumBy(dados.revisoes, (r) => r.qtd_acertos);

        // Flashcards (sem tabela flash_card_reviews)
        const cardsTotal = dados.cards.length;
        const cardsFavoritos = dados.cards.filter((c) => c.favoritos).length;

        // “revisões” aproximadas (quantas vezes revisou): soma repetitions
        const reviewsTotal = sumBy(dados.cards, (c) => c.repetitions);

        const topMaterias = Object.entries(
            dados.sessoes.reduce((acc, s) => {
                const nome = (s.materia || "Sem matéria").trim() || "Sem matéria";
                acc[nome] = (acc[nome] || 0) + Number(s.duracao_segundos || 0);
                return acc;
            }, {})
        )
            .map(([nome, segundos]) => ({ nome, segundos }))
            .sort((a, b) => b.segundos - a.segundos)
            .slice(0, 5);

        const taxaConclusaoTarefas = tarefasTotal ? Math.round((tarefasConcluidas / tarefasTotal) * 100) : 0;
        const taxaConclusaoRevisoes = revisoesTotal ? Math.round((revisoesConcluidas / revisoesTotal) * 100) : 0;
        const taxaAcertoRevisoes = revisoesQuestoesFeitas ? Math.round((revisoesAcertos / revisoesQuestoesFeitas) * 100) : 0;
        const progressoCiclo = minutosPlanejadosCiclo ? Math.round((minutosFeitosCiclo / minutosPlanejadosCiclo) * 100) : 0;

        const fontesHoras = [
            { nome: "Cronômetro", valor: segCronometro / 3600, cor: "bg-cyan-500" },
            { nome: "Manual", valor: segManual / 3600, cor: "bg-violet-500" },
            { nome: "Ciclo", valor: minutosCiclo / 60, cor: "bg-emerald-500" },
        ];

        const totalFontesHoras = fontesHoras.reduce((acc, f) => acc + f.valor, 0);

        return {
            horasTotais: totalSegSessoes / 3600 + minutosCiclo / 60,
            horasCronometro: segCronometro / 3600,
            horasManual: segManual / 3600,
            horasCiclo: minutosCiclo / 60,

            progressoCiclo,
            minutosPlanejadosCiclo,
            minutosFeitosCiclo,

            cardsTotal,
            cardsFavoritos,
            reviewsTotal,

            tarefasTotal,
            tarefasConcluidas,

            revisoesTotal,
            revisoesConcluidas,
            taxaConclusaoTarefas,
            taxaConclusaoRevisoes,
            taxaAcertoRevisoes,

            topMaterias,
            fontesHoras,
            totalFontesHoras,
        };
    }, [dados]);

    const Card = ({ title, value, subtitle, icon: Icon, theme = cardThemes[0] }) => (
        <div className={`rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 bg-gradient-to-br ${theme.wrap} shadow-sm`}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
                <div className={`p-2 rounded-lg ${theme.icon}`}>
                    <Icon size={18} />
                </div>
            </div>
            <p className="text-2xl font-black mt-2">{value}</p>
            {subtitle && <p className="text-xs mt-1 text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
    );

    // Guard visual (evita “tela branca” quando user ainda não carregou)
    if (!user?.id && !loading) {
        return (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white/60 dark:bg-slate-900/40">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Faça login para ver o Dashboard Geral.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl font-black bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
                        Dashboard Geral
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Estatísticas consolidadas do seu banco de dados.
                    </p>
                </div>
                <button
                    onClick={carregar}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                    <RefreshCw size={16} /> Atualizar
                </button>
            </div>

            {erro && (
                <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 text-red-700 dark:text-red-300 p-4 text-sm">
                    {erro}
                </div>
            )}

            {loading ? (
                <div className="text-sm text-slate-500">Carregando estatísticas...</div>
            ) : (
                <>
                    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <Card
                            title="Horas totais estudadas"
                            value={fmtHoras(stats.horasTotais * 60)}
                            subtitle="Cronômetro + Manual + Ciclo"
                            icon={Clock3}
                            theme={cardThemes[0]}
                        />
                        <Card
                            title="Progresso no ciclo"
                            value={`${stats.progressoCiclo}%`}
                            subtitle={`Planejado: ${fmtHoras(stats.minutosPlanejadosCiclo)} • Feito: ${fmtHoras(stats.minutosFeitosCiclo)}`}
                            icon={Target}
                            theme={cardThemes[1]}
                        />
                        <Card
                            title="Flashcards"
                            value={`${stats.cardsTotal} cards`}
                            subtitle={`${stats.reviewsTotal} revisões • ${stats.cardsFavoritos} favoritos`}
                            icon={Layers}
                            theme={cardThemes[2]}
                        />
                        <Card
                            title="Tarefas concluídas"
                            value={`${stats.tarefasConcluidas}/${stats.tarefasTotal}`}
                            subtitle={`Taxa de conclusão: ${stats.taxaConclusaoTarefas}%`}
                            icon={CalendarCheck2}
                            theme={cardThemes[3]}
                        />
                    </div>

                    <div className="grid lg:grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white/60 dark:bg-slate-900/40">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <BarChart3 size={16} /> Fontes de horas
                            </h3>
                            <div className="space-y-3">
                                {stats.fontesHoras.map((fonte) => {
                                    const pct = stats.totalFontesHoras ? Math.round((fonte.valor / stats.totalFontesHoras) * 100) : 0;
                                    return (
                                        <div key={fonte.nome} className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span>{fonte.nome}</span>
                                                <strong>
                                                    {fmtHoras(fonte.valor * 60)} · {pct}%
                                                </strong>
                                            </div>
                                            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                                <div className={`h-full ${fonte.cor}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white/60 dark:bg-slate-900/40">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <PieIcon size={16} /> Revisões (agendadas)
                            </h3>
                            <div className="grid grid-cols-3 gap-3 text-center mb-4">
                                <div className="rounded-xl p-3 bg-cyan-100/70 dark:bg-cyan-900/30">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Concluídas</p>
                                    <p className="text-lg font-black text-cyan-700 dark:text-cyan-300">{stats.revisoesConcluidas}</p>
                                </div>
                                <div className="rounded-xl p-3 bg-violet-100/70 dark:bg-violet-900/30">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Taxa conclusão</p>
                                    <p className="text-lg font-black text-violet-700 dark:text-violet-300">{stats.taxaConclusaoRevisoes}%</p>
                                </div>
                                <div className="rounded-xl p-3 bg-emerald-100/70 dark:bg-emerald-900/30">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Taxa acerto</p>
                                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">{stats.taxaAcertoRevisoes}%</p>
                                </div>
                            </div>
                            <div className="h-2.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                                <div className="bg-cyan-500 h-full" style={{ width: `${stats.taxaConclusaoRevisoes}%` }} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-white/60 dark:bg-slate-900/40">
                        <h3 className="font-bold mb-4">Matérias mais estudadas</h3>
                        {stats.topMaterias.length === 0 ? (
                            <p className="text-sm text-slate-500">Ainda não há sessões registradas para montar ranking.</p>
                        ) : (
                            <div className="space-y-3">
                                {stats.topMaterias.map((m, idx) => {
                                    const base = stats.topMaterias[0]?.segundos || 0;
                                    const pct = base ? Math.round((m.segundos / base) * 100) : 0;
                                    return (
                                        <div key={m.nome}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>
                                                    {idx + 1}. {m.nome}
                                                </span>
                                                <strong>{(m.segundos / 3600).toFixed(1)}h</strong>
                                            </div>
                                            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                                <div className={`h-full ${materiasColors[idx % materiasColors.length]}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}