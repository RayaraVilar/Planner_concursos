import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import {
    LayoutDashboard,
    Timer,
    Calendar,
    CheckSquare,
    BookOpen,
    History,
    LogOut,
    Menu,
    Repeat,
    Layers,
    ListTree,
    BarChart3,
    Flame,
    Users,
    NotebookPen,
} from "lucide-react";

import EstudarAgora from "./EstudarAgora";
import Calendario from "./Calendario";
import Workspace from "./Workspace";
import GerenciadorTarefas from "./GerenciadorTarefas";
import AgendaRevisoes from "./AgendaRevisoes";
import Materias from "./Materias";
import CicloEstudos from "./CicloEstudos";
import Flashcards from "./Flashcards";
import DashboardGeral from "./DashboardGeral";
import Constancia from "./Constancia"; // ✅ CONSTÂNCIA
import Friendships from "./Friendships";
import Historico from "./Historico";
import Anotacoes from "./Anotacoes";

function Dashboard({ user }) {
    const [abaAtiva, setAbaAtiva] = useState("inicio");
    const [menuAberto, setMenuAberto] = useState(true);

    const MenuLink = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => setAbaAtiva(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer
        ${abaAtiva === id
                    ? "bg-cyan-600 text-white shadow-lg"
                    : "text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
        >
            <Icon size={20} className="min-w-[20px]" />
            {menuAberto && (
                <span className="font-medium whitespace-nowrap">{label}</span>
            )}
        </button>
    );

    const titulo = (() => {
        if (abaAtiva === "inicio") return "Workspace";
        if (abaAtiva === "dashboard-geral") return "Dashboard Geral";
        if (abaAtiva === "constancia") return "Constância";
        if (abaAtiva === "cronometro") return "Estudar Agora";
        if (abaAtiva === "materias") return "Matérias";
        if (abaAtiva === "ciclo") return "Ciclo de Estudos";
        if (abaAtiva === "flashcards") return "Flashcards";
        if (abaAtiva === "calendario") return "Calendário";
        if (abaAtiva === "tarefas") return "To-do list";
        if (abaAtiva === "revisoes") return "Revisões";
        if (abaAtiva === "historico") return "Histórico";
        if (abaAtiva === "amizades") return "Amizades";
        if (abaAtiva === "anotacoes") return "Anotações";
        return "Dashboard";
    })();

    return (
        <div className="flex min-h-screen w-full font-sans bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            {/* MENU LATERAL */}
            <aside
                className={`border-r p-4 flex flex-col transition-all duration-300
        ${menuAberto ? "w-64" : "w-20"}
        bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800`}
            >
                {/* Header Menu */}
                <div
                    className={`flex items-center mb-6 ${menuAberto ? "justify-between" : "justify-center"
                        }`}
                >
                    {menuAberto && (
                        <h2 className="text-xl font-bold px-2 tracking-tight text-cyan-600 dark:text-cyan-400">
                            PLANNER PRO
                        </h2>
                    )}
                    <button
                        onClick={() => setMenuAberto(!menuAberto)}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-cyan-600 dark:text-cyan-400 cursor-pointer"
                    >
                        <Menu size={24} />
                    </button>
                </div>

                {/* NAV COM SCROLL */}
                <nav className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2">
                    {/* ✅ VISÃO GERAL */}
                    {menuAberto && (
                        <p className="px-2 pt-2 pb-1 text-xs font-bold tracking-[0.18em] text-cyan-600 dark:text-cyan-400">
                            VISÃO GERAL
                        </p>
                    )}
                    <MenuLink
                        id="dashboard-geral"
                        icon={BarChart3}
                        label="Dashboard Geral"
                    />
                    <MenuLink id="inicio" icon={LayoutDashboard} label="Workspace" />
                    <MenuLink id="constancia" icon={Flame} label="Constância" />

                    {/* ✅ PLANEJAMENTO */}
                    {menuAberto && (
                        <p className="px-2 pt-4 pb-1 text-xs font-bold tracking-[0.18em] text-cyan-600 dark:text-cyan-400">
                            PLANEJAMENTO
                        </p>
                    )}
                    <MenuLink id="materias" icon={ListTree} label="Matérias" />
                    <MenuLink id="ciclo" icon={Repeat} label="Ciclo de Estudos" />
                    <MenuLink id="calendario" icon={Calendar} label="Calendário" />
                    <MenuLink id="tarefas" icon={CheckSquare} label="To-Do" />

                    {/* ✅ EXECUÇÃO */}
                    {menuAberto && (
                        <p className="px-2 pt-4 pb-1 text-xs font-bold tracking-[0.18em] text-cyan-600 dark:text-cyan-400">
                            EXECUÇÃO
                        </p>
                    )}
                    <MenuLink id="cronometro" icon={Timer} label="Estudar Agora" />
                    <MenuLink id="flashcards" icon={Layers} label="Flashcards" />
                    <MenuLink id="anotacoes" icon={NotebookPen} label="Anotações" />

                    {/* ✅ ACOMPANHAMENTO */}
                    {menuAberto && (
                        <p className="px-2 pt-4 pb-1 text-xs font-bold tracking-[0.18em] text-cyan-600 dark:text-cyan-400">
                            ACOMPANHAMENTO
                        </p>
                    )}
                    <MenuLink id="revisoes" icon={BookOpen} label="Revisões" />
                    <MenuLink id="historico" icon={History} label="Histórico" />
                    <MenuLink id="amizades" icon={Users} label="Amizades" />

                </nav>

                {/* ✅ BOTÃO SAIR SEM SAIR DA TELA */}
                <div className="pt-4">
                    <button
                        onClick={() => supabase.auth.signOut()}
                        className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 rounded-lg transition-all cursor-pointer"
                    >
                        <LogOut size={20} />
                        {menuAberto && <span className="font-medium">Sair</span>}
                    </button>
                </div>
            </aside>

            {/* CONTEÚDO */}
            <main className="flex-1 p-8 overflow-y-auto">
                <header className="mb-10">
                    <h1 className="text-3xl font-bold uppercase">{titulo}</h1>
                    <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                        Conectado: {user.email}
                    </p>
                </header>

                {abaAtiva === "inicio" ? (
                    <Workspace user={user} />
                ) : (
                    <section className="rounded-2xl p-6 min-h-[500px] shadow-xl border bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                        {abaAtiva === "dashboard-geral" && <DashboardGeral user={user} />}
                        {abaAtiva === "constancia" && <Constancia user={user} />}

                        <div className={abaAtiva === "cronometro" ? "block" : "hidden"}>
                            <EstudarAgora user={user} />
                        </div>
                        {abaAtiva === "materias" && <Materias user={user} />}
                        {abaAtiva === "ciclo" && <CicloEstudos user={user} />}
                        {abaAtiva === "flashcards" && <Flashcards user={user} />}

                        {abaAtiva === "calendario" && <Calendario user={user} />}
                        {abaAtiva === "tarefas" && <GerenciadorTarefas user={user} />}
                        {abaAtiva === "revisoes" && <AgendaRevisoes user={user} />}

                        {abaAtiva === "historico" && <Historico user={user} />}
                        {abaAtiva === "amizades" && <Friendships />}
                        {abaAtiva === "anotacoes" && <Anotacoes user={user} />}
                    </section>
                )}
            </main>
        </div>
    );
}

export default Dashboard;
