import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const btnSair = document.getElementById("btnSair");

const linkReposicoesAdmin = document.getElementById("linkReposicoesAdmin");
const badgeReposicoes = document.getElementById("badgeReposicoes");
const textoBadgeReposicoes = document.getElementById("textoBadgeReposicoes");

// =============================
// Sair
// =============================
if (btnSair) {
  btnSair.addEventListener("click", async () => {
    try {
      await supabase.auth.signOut();

      localStorage.removeItem("role");
      localStorage.removeItem("professorId");
      localStorage.removeItem("professorNome");
      localStorage.removeItem("professorEmail");
      localStorage.removeItem("alunoId");
      localStorage.removeItem("alunoNome");
      localStorage.removeItem("alunoEmail");
      localStorage.removeItem("matriculaSelecionadaId");
      localStorage.removeItem("materiaSelecionadaId");
      localStorage.removeItem("moduloSelecionadoId");
      localStorage.removeItem("professorSelecionadoId");
      localStorage.removeItem("nomeCursoSelecionado");

      window.location.href = "index.html";
    } catch (error) {
      console.error("Erro ao sair:", error);
      alert("Não foi possível sair neste momento.");
    }
  });
}

// =============================
// Badge visual
// =============================
function atualizarBadgeReposicoes(quantidade) {
  if (!badgeReposicoes || !textoBadgeReposicoes) return;

  const total = Number(quantidade || 0);

  if (total <= 0) {
    badgeReposicoes.style.display = "none";
    textoBadgeReposicoes.style.display = "none";
    badgeReposicoes.textContent = "0";
    return;
  }

  badgeReposicoes.style.display = "inline-flex";
  textoBadgeReposicoes.style.display = "inline";

  badgeReposicoes.textContent = total > 99 ? "99+" : String(total);

  textoBadgeReposicoes.textContent =
    total === 1
      ? "• 1 nova reposição"
      : `• ${total} novas reposições`;
}

// =============================
// Contar somente reposições novas
// =============================
async function carregarNotificacaoReposicoes() {
  try {
    const { count, error } = await supabase
      .from("reposicao_agendada")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("cancelado", false)
      .eq("visualizado_admin", false);

    if (error) {
      console.error("Erro ao contar novas reposições:", error);
      atualizarBadgeReposicoes(0);
      return;
    }

    atualizarBadgeReposicoes(count || 0);

  } catch (error) {
    console.error("Erro geral ao carregar notificação de reposições:", error);
    atualizarBadgeReposicoes(0);
  }
}

// =============================
// Marcar como visualizadas
// =============================
async function marcarReposicoesComoVisualizadas() {
  const { error } = await supabase
    .from("reposicao_agendada")
    .update({ visualizado_admin: true })
    .eq("cancelado", false)
    .eq("visualizado_admin", false);

  if (error) {
    console.error("Erro ao marcar reposições como visualizadas:", error);
    throw error;
  }
}

// =============================
// Clique no card Reposições
// =============================
if (linkReposicoesAdmin) {
  linkReposicoesAdmin.addEventListener("click", async (e) => {
    e.preventDefault();

    try {
      await marcarReposicoesComoVisualizadas();
      atualizarBadgeReposicoes(0);
    } catch (error) {
      console.error("Não foi possível limpar a notificação:", error);
    }

    window.location.href = "reposicoes.html";
  });
}

// =============================
// Realtime
// Se outro aluno agendar depois,
// a bandeirinha aparece de novo.
// =============================
function ativarRealtimeReposicoes() {
  try {
    supabase
      .channel("notificacao-reposicoes-admin")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reposicao_agendada"
        },
        async () => {
          await carregarNotificacaoReposicoes();
        }
      )
      .subscribe();

  } catch (error) {
    console.error("Erro ao ativar realtime de reposições:", error);
  }
}

// =============================
// Iniciar
// =============================
carregarNotificacaoReposicoes();
ativarRealtimeReposicoes();