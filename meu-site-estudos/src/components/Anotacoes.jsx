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
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Link as LinkIcon,
  Type,
  Heading1,
  Heading2,
} from "lucide-react";

const textoInicial = `<h1>Bem-vindo(a)!</h1>
<p>Use este espaço como um Notion pessoal para organizar seus estudos.</p>
<ul>
  <li>Crie cadernos por matéria</li>
  <li>Separe notas por tema</li>
  <li>Monte checklists com [ ] tarefas</li>
</ul>`;

const criarId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const criarCadernoInicial = () => ({
  id: criarId(),
  titulo: "Meu caderno",
  notas: [
    {
      id: criarId(),
      titulo: "Primeira anotação",
      conteudo: textoInicial,
      atualizadoEm: new Date().toISOString(),
    },
  ],
});

const htmlSeguro = (conteudo = "") => {
  const texto = String(conteudo ?? "").trim();
  if (!texto) return "";
  if (/<\/?[a-z][\s\S]*>/i.test(texto)) return texto;

  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
};

function normalizarCadernos(raw) {
  const lista = Array.isArray(raw) ? raw : [];
  return lista
    .filter(Boolean)
    .map((c, idx) => ({
      id: c?.id || criarId(),
      titulo: String(c?.titulo || `Caderno ${idx + 1}`),
      notas: Array.isArray(c?.notas)
        ? c.notas
          .filter(Boolean)
          .map((n, jdx) => ({
            id: n?.id || criarId(),
            titulo: String(n?.titulo || `Nota ${jdx + 1}`),
            conteudo: String(n?.conteudo ?? ""),
            atualizadoEm: n?.atualizadoEm || new Date().toISOString(),
          }))
        : [],
    }));
}

const enableCss = () => {
  try {
    document.execCommand("styleWithCSS", false, true);
  } catch { }
};

const mapPxToExecSize = (px) => {
  const n = Number(px);
  if (n <= 12) return 2;
  if (n <= 14) return 3;
  if (n <= 16) return 4;
  if (n <= 18) return 4;
  if (n <= 24) return 5;
  if (n <= 32) return 6;
  return 7;
};

function Anotacoes({ user }) {
  const userId = user?.id;

  const storageKey = useMemo(() => {
    return userId ? `planner-anotacoes-${userId}` : null;
  }, [userId]);

  const [cadernos, setCadernos] = useState([]);
  const [cadernoId, setCadernoId] = useState("");
  const [notaId, setNotaId] = useState("");
  const [tamanhoFonte, setTamanhoFonte] = useState("16");

  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);

  const cadernoAtual = useMemo(
    () => cadernos.find((c) => c.id === cadernoId),
    [cadernos, cadernoId]
  );

  const notaAtual = useMemo(
    () => cadernoAtual?.notas?.find((n) => n.id === notaId),
    [cadernoAtual, notaId]
  );

  const saveSelection = () => {
    const el = editorRef.current;
    if (!el) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    // só salva se a seleção estiver dentro do editor
    if (!el.contains(range.commonAncestorContainer)) return;
    savedRangeRef.current = range.cloneRange();
  };

  const restoreSelection = () => {
    const el = editorRef.current;
    const sel = window.getSelection();
    const range = savedRangeRef.current;
    if (!el || !sel || !range) return;

    // se o range não estiver mais dentro do editor, ignora
    if (!el.contains(range.commonAncestorContainer)) return;

    sel.removeAllRanges();
    sel.addRange(range);
  };

  const focusEditor = () => editorRef.current?.focus();

  const persist = () => {
    if (!notaAtual) return;
    atualizarNota("conteudo", editorRef.current?.innerHTML || "");
  };

  // Exec seguro: restaura seleção, aplica comando, persiste HTML
  const exec = (command, value = null) => {
    if (!notaAtual) return;
    focusEditor();
    restoreSelection();
    enableCss();

    try {
      document.execCommand(command, false, value);
    } catch (err) {
      console.error("execCommand falhou:", command, err);
    }

    // Atualiza seleção depois da ação
    saveSelection();
    persist();
  };

  // Fallback para título/subtítulo quando formatBlock não pega
  const fallbackFormatBlock = (tag) => {
    const el = editorRef.current;
    if (!el) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    let node = range.startContainer;

    // sobe até achar um bloco dentro do editor
    const isBlock = (n) =>
      n &&
      n.nodeType === 1 &&
      ["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "BLOCKQUOTE"].includes(
        n.tagName
      );

    while (node && node !== el && !isBlock(node)) {
      node = node.parentNode;
    }

    // se não achou bloco, envolve a seleção num bloco simples
    if (!node || node === el) {
      const wrapper = document.createElement(tag);
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);

      // move cursor pro fim
      const newRange = document.createRange();
      newRange.selectNodeContents(wrapper);
      newRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(newRange);

      saveSelection();
      persist();
      return;
    }

    // troca a tag mantendo o conteúdo
    const newEl = document.createElement(tag);
    newEl.innerHTML = node.innerHTML;
    node.replaceWith(newEl);

    // recoloca cursor no fim do novo bloco
    const newRange = document.createRange();
    newRange.selectNodeContents(newEl);
    newRange.collapse(false);
    sel.removeAllRanges();
    sel.addRange(newRange);

    saveSelection();
    persist();
  };

  const aplicarBloco = (tag) => {
    if (!notaAtual) return;
    focusEditor();
    restoreSelection();
    enableCss();

    let ok = false;
    try {
      // muitos browsers precisam do "<h1>" (com <>)
      ok = document.execCommand("formatBlock", false, `<${tag}>`);
    } catch {
      ok = false;
    }

    // se não funcionou, usa fallback DOM
    if (!ok) {
      fallbackFormatBlock(tag);
      return;
    }

    saveSelection();
    persist();
  };

  const aplicarTamanhoFontePx = (px) => {
    if (!notaAtual) return;
    focusEditor();
    restoreSelection();
    enableCss();

    const size = mapPxToExecSize(px);

    try {
      document.execCommand("fontSize", false, String(size));
    } catch (err) {
      console.error("fontSize falhou:", err);
    }

    // converte <font size="x"> em <span style="font-size: ...px">
    const el = editorRef.current;
    if (!el) return;

    el.querySelectorAll("font[size]").forEach((font) => {
      const span = document.createElement("span");
      span.style.fontSize = `${px}px`;
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });

    saveSelection();
    persist();
  };

  const inserirLink = () => {
    if (!notaAtual) return;

    // garante que a seleção está salva antes do prompt
    saveSelection();

    const url = window.prompt("Cole o link (https://...):")?.trim();
    if (!url) return;

    // cria link na seleção
    exec("createLink", url);

    // força estilo Word/Docs (azul + underline) e abre em nova aba
    const el = editorRef.current;
    if (!el) return;

    // pega o link mais recente (ou o href igual)
    const links = [...el.querySelectorAll(`a[href="${url}"]`)];
    const a = links[links.length - 1];
    if (a) {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      a.style.color = "#2563eb"; // azul (Tailwind blue-600)
      a.style.textDecoration = "underline";
    }

    saveSelection();
    persist();
  };

  // ======= CARREGAR =======
  useEffect(() => {
    if (!storageKey) return;

    const inicial = [criarCadernoInicial()];
    const salvarInicial = () => {
      setCadernos(inicial);
      setCadernoId(inicial[0].id);
      setNotaId(inicial[0].notas[0].id);
    };

    const salvo = localStorage.getItem(storageKey);
    if (!salvo) {
      salvarInicial();
      return;
    }

    try {
      const parsed = JSON.parse(salvo);
      const dados = normalizarCadernos(parsed);

      if (!dados.length) {
        salvarInicial();
        return;
      }

      setCadernos(dados);
      setCadernoId(dados[0]?.id || "");
      setNotaId(dados[0]?.notas?.[0]?.id || "");
    } catch (err) {
      console.error("Erro ao ler notas do localStorage:", err);
      localStorage.removeItem(storageKey);
      salvarInicial();
    }
  }, [storageKey]);

  // ======= SALVAR =======
  useEffect(() => {
    if (!storageKey) return;
    if (!cadernos.length) return;
    localStorage.setItem(storageKey, JSON.stringify(cadernos));
  }, [cadernos, storageKey]);

  // ✅ Carrega HTML no editor só quando troca de nota
  useEffect(() => {
    if (!notaAtual) return;
    if (!editorRef.current) return;

    editorRef.current.innerHTML = htmlSeguro(notaAtual.conteudo);

    // coloca cursor no fim ao abrir nota
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();

      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
      saveSelection();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notaAtual?.id]);

  const criarCaderno = () => {
    const novo = { id: criarId(), titulo: `Novo caderno ${cadernos.length + 1}`, notas: [] };
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
      `Excluir o caderno "${cadernoAtual.titulo}" e todas as notas dele?`
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
      id: criarId(),
      titulo: `Nova nota ${(cadernoAtual.notas || []).length + 1}`,
      conteudo: "",
      atualizadoEm: new Date().toISOString(),
    };

    setCadernos((prev) =>
      prev.map((c) =>
        c.id === cadernoAtual.id ? { ...c, notas: [nova, ...(c.notas || [])] } : c
      )
    );
    setNotaId(nova.id);

    requestAnimationFrame(() => {
      if (editorRef.current) editorRef.current.innerHTML = "";
      editorRef.current?.focus();
      saveSelection();
    });
  };

  const atualizarNota = (campo, valor) => {
    if (!cadernoAtual || !notaAtual) return;

    setCadernos((prev) =>
      prev.map((c) => {
        if (c.id !== cadernoAtual.id) return c;
        return {
          ...c,
          notas: (c.notas || []).map((n) =>
            n.id === notaAtual.id
              ? { ...n, [campo]: valor, atualizadoEm: new Date().toISOString() }
              : n
          ),
        };
      })
    );
  };

  const excluirNota = () => {
    if (!cadernoAtual || !notaAtual) return;

    const restantes = (cadernoAtual.notas || []).filter((n) => n.id !== notaAtual.id);
    setCadernos((prev) =>
      prev.map((c) => (c.id === cadernoAtual.id ? { ...c, notas: restantes } : c))
    );
    setNotaId(restantes[0]?.id || "");

    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      editorRef.current.innerHTML = htmlSeguro(restantes[0]?.conteudo || "");
      editorRef.current.focus();
      saveSelection();
    });
  };

  // helper: toolbar não pode roubar foco/seleção
  const tbMouseDown = (e) => {
    saveSelection(); // salva antes de qualquer clique
    e.preventDefault(); // mantém foco no editor
  };

  if (!userId) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900 text-slate-500 text-sm">
        Carregando anotações...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[230px_270px_1fr] gap-4 h-[65vh]">
      {/* CADERNOS */}
      <aside className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Cadernos</h3>
          <div className="flex items-center gap-1">
            <button
              onMouseDown={tbMouseDown}
              onClick={editarCaderno}
              disabled={!cadernoAtual}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-40"
              title="Renomear caderno"
            >
              <Pencil size={16} />
            </button>
            <button
              onMouseDown={tbMouseDown}
              onClick={excluirCaderno}
              disabled={!cadernoAtual}
              className="p-2 rounded-lg hover:bg-red-100 text-red-500 dark:hover:bg-red-900/20 cursor-pointer disabled:opacity-40"
              title="Excluir caderno"
            >
              <Trash2 size={16} />
            </button>
            <button
              onMouseDown={tbMouseDown}
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
              className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer ${cadernoId === c.id
                  ? "bg-cyan-600 text-white"
                  : "hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              onClick={() => {
                setCadernoId(c.id);
                setNotaId((c.notas || [])[0]?.id || "");
              }}
            >
              <p className="font-medium truncate">{c.titulo}</p>
              <p className="text-xs opacity-75">{(c.notas || []).length} nota(s)</p>
            </button>
          ))}
        </div>
      </aside>

      {/* NOTAS */}
      <aside className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/40">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Notas</h3>
          <button
            onMouseDown={tbMouseDown}
            onClick={criarNota}
            disabled={!cadernoAtual}
            className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700 cursor-pointer"
            title="Nova nota"
          >
            <FilePlus2 size={18} />
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-[56vh] pr-1">
          {cadernoAtual?.notas?.map((n) => (
            <button
              key={n.id}
              onClick={() => setNotaId(n.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer ${notaId === n.id
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
          {!cadernoAtual?.notas?.length && (
            <p className="text-sm text-slate-500">Crie a primeira nota deste caderno.</p>
          )}
        </div>
      </aside>

      {/* EDITOR */}
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
                onMouseDown={tbMouseDown}
                onClick={excluirNota}
                className="px-3 rounded-xl border border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                title="Excluir nota"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* TOOLBAR */}
            <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
              {/* Estilos (substitui o select, porque select costuma quebrar seleção) */}
              <button
                onMouseDown={tbMouseDown}
                onClick={() => aplicarBloco("p")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Texto"
              >
                <Type size={16} />
              </button>
              <button
                onMouseDown={tbMouseDown}
                onClick={() => aplicarBloco("h1")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Título"
              >
                <Heading1 size={16} />
              </button>
              <button
                onMouseDown={tbMouseDown}
                onClick={() => aplicarBloco("h2")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Subtítulo"
              >
                <Heading2 size={16} />
              </button>

              <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />

              <button
                onMouseDown={tbMouseDown}
                onClick={() => exec("bold")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Negrito"
              >
                <Bold size={16} />
              </button>
              <button
                onMouseDown={tbMouseDown}
                onClick={() => exec("italic")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Itálico"
              >
                <Italic size={16} />
              </button>
              <button
                onMouseDown={tbMouseDown}
                onClick={() => exec("underline")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Sublinhado"
              >
                <Underline size={16} />
              </button>
              <button
                onMouseDown={tbMouseDown}
                onClick={() => exec("hiliteColor", "#fef08a")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Grifado"
              >
                <Highlighter size={16} />
              </button>

              <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />

              <button
                onMouseDown={tbMouseDown}
                onClick={() => exec("insertUnorderedList")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Lista"
              >
                <List size={16} />
              </button>
              <button
                onMouseDown={tbMouseDown}
                onClick={() => exec("insertOrderedList")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Lista numerada"
              >
                <ListOrdered size={16} />
              </button>

              <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />

              <button
                onMouseDown={tbMouseDown}
                onClick={inserirLink}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Inserir link"
              >
                <LinkIcon size={16} />
              </button>

              <button
                onMouseDown={tbMouseDown}
                onClick={() => exec("undo")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Desfazer"
              >
                <Undo2 size={16} />
              </button>
              <button
                onMouseDown={tbMouseDown}
                onClick={() => exec("redo")}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Refazer"
              >
                <Redo2 size={16} />
              </button>

              <div className="flex items-center gap-2 ml-1">
                <span className="text-xs text-slate-500">Fonte:</span>
                <select
                  onMouseDown={tbMouseDown}
                  value={tamanhoFonte}
                  onChange={(e) => {
                    setTamanhoFonte(e.target.value);
                    aplicarTamanhoFontePx(e.target.value);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
                  title="Tamanho da fonte"
                >
                  <option value="12">12</option>
                  <option value="14">14</option>
                  <option value="16">16</option>
                  <option value="18">18</option>
                  <option value="24">24</option>
                  <option value="32">32</option>
                </select>
              </div>
            </div>

            {/* EDITOR */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => atualizarNota("conteudo", e.currentTarget.innerHTML)}
              onKeyUp={saveSelection}
              onMouseUp={saveSelection}
              onBlur={saveSelection}
              onFocus={saveSelection}
              onClick={(e) => {
                // ✅ Link clicável com clique normal:
                // se clicar num <a>, abre em nova aba e impede editar naquele clique
                const a = e.target.closest?.("a");
                if (a && a.href) {
                  e.preventDefault();
                  window.open(a.href, "_blank", "noopener,noreferrer");
                }
              }}
              className={[
                "flex-1 rounded-xl border px-4 py-3 bg-slate-50 dark:bg-slate-800",
                "border-slate-200 dark:border-slate-700 outline-none focus:border-cyan-500",
                "overflow-y-auto leading-relaxed",
                // ✅ deixa links com “cara de Word/Docs”
                "[&_a]:text-blue-600 dark:[&_a]:text-blue-400 [&_a]:underline",
                // melhora leitura dos headings
                "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-2",
                "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:my-2",
                "[&_p]:my-1",
                "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
              ].join(" ")}
              style={{ direction: "ltr", textAlign: "left" }}
            />

            <p className="text-xs text-slate-500">
              Dica: selecione um trecho e clique nos botões. Links ficam azuis e sublinhados e abrem com clique.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default Anotacoes;