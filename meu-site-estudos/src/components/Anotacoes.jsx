import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookPlus,
  FilePlus2,
  Trash2,
  Pencil,
  Bold,
  Italic,
  Underline,
  Highlighter,
} from "lucide-react";

const textoInicial = `<h1>Bem-vindo(a)!</h1><p>Use este espaço como um Notion pessoal para organizar seus estudos.</p><ul><li>Crie cadernos por matéria</li><li>Separe notas por tema</li><li>Monte checklists com [ ] tarefas</li></ul>`;

const criarCadernoInicial = () => ({
  id: crypto.randomUUID(),
  titulo: "Meu caderno",
  notas: [
    {
      id: crypto.randomUUID(),
      titulo: "Primeira anotação",
      conteudo: textoInicial,
      atualizadoEm: new Date().toISOString(),
    },
  ],
});

const htmlSeguro = (conteudo = "") => {
  const texto = conteudo.trim();
  if (!texto) return "";

  if (/<\/?[a-z][\s\S]*>/i.test(texto)) return texto;

  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
};

function Anotacoes({ user }) {
  const storageKey = `planner-anotacoes-${user.id}`;
  const [cadernos, setCadernos] = useState([]);
  const [cadernoId, setCadernoId] = useState("");
  const [notaId, setNotaId] = useState("");
  const [tamanhoFonte, setTamanhoFonte] = useState("3");
  const editorRef = useRef(null);

  useEffect(() => {
    const salvo = localStorage.getItem(storageKey);
    if (salvo) {
      const dados = JSON.parse(salvo);
      setCadernos(dados);
      setCadernoId(dados[0]?.id || "");
      setNotaId(dados[0]?.notas?.[0]?.id || "");
      return;
    }

    const inicial = [criarCadernoInicial()];
    setCadernos(inicial);
    setCadernoId(inicial[0].id);
    setNotaId(inicial[0].notas[0].id);
  }, [storageKey]);

  useEffect(() => {
    if (!cadernos.length) return;
    localStorage.setItem(storageKey, JSON.stringify(cadernos));
  }, [cadernos, storageKey]);

  const cadernoAtual = useMemo(
    () => cadernos.find((c) => c.id === cadernoId),
    [cadernos, cadernoId]
  );

  const notaAtual = useMemo(
    () => cadernoAtual?.notas.find((n) => n.id === notaId),
    [cadernoAtual, notaId]
  );

  const criarCaderno = () => {
    const novo = {
      id: crypto.randomUUID(),
      titulo: `Novo caderno ${cadernos.length + 1}`,
      notas: [],
    };
    setCadernos((prev) => [...prev, novo]);
    setCadernoId(novo.id);
    setNotaId("");
  };

  const editarCaderno = () => {
    if (!cadernoAtual) return;
    const titulo = window.prompt("Novo nome do caderno:", cadernoAtual.titulo)?.trim();
    if (!titulo) return;

    setCadernos((prev) =>
      prev.map((c) => (c.id === cadernoAtual.id ? { ...c, titulo } : c))
    );
  };

  const excluirCaderno = () => {
    if (!cadernoAtual) return;
    const confirmou = window.confirm(
      `Excluir o caderno \"${cadernoAtual.titulo}\" e todas as notas dele?`
    );
    if (!confirmou) return;

    const restantes = cadernos.filter((c) => c.id !== cadernoAtual.id);
    setCadernos(restantes);
    setCadernoId(restantes[0]?.id || "");
    setNotaId(restantes[0]?.notas?.[0]?.id || "");
  };

  const criarNota = () => {
    if (!cadernoAtual) return;
    const nova = {
      id: crypto.randomUUID(),
      titulo: `Nova nota ${cadernoAtual.notas.length + 1}`,
      conteudo: "",
      atualizadoEm: new Date().toISOString(),
    };

    setCadernos((prev) =>
      prev.map((c) =>
        c.id === cadernoAtual.id ? { ...c, notas: [nova, ...c.notas] } : c
      )
    );
    setNotaId(nova.id);
  };

  const atualizarNota = (campo, valor) => {
    if (!cadernoAtual || !notaAtual) return;
    setCadernos((prev) =>
      prev.map((c) => {
        if (c.id !== cadernoAtual.id) return c;
        return {
          ...c,
          notas: c.notas.map((n) =>
            n.id === notaAtual.id
              ? {
                  ...n,
                  [campo]: valor,
                  atualizadoEm: new Date().toISOString(),
                }
              : n
          ),
        };
      })
    );
  };

  const excluirNota = () => {
    if (!cadernoAtual || !notaAtual) return;

    const restantes = cadernoAtual.notas.filter((n) => n.id !== notaAtual.id);
    setCadernos((prev) =>
      prev.map((c) => (c.id === cadernoAtual.id ? { ...c, notas: restantes } : c))
    );
    setNotaId(restantes[0]?.id || "");
  };

  const aplicarComando = (comando, valor = null) => {
    if (!notaAtual) return;
    editorRef.current?.focus();
    document.execCommand(comando, false, valor);
    atualizarNota("conteudo", editorRef.current?.innerHTML || "");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[230px_270px_1fr] gap-4 h-[65vh]">
      <aside className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Cadernos</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={editarCaderno}
              disabled={!cadernoAtual}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-40"
              title="Renomear caderno"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={excluirCaderno}
              disabled={!cadernoAtual}
              className="p-2 rounded-lg hover:bg-red-100 text-red-500 dark:hover:bg-red-900/20 cursor-pointer disabled:opacity-40"
              title="Excluir caderno"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={criarCaderno}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              title="Novo caderno"
            >
              <BookPlus size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[56vh] pr-1">
          {cadernos.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCadernoId(c.id);
                setNotaId(c.notas[0]?.id || "");
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer ${
                cadernoId === c.id
                  ? "bg-cyan-600 text-white"
                  : "hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <p className="font-medium truncate">{c.titulo}</p>
              <p className="text-xs opacity-75">{c.notas.length} nota(s)</p>
            </button>
          ))}
        </div>
      </aside>

      <aside className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Notas</h3>
          <button
            onClick={criarNota}
            disabled={!cadernoAtual}
            className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700 cursor-pointer"
            title="Nova nota"
          >
            <FilePlus2 size={18} />
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[56vh] pr-1">
          {cadernoAtual?.notas.map((n) => (
            <button
              key={n.id}
              onClick={() => setNotaId(n.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer ${
                notaId === n.id
                  ? "bg-cyan-600 text-white"
                  : "hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <p className="font-medium truncate">{n.titulo || "Sem título"}</p>
              <p className="text-xs opacity-75">
                {new Date(n.atualizadoEm).toLocaleDateString("pt-BR")}
              </p>
            </button>
          ))}
          {!cadernoAtual?.notas.length && (
            <p className="text-sm text-slate-500">Crie a primeira nota deste caderno.</p>
          )}
        </div>
      </aside>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
        {!notaAtual ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            Selecione ou crie uma nota para começar.
          </div>
        ) : (
          <div className="h-full flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                value={notaAtual.titulo}
                onChange={(e) => atualizarNota("titulo", e.target.value)}
                placeholder="Título da nota"
                className="w-full rounded-xl border px-4 py-2 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:border-cyan-500"
              />
              <button
                onClick={excluirNota}
                className="px-3 rounded-xl border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                title="Excluir nota"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
              <button
                onClick={() => aplicarComando("bold")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Negrito"
              >
                <Bold size={16} />
              </button>
              <button
                onClick={() => aplicarComando("italic")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Itálico"
              >
                <Italic size={16} />
              </button>
              <button
                onClick={() => aplicarComando("underline")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Sublinhado"
              >
                <Underline size={16} />
              </button>
              <button
                onClick={() => aplicarComando("hiliteColor", "#fef08a")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Grifado"
              >
                <Highlighter size={16} />
              </button>
              <select
                value={tamanhoFonte}
                onChange={(e) => {
                  setTamanhoFonte(e.target.value);
                  aplicarComando("fontSize", e.target.value);
                }}
                className="ml-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                title="Tamanho da fonte"
              >
                <option value="2">Pequena</option>
                <option value="3">Normal</option>
                <option value="4">Média</option>
                <option value="5">Grande</option>
                <option value="6">Muito grande</option>
              </select>
            </div>

            <div
              key={notaAtual.id}
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => atualizarNota("conteudo", e.currentTarget.innerHTML)}
              className="flex-1 rounded-xl border px-4 py-3 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none focus:border-cyan-500 overflow-y-auto leading-relaxed"
              dangerouslySetInnerHTML={{ __html: htmlSeguro(notaAtual.conteudo) }}
            />
            <p className="text-xs text-slate-500">
              Dica: use a barra acima para formatar texto e deixar suas anotações mais visuais.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Anotacoes;
