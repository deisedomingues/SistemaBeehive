import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

/* =====================================================
   1) ACESSO
===================================================== */

await exigirAdmin();

/* =====================================================
   2) ELEMENTOS
===================================================== */

const btnSair =
  document.getElementById(
    "btnSair"
  );

const badgeNotificacoesPedagogico =
  document.getElementById(
    "badgeNotificacoesPedagogico"
  );

const textoCardNotificacoesPedagogico =
  document.getElementById(
    "textoCardNotificacoesPedagogico"
  );

/* =====================================================
   3) CHAVE DE NOTIFICAÇÕES VISTAS
===================================================== */

const CHAVE_VISTOS_PEDAGOGICO =
  "beehive_notificacoes_pedagogico_vistas";

/* =====================================================
   4) CARREGAR IDS JÁ VISTOS
===================================================== */

function carregarIdsVistosPedagogico() {
  try {
    const salvos =
      JSON.parse(
        localStorage.getItem(
          CHAVE_VISTOS_PEDAGOGICO
        ) || "[]"
      );

    return new Set(
      (salvos || []).map(
        id =>
          String(id)
      )
    );

  } catch (error) {
    console.warn(
      "Não foi possível carregar notificações vistas do pedagógico:",
      error
    );

    return new Set();
  }
}

/* =====================================================
   5) VERIFICAR SE O AVISO JÁ FOI VISTO
===================================================== */

function avisoJaVistoPedagogico(
  avisoId
) {
  const vistos =
    carregarIdsVistosPedagogico();

  return vistos.has(
    `ausencia_${avisoId}`
  );
}

/* =====================================================
   6) ATUALIZAR BADGE
===================================================== */

function atualizarBadgeNotificacoesPedagogico(
  total
) {
  if (
    !badgeNotificacoesPedagogico
  ) {
    return;
  }

  const quantidade =
    Number(total || 0);

  if (
    quantidade > 0
  ) {
    badgeNotificacoesPedagogico.textContent =
      quantidade > 99
        ? "99+"
        : String(quantidade);

    badgeNotificacoesPedagogico.style.display =
      "inline-flex";

    return;
  }

  badgeNotificacoesPedagogico.textContent =
    "0";

  badgeNotificacoesPedagogico.style.display =
    "none";
}

/* =====================================================
   7) BUSCAR AVISOS DE AUSÊNCIA
===================================================== */

async function buscarAvisosAusenciaPedagogico() {
  const {
    data,
    error
  } =
    await supabase
      .from(
        "aviso_ausencia"
      )
      .select(`
        id,
        aluno_id,
        matricula_id,
        horario_aula_id,
        professor_id,
        data_aula,
        hora_inicio,
        hora_fim,
        justificativa,
        tipo_solicitacao,
        dentro_prazo_reposicao,
        antecedencia_minutos,
        status,
        criado_em
      `)
      .eq(
        "status",
        "pendente"
      )
      .order(
        "criado_em",
        {
          ascending: false
        }
      );

  if (error) {
    console.error(
      "Erro ao buscar avisos de ausência:",
      error
    );

    throw error;
  }

  return data || [];
}

/* =====================================================
   8) CONTAR NOVOS AVISOS
===================================================== */

async function contarNovosAvisosAusencia() {
  const avisos =
    await buscarAvisosAusenciaPedagogico();

  if (!avisos.length) {
    return 0;
  }

  const novos =
    avisos.filter(
      aviso =>
        !avisoJaVistoPedagogico(
          aviso.id
        )
    );

  return novos.length;
}

/* =====================================================
   9) CARREGAR RESUMO DO CARD
===================================================== */

async function carregarResumoNotificacoesPedagogico() {
  if (
    !textoCardNotificacoesPedagogico
  ) {
    return;
  }

  try {
    const totalNovos =
      await contarNovosAvisosAusencia();

    atualizarBadgeNotificacoesPedagogico(
      totalNovos
    );

    if (
      totalNovos === 0
    ) {
      textoCardNotificacoesPedagogico.textContent =
        "Nenhuma nova notificação. Avisos de ausência dos alunos aparecerão aqui.";

      return;
    }

    if (
      totalNovos === 1
    ) {
      textoCardNotificacoesPedagogico.textContent =
        "Você tem 1 novo aviso de ausência para verificar.";

      return;
    }

    textoCardNotificacoesPedagogico.textContent =
      `Você tem ${totalNovos} novos avisos de ausência para verificar.`;

  } catch (error) {
    console.error(
      "Erro ao carregar notificações do pedagógico:",
      error
    );

    atualizarBadgeNotificacoesPedagogico(
      0
    );

    textoCardNotificacoesPedagogico.textContent =
      "Não foi possível carregar as notificações no momento.";
  }
}

/* =====================================================
   10) SAIR
===================================================== */

if (btnSair) {
  btnSair.addEventListener(
    "click",
    async () => {
      try {
        await supabase.auth.signOut();

        localStorage.removeItem(
          "role"
        );

        localStorage.removeItem(
          "professorId"
        );

        localStorage.removeItem(
          "professorNome"
        );

        localStorage.removeItem(
          "professorEmail"
        );

        localStorage.removeItem(
          "matriculaSelecionada"
        );

        localStorage.removeItem(
          "alunoIdVisualizacao"
        );

        window.location.href =
          "index.html";

      } catch (error) {
        console.error(
          "Erro ao sair:",
          error
        );

        alert(
          "Não foi possível sair neste momento."
        );
      }
    }
  );
}

/* =====================================================
   11) INICIAR
===================================================== */

await carregarResumoNotificacoesPedagogico();