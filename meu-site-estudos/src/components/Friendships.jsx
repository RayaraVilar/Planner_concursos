import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function Friendships() {
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [myInviteCode, setMyInviteCode] = useState("");
  const [myName, setMyName] = useState("");
  const [myUserId, setMyUserId] = useState(null);

  const [pendingRequests, setPendingRequests] = useState([]);
  const [ranking, setRanking] = useState([]);

  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingRanking, setLoadingRanking] = useState(false);

  const medalha = (pos) => {
    if (pos === 1) return "🥇";
    if (pos === 2) return "🥈";
    if (pos === 3) return "🥉";
    return `#${pos}`;
  };

  const loadMyInviteCode = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw new Error("Não logado");

    setMyUserId(user.id);

    // Busca perfil
    let { data, error } = await supabase
      .from("perfis")
      .select("invite_code, nome")
      .eq("id", user.id)
      .single();

    // Se não existir, tenta UPSERT (fallback seguro)
    if (
      error &&
      (error.code === "PGRST116" ||
        String(error.message || "").includes("0 rows"))
    ) {
      const { error: upErr } = await supabase.from("perfis").upsert(
        {
          id: user.id,
          nome: user.user_metadata?.name ?? user.email ?? null,
        },
        { onConflict: "id" }
      );

      if (upErr) throw upErr;

      const res = await supabase
        .from("perfis")
        .select("invite_code, nome")
        .eq("id", user.id)
        .single();

      data = res.data;
      error = res.error;
    }

    if (error) throw error;

    setMyInviteCode(data?.invite_code ?? "");
    setMyName(data?.nome ?? "");
  };

  // ✅ VIEW que traz requester_nome
  const loadIncomingRequests = async () => {
    setLoadingPending(true);

    const { data, error } = await supabase
      .from("v_incoming_friend_requests")
      .select("id, requester_id, requester_nome, status, created_at");

    setLoadingPending(false);

    if (error) throw error;

    setPendingRequests(data ?? []);
  };

  // ✅ Ranking: inclui você + ordena + empate com mesma posição/medalha
  const loadFriendsRanking = async () => {
    setLoadingRanking(true);

    try {
      // 1) ranking de amigos (view)
      const { data: friendsRank, error: friendsErr } = await supabase
        .from("v_friend_ranking")
        .select("user_id, nome, level, title, xp_total");

      if (friendsErr) throw friendsErr;

      // 2) buscar seus dados (tentando pegar xp/level/title do perfis, se existir)
      let meRow = null;

      if (myUserId) {
        const { data: meProfile, error: meErr } = await supabase
          .from("perfis")
          .select("id, nome, level, title, xp_total")
          .eq("id", myUserId)
          .single();

        if (!meErr && meProfile) {
          meRow = {
            user_id: meProfile.id,
            nome: meProfile.nome ?? myName ?? "-",
            level: meProfile.level ?? null,
            title: meProfile.title ?? null,
            xp_total: meProfile.xp_total ?? 0,
          };
        }
      }

      // 3) fallback do "eu" caso não tenha vindo do banco
      if (!meRow && myUserId) {
        meRow = {
          user_id: myUserId,
          nome: myName || "(você)",
          level: null,
          title: null,
          xp_total: 0,
        };
      }

      // 4) merge sem duplicar (Map por user_id)
      const map = new Map();
      (friendsRank ?? []).forEach((r) => {
        if (!r?.user_id) return;
        map.set(r.user_id, r);
      });
      if (meRow?.user_id) map.set(meRow.user_id, meRow);

      const merged = Array.from(map.values());

      // 5) ordenar (xp_total desc) + desempate por nome
      merged.sort((a, b) => {
        const ax = Number(a?.xp_total ?? 0);
        const bx = Number(b?.xp_total ?? 0);
        if (bx !== ax) return bx - ax;

        const an = String(a?.nome ?? "");
        const bn = String(b?.nome ?? "");
        return an.localeCompare(bn, "pt-BR");
      });

      setRanking(merged);
    } finally {
      setLoadingRanking(false);
    }
  };

  const sendFriendRequestByCode = async (inviteCode) => {
    const code = inviteCode.trim().toUpperCase().replace(/\s+/g, "");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) throw new Error("Não logado");

    // ✅ RPC segura
    const { data: friendId, error: rpcErr } = await supabase.rpc(
      "resolve_invite_code",
      { code }
    );

    if (rpcErr || !friendId) throw new Error("Código inválido.");

    if (friendId === user.id) {
      throw new Error("Você não pode adicionar você mesma.");
    }

    const { error: insErr } = await supabase.from("friendships").insert({
      requester_id: user.id,
      addressee_id: friendId,
      status: "pending",
    });

    if (insErr) throw new Error(insErr.message);

    return true;
  };

  const acceptRequest = async (requestId) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", requestId);

    if (error) throw error;

    return true;
  };

  // ✅ bootstrap resiliente
  const bootstrap = async () => {
    try {
      await loadMyInviteCode();
    } catch (error) {
      alert(error.message || "Erro ao carregar seu perfil.");
    }

    try {
      await loadIncomingRequests();
    } catch (error) {
      alert(error.message || "Erro ao carregar solicitações.");
    }

    try {
      await loadFriendsRanking();
    } catch (error) {
      alert(error.message || "Erro ao carregar ranking.");
    }
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // garante "eu" incluso quando myUserId chega
  useEffect(() => {
    if (myUserId) loadFriendsRanking().catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUserId, myName]);

  const enviarPedido = async (e) => {
    e.preventDefault();
    try {
      await sendFriendRequestByCode(inviteCodeInput);
      setInviteCodeInput("");
      alert("Convite enviado com sucesso.");
      await loadIncomingRequests();
    } catch (error) {
      alert(error.message || "Não foi possível enviar o convite.");
    }
  };

  const aceitarPedido = async (requestId) => {
    try {
      await acceptRequest(requestId);
      alert("Pedido aceito!");
      await Promise.all([loadIncomingRequests(), loadFriendsRanking()]);
    } catch (error) {
      alert(error.message || "Não foi possível aceitar o pedido.");
    }
  };

  // ✅ Ranking com empate (posição densa):
  // Ex: 1000, 1000, 900 => posições 1,1,2
  const rankingComEmpate = useMemo(() => {
    let lastXp = null;
    let currentPosition = 0;

    return (ranking ?? []).map((item, index) => {
      const xp = Number(item?.xp_total ?? 0);

      if (lastXp === null || xp !== lastXp) {
        currentPosition = index + 1; // posição baseada no índice, mas só muda quando XP muda
        lastXp = xp;
      }

      return {
        ...item,
        posicao: currentPosition,
      };
    });
  }, [ranking]);

  return (
    <div className="space-y-8">
      {/* Adicionar amigo */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950/40">
        <h2 className="text-xl font-bold mb-1">Adicionar amigo</h2>
        <p className="text-sm text-slate-500 mb-4">
          Seu código: <strong>{myInviteCode || "-"}</strong>
          {myName ? ` (${myName})` : ""}
        </p>

        <form onSubmit={enviarPedido} className="flex flex-col sm:flex-row gap-3">
          <input
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value)}
            placeholder="Digite o código do amigo"
            className="flex-1 p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-cyan-500"
            required
          />
          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold cursor-pointer"
          >
            Enviar convite
          </button>
        </form>
      </section>

      {/* Solicitações pendentes */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950/40">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Solicitações pendentes</h2>
          <button
            onClick={loadIncomingRequests}
            className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
          >
            Atualizar
          </button>
        </div>

        {loadingPending ? (
          <p className="text-slate-500">Carregando...</p>
        ) : pendingRequests.length === 0 ? (
          <p className="text-slate-500">Nenhuma solicitação pendente.</p>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">
                    Solicitante: {request.requester_nome ?? request.requester_id}
                  </p>
                  <p className="text-sm text-slate-500">
                    {new Date(request.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => aceitarPedido(request.id)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
                >
                  Aceitar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ranking */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950/40">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Ranking</h2>
          <button
            onClick={loadFriendsRanking}
            className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
          >
            Atualizar
          </button>
        </div>

        {loadingRanking ? (
          <p className="text-slate-500">Carregando...</p>
        ) : rankingComEmpate.length === 0 ? (
          <p className="text-slate-500">Sem dados no ranking ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-sm text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <th className="py-2 pr-4 font-semibold">Posição</th>
                  <th className="py-2 pr-4 font-semibold">Nome</th>
                  <th className="py-2 pr-4 font-semibold">XP Total</th>
                  <th className="py-2 pr-4 font-semibold">Level</th>
                  <th className="py-2 pr-4 font-semibold">Título</th>
                </tr>
              </thead>
              <tbody>
                {rankingComEmpate.map((row) => {
                  const isMe = myUserId && row.user_id === myUserId;

                  return (
                    <tr
                      key={row.user_id}
                      className={[
                        "border-b border-slate-100 dark:border-slate-900",
                        isMe
                          ? "bg-cyan-50 dark:bg-cyan-950/30 ring-1 ring-cyan-200/70 dark:ring-cyan-900/50"
                          : "",
                      ].join(" ")}
                    >
                      <td className="py-2 pr-4 text-sm font-semibold">
                        {medalha(row.posicao)}
                      </td>
                      <td className="py-2 pr-4 text-sm font-medium">
                        {row.nome ?? "-"}{" "}
                        {isMe ? (
                          <span className="text-cyan-700 dark:text-cyan-300 font-semibold">
                            (você)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-sm">{row.xp_total ?? 0}</td>
                      <td className="py-2 pr-4 text-sm">{row.level ?? "-"}</td>
                      <td className="py-2 pr-4 text-sm">{row.title ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Friendships;