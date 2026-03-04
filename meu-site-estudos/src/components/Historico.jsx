import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { CalendarDays, Clock3, Filter } from "lucide-react";

const PERIODOS = {
    dia: "Dia",
    semana: "Semana",
    ano: "Ano",
    personalizado: "Personalizado",
};

const inicioDoDia = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const fimDoDia = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
};

const inicioDaSemana = (d) => {
    const x = inicioDoDia(d);
    const diaSemana = x.getDay();
    const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
    x.setDate(x.getDate() + diff);
    return x;
};

const fimDaSemana = (d) => {
    const x = inicioDaSemana(d);
    x.setDate(x.getDate() + 6);
    return fimDoDia(x);
};

const inicioDoAno = (d) => new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
const fimDoAno = (d) => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

const formatarHMS = (segundos = 0) => {
    const total = Math.max(0, Number(segundos) || 0);
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
};

const Historico = ({ user }) => {
    const hoje = useMemo(() => new Date(), []);
    const hojeISO = useMemo(() => hoje.toISOString().slice(0, 10), [hoje]);

    const [loading, setLoading] = useState(true);
    const [entradas, setEntradas] = useState([]);
    const [periodo, setPeriodo] = useState("semana");
    const [dataBase, setDataBase] = useState(hojeISO);
    const [dataInicioCustom, setDataInicioCustom] = useState(hojeISO);
    const [dataFimCustom, setDataFimCustom] = useState(hojeISO);

    const intervalo = useMemo(() => {
        const base = dataBase ? new Date(`${dataBase}T12:00:00`) : new Date();

        if (periodo === "dia") {
            return { inicio: inicioDoDia(base), fim: fimDoDia(base) };
        }

        if (periodo === "semana") {
            return { inicio: inicioDaSemana(base), fim: fimDaSemana(base) };
        }

        if (periodo === "ano") {
            return { inicio: inicioDoAno(base), fim: fimDoAno(base) };
        }

        const inicio = dataInicioCustom
            ? inicioDoDia(new Date(`${dataInicioCustom}T12:00:00`))
            : inicioDoDia(base);
        const fim = dataFimCustom
            ? fimDoDia(new Date(`${dataFimCustom}T12:00:00`))
            : fimDoDia(base);

        if (inicio > fim) return { inicio: fimDoDia(fim), fim: inicioDoDia(inicio) };
        return { inicio, fim };
    }, [periodo, dataBase, dataInicioCustom, dataFimCustom]);

    const carregarHistorico = async () => {
        if (!user?.id) return;
        setLoading(true);

        const inicioISO = intervalo.inicio.toISOString();
        const fimISO = intervalo.fim.toISOString();

        try {
            const [{ data: sessoes }, { data: subjects }, { data: blocos }] = await Promise.all([
                supabase
                    .from("sessoes_estudo")
                    .select("id,materia,conteudo,tipo_estudo,inicio_em,duracao_segundos,modo")
                    .eq("user_id", user.id)
                    .gte("inicio_em", inicioISO)
                    .lte("inicio_em", fimISO)
                    .order("inicio_em", { ascending: false }),
                supabase
                    .from("study_cycle_subjects")
                    .select("id,nome")
                    .eq("user_id", user.id),
                supabase
                    .from("study_cycle_sessions")
                    .select("id,subject_id,minutos,started_at")
                    .eq("user_id", user.id)
                    .gte("started_at", inicioISO)
                    .lte("started_at", fimISO)
                    .order("started_at", { ascending: false }),
            ]);

            const nomesMaterias = (subjects || []).reduce((acc, item) => {
                acc[item.id] = item.nome;
                return acc;
            }, {});

            const doEstudarAgora = (sessoes || []).map((item) => ({
                id: `sessao-${item.id}`,
                origem: item.modo === "manual" ? "Estudar Agora (manual)" : "Estudar Agora",
                materia: item.materia || "Sem matéria",
                conteudo: item.conteudo || "Sem conteúdo",
                inicio: item.inicio_em,
                segundos: Number(item.duracao_segundos) || 0,
                tipo: item.tipo_estudo || "Teoria",
            }));

            const doCiclo = (blocos || []).map((item) => ({
                id: `ciclo-${item.id}`,
                origem: "Ciclo de Estudos",
                materia: nomesMaterias[item.subject_id] || "Matéria do ciclo",
                conteudo: "Bloco concluído",
                inicio: item.started_at,
                segundos: (Number(item.minutos) || 0) * 60,
                tipo: "Bloco de ciclo",
            }));

            const combinado = [...doEstudarAgora, ...doCiclo].sort(
                (a, b) => new Date(b.inicio) - new Date(a.inicio)
            );

            setEntradas(combinado);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarHistorico();
        // eslint-disable-next-line
    }, [user?.id, intervalo.inicio.getTime(), intervalo.fim.getTime()]);

    const diasAgrupados = useMemo(() => {
        const bucket = new Map();

        entradas.forEach((item) => {
            const data = new Date(item.inicio);
            const chave = data.toISOString().slice(0, 10);

            if (!bucket.has(chave)) {
                bucket.set(chave, {
                    key: chave,
                    data,
                    totalSegundos: 0,
                    itens: [],
                });
            }

            const grupo = bucket.get(chave);
            grupo.totalSegundos += item.segundos;
            grupo.itens.push(item);
        });

        return Array.from(bucket.values()).sort((a, b) => b.data - a.data);
    }, [entradas]);

    const totalPeriodo = useMemo(
        () => diasAgrupados.reduce((acc, d) => acc + d.totalSegundos, 0),
        [diasAgrupados]
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/60 xl:col-span-3">
                    <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-3">
                        <Filter size={16} />
                        <p className="text-xs font-black uppercase tracking-widest">Filtro de período</p>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {Object.entries(PERIODOS).map(([valor, label]) => (
                            <button
                                key={valor}
                                onClick={() => setPeriodo(valor)}
                                className={`px-3 py-2 rounded-xl text-sm font-bold border cursor-pointer ${periodo === valor
                                        ? "bg-cyan-600 text-white border-cyan-500"
                                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Data base
                            <input
                                type="date"
                                value={dataBase}
                                onChange={(e) => setDataBase(e.target.value)}
                                className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2"
                            />
                        </label>

                        {periodo === "personalizado" && (
                            <>
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Início
                                    <input
                                        type="date"
                                        value={dataInicioCustom}
                                        onChange={(e) => setDataInicioCustom(e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2"
                                    />
                                </label>

                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Fim
                                    <input
                                        type="date"
                                        value={dataFimCustom}
                                        onChange={(e) => setDataFimCustom(e.target.value)}
                                        className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2"
                                    />
                                </label>
                            </>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-white dark:bg-slate-900">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">Total no período</p>
                    <p className="mt-2 text-3xl font-black text-cyan-600 dark:text-cyan-400">{formatarHMS(totalPeriodo)}</p>
                    <p className="text-sm mt-2 text-slate-500">{diasAgrupados.length} dia(s) com estudo</p>
                </div>
            </div>

            <div className="space-y-4">
                {loading && <p className="text-slate-500">Carregando histórico...</p>}

                {!loading && diasAgrupados.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-500">
                        Nenhum estudo encontrado no período selecionado.
                    </div>
                )}

                {!loading &&
                    diasAgrupados.map((dia) => (
                        <article
                            key={dia.key}
                            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                        >
                            <header className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-2">
                                    <CalendarDays size={16} className="text-cyan-500" />
                                    <h3 className="font-black text-slate-900 dark:text-white">
                                        {new Date(dia.key + "T00:00:00").toLocaleDateString("pt-BR", {
                                            weekday: "long",
                                            day: "2-digit",
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </h3>
                                </div>

                                <div className="inline-flex items-center gap-2 text-sm font-bold text-cyan-600 dark:text-cyan-400">
                                    <Clock3 size={14} />
                                    {formatarHMS(dia.totalSegundos)}
                                </div>
                            </header>

                            <div className="mt-3 space-y-3 border-l-2 border-cyan-500/30 pl-4">
                                {dia.itens.map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3"
                                    >
                                        <p className="text-[11px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                                            {item.origem}
                                        </p>
                                        <p className="font-bold text-slate-900 dark:text-white">{item.materia}</p>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">{item.conteudo}</p>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                            <span>{item.tipo}</span>
                                            <span>
                                                {new Date(item.inicio).toLocaleTimeString("pt-BR", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                            <span>{formatarHMS(item.segundos)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </article>
                    ))}
            </div>
        </div>
    );
};

export default Historico;
