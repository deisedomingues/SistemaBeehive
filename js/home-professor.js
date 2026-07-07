import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

const btnSair = document.getElementById("btnSair");
const saudacao = document.getElementById("saudacao");
const tituloProfessor = document.getElementById("tituloProfessor");

const selectPerfilVisualizacao = document.getElementById("selectPerfilVisualizacao");
const btnAbrirPerfil = document.getElementById("btnAbrirPerfil");
const painelProfessorCards = document.getElementById("painelProfessorCards");
const optionAluno = document.getElementById("optionAluno");
const infoPerfilAluno = document.getElementById("infoPerfilAluno");

const badgeNotificacoesProfessor = document.getElementById("badgeNotificacoesProfessor");
const textoCardNotificacoesProfessor = document.getElementById("textoCardNotificacoesProfessor");

const professorId = Number(localStorage.getItem("professorId"));

let professorLogado = null;
let alunoVinculado = null;

if (!professorId) {
  window.location.href = "index.html";
}

/* ======================
   Mensagem simples
====================== */
function mostrarInfoPerfilAluno(texto, tipo = "neutro") {
  if (!infoPerfilAluno) return;

  infoPerfilAluno.textContent = texto;

  if (tipo === "ok") {
    infoPerfilAluno.style.color = "#1b5e20";
  } else if (tipo === "erro") {
    infoPerfilAluno.style.color = "#b71c1c";
  } else {
    infoPerfilAluno.style.color = "";
  }
}

/* ======================
   Badge de notificações
====================== */
function atualizarBadgeNotificacoes(total) {
  if (!badgeNotificacoesProfessor) return;

  if (total > 0) {
    badgeNotificacoesProfessor.textContent = total > 99 ? "99+" : String(total);
    badgeNotificacoesProfessor.style.display = "inline-flex";
  } else {
    badgeNotificacoesProfessor.textContent = "0";
    badgeNotificacoesProfessor.style.display = "none";
  }
}

/* ======================
   Configurações das notificações

   Importante:
   Esta chave precisa ser igual à usada em notificacao-professor.js.
====================== */
const STATUS_NOTIFICACAO_HOME = {
  REPOSICAO: "Reposição",
  AULA_INSTRUMENTAL: "Aula Instrumental",
  PLANTAO_DUVIDAS: "Plantão de dúvidas"
};

const CHAVE_NOTIFICACOES_VISTAS_HOME =
  `beehive_notificacoes_professor_vistas_${professorId}`;

/* ======================
   Vistos locais da home
====================== */
function carregarNotificacoesVistasHome() {
  try {
    const salvas = JSON.parse(
      localStorage.getItem(CHAVE_NOTIFICACOES_VISTAS_HOME) || "[]"
    );

    return new Set((salvas || []).map((id) => String(id)));
  } catch (error) {
    console.warn("Não foi possível ler notificações vistas da home:", error);
    return new Set();
  }
}

function notificacaoJaVistaHome(notificacaoId) {
  return carregarNotificacoesVistasHome().has(String(notificacaoId));
}

/* ======================
   Datas
====================== */
function hojeISOHome() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function dataMenosDiasISOHome(dias) {
  const data = new Date();
  data.setDate(data.getDate() - dias);

  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

/* ======================
   Agendamentos novos

   Conta:
   - reposição;
   - plantão de dúvidas;
   - aula instrumental.

   Só conta se ainda não foi marcado como visto.
====================== */
async function buscarTotalAgendamentosNovosProfessorHome() {
  const dataInicial = dataMenosDiasISOHome(120);
  const hoje = hojeISOHome();

  const { data: horarios, error: errorHorarios } = await supabase
    .from("horarios_reposicao")
    .select("id, data, hora_inicio, professor_id")
    .eq("professor_id", professorId)
    .gte("data", dataInicial);

  if (errorHorarios) {
    console.error("Erro ao buscar horários do professor:", errorHorarios);
    throw errorHorarios;
  }

  const listaHorarios = horarios || [];

  if (!listaHorarios.length) {
    return 0;
  }

  const mapaHorarios = new Map(
    listaHorarios.map((horario) => [Number(horario.id), horario])
  );

  const horariosIds = listaHorarios.map((horario) => Number(horario.id));

  const { data: agendamentos, error: errorAgendamentos } = await supabase
    .from("reposicao_agendada")
    .select(`
      id,
      aula_id,
      horario_reposicao_id,
      matricula_id,
      cancelado,
      tipo_agendamento
    `)
    .in("horario_reposicao_id", horariosIds)
    .eq("cancelado", false);

  if (errorAgendamentos) {
    console.error("Erro ao buscar agendamentos do professor:", errorAgendamentos);
    throw errorAgendamentos;
  }

  const listaAgendamentos = agendamentos || [];

  if (!listaAgendamentos.length) {
    return 0;
  }

  const agendamentosComHorario = listaAgendamentos
    .map((item) => {
      const horario = mapaHorarios.get(Number(item.horario_reposicao_id));

      return {
        id: item.id,
        aula_id: item.aula_id || null,
        matricula_id: item.matricula_id || null,
        tipo_agendamento:
          item.tipo_agendamento || STATUS_NOTIFICACAO_HOME.REPOSICAO,
        data_reposicao: horario?.data || null
      };
    })
    .filter((item) => item.data_reposicao);

  const aulasOriginaisIds = [
    ...new Set(
      agendamentosComHorario
        .map((item) => Number(item.aula_id))
        .filter(Boolean)
    )
  ];

  const matriculasIds = [
    ...new Set(
      agendamentosComHorario
        .map((item) => Number(item.matricula_id))
        .filter(Boolean)
    )
  ];

  const datasReposicao = [
    ...new Set(
      agendamentosComHorario
        .map((item) => item.data_reposicao)
        .filter(Boolean)
    )
  ];

  let aulasOriginaisJaRepostas = new Set();

  if (aulasOriginaisIds.length) {
    const { data: aulasRepostas, error: errorAulasRepostas } = await supabase
      .from("aula")
      .select("aula_original_id")
      .eq("professor_id", professorId)
      .eq("status", STATUS_NOTIFICACAO_HOME.REPOSICAO)
      .not("aula_original_id", "is", null)
      .in("aula_original_id", aulasOriginaisIds);

    if (errorAulasRepostas) {
      console.warn(
        "Não foi possível verificar reposições já registradas:",
        errorAulasRepostas
      );
    } else {
      aulasOriginaisJaRepostas = new Set(
        (aulasRepostas || []).map((item) => Number(item.aula_original_id))
      );
    }
  }

  let aulasJaRegistradasPorData = new Set();

  if (matriculasIds.length && datasReposicao.length) {
    const { data: aulasRegistradas, error: errorAulasRegistradas } =
      await supabase
        .from("aula")
        .select("matricula_id, data_aula, status")
        .eq("professor_id", professorId)
        .in("matricula_id", matriculasIds)
        .in("data_aula", datasReposicao)
        .in("status", [
          STATUS_NOTIFICACAO_HOME.REPOSICAO,
          STATUS_NOTIFICACAO_HOME.AULA_INSTRUMENTAL,
          STATUS_NOTIFICACAO_HOME.PLANTAO_DUVIDAS
        ]);

    if (errorAulasRegistradas) {
      console.warn(
        "Não foi possível verificar aulas já registradas:",
        errorAulasRegistradas
      );
    } else {
      aulasJaRegistradasPorData = new Set();

      (aulasRegistradas || []).forEach((aula) => {
        aulasJaRegistradasPorData.add(
          `${Number(aula.matricula_id)}|${aula.data_aula}|${aula.status}`
        );
      });
    }
  }

  const agendamentosAtivos = agendamentosComHorario.filter((item) => {
    const tipo = item.tipo_agendamento || STATUS_NOTIFICACAO_HOME.REPOSICAO;

    const chavePorData =
      `${Number(item.matricula_id)}|${item.data_reposicao}|${tipo}`;

    const jaRegistrouPorData = aulasJaRegistradasPorData.has(chavePorData);

    if (jaRegistrouPorData) {
      return false;
    }

    if (tipo === STATUS_NOTIFICACAO_HOME.REPOSICAO) {
      const jaRegistrouPelaAulaOriginal =
        item.aula_id &&
        aulasOriginaisJaRepostas.has(Number(item.aula_id));

      if (jaRegistrouPelaAulaOriginal) {
        return false;
      }

      return true;
    }

    if (
      tipo === STATUS_NOTIFICACAO_HOME.AULA_INSTRUMENTAL ||
      tipo === STATUS_NOTIFICACAO_HOME.PLANTAO_DUVIDAS
    ) {
      return true;
    }

    return item.data_reposicao >= hoje;
  });

  const agendamentosNovos = agendamentosAtivos.filter((item) => {
    const notificacaoId = `agendamento_${item.id}`;
    return !notificacaoJaVistaHome(notificacaoId);
  });

  return agendamentosNovos.length;
}

/* ======================
   Avaliações novas

   Conta avaliações com status:
   "Realizada pelo aluno"

   Só conta se ainda não foi marcada como vista.
====================== */
async function buscarTotalAvaliacoesNovasProfessorHome() {
  const { data: matriculas, error: errorMatriculas } = await supabase
    .from("matricula")
    .select("id")
    .eq("professor_id", professorId)
    .eq("ativa", true);

  if (errorMatriculas) {
    console.error("Erro ao buscar matrículas do professor:", errorMatriculas);
    throw errorMatriculas;
  }

  const matriculasIds = (matriculas || []).map((matricula) =>
    Number(matricula.id)
  );

  if (!matriculasIds.length) {
    return 0;
  }

  const { data: avaliacoes, error: errorAvaliacoes } = await supabase
    .from("avaliacao_aluno")
    .select("id, matricula_id, status")
    .in("matricula_id", matriculasIds)
    .eq("status", "Realizada pelo aluno");

  if (errorAvaliacoes) {
    console.error("Erro ao buscar avaliações realizadas:", errorAvaliacoes);
    throw errorAvaliacoes;
  }

  const avaliacoesNovas = (avaliacoes || []).filter((avaliacao) => {
    const notificacaoId = `avaliacao_${avaliacao.id}`;
    return !notificacaoJaVistaHome(notificacaoId);
  });

  return avaliacoesNovas.length;
}

/* ======================
   Resumo de notificações da home

   Substitui a RPC antiga:
   contar_notificacoes_professor_reposicao
====================== */
async function carregarResumoNotificacoesProfessor() {
  if (!textoCardNotificacoesProfessor) return;

  try {
    const [
      totalAgendamentosNovos,
      totalAvaliacoesNovas
    ] = await Promise.all([
      buscarTotalAgendamentosNovosProfessorHome(),
      buscarTotalAvaliacoesNovasProfessorHome()
    ]);

    const total =
      Number(totalAgendamentosNovos || 0) +
      Number(totalAvaliacoesNovas || 0);

    atualizarBadgeNotificacoes(total);

    if (total === 0) {
      textoCardNotificacoesProfessor.textContent =
        "Nenhuma nova notificação. Agendamentos e avaliações realizadas aparecerão aqui.";
      return;
    }

    if (total === 1) {
      textoCardNotificacoesProfessor.textContent =
        "Você tem 1 nova notificação para verificar.";
      return;
    }

    textoCardNotificacoesProfessor.textContent =
      `Você tem ${total} novas notificações para verificar.`;

  } catch (error) {
    console.error("Erro ao carregar resumo de notificações:", error);

    atualizarBadgeNotificacoes(0);

    textoCardNotificacoesProfessor.textContent =
      "Veja novos agendamentos e avaliações informadas como realizadas pelos alunos.";
  }
}

/* ======================
   Carregar professor logado
====================== */
async function carregarProfessor() {
  const { data, error } = await supabase
    .from("professor")
    .select("id, nome, email")
    .eq("id", professorId)
    .single();

  if (error || !data) {
    console.error("Erro ao carregar professor:", error);

    if (saudacao) saudacao.textContent = "Olá!";
    if (tituloProfessor) tituloProfessor.textContent = "Bem-vindo(a)";

    mostrarInfoPerfilAluno(
      "Não foi possível carregar os dados do professor.",
      "erro"
    );

    return;
  }

  professorLogado = data;

  if (saudacao) saudacao.textContent = `Olá, ${data.nome}!`;
  if (tituloProfessor) tituloProfessor.textContent = "Bem-vindo(a)";

  if (selectPerfilVisualizacao) {
    selectPerfilVisualizacao.value = "professor";
  }

  if (painelProfessorCards) {
    painelProfessorCards.style.display = "grid";
  }

  await verificarVinculoAluno();
  await carregarResumoNotificacoesProfessor();
}

/* ======================
   Verificar se esse professor também é aluno
====================== */
async function verificarVinculoAluno() {
  if (!professorLogado?.email) {
    if (optionAluno) optionAluno.disabled = true;

    mostrarInfoPerfilAluno("Perfil de aluno indisponível.", "erro");
    return;
  }

  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome, email, empresa_cnpj")
    .eq("email", professorLogado.email)
    .maybeSingle();

  if (error) {
    console.error("Erro ao verificar vínculo como aluno:", error);

    if (optionAluno) optionAluno.disabled = true;

    mostrarInfoPerfilAluno(
      "Não foi possível verificar o perfil de aluno.",
      "erro"
    );

    return;
  }

  if (!data) {
    alunoVinculado = null;

    if (optionAluno) optionAluno.disabled = true;

    mostrarInfoPerfilAluno(
      "Este usuário não possui cadastro como aluno.",
      "neutro"
    );

    return;
  }

  alunoVinculado = data;

  if (optionAluno) optionAluno.disabled = false;

  mostrarInfoPerfilAluno("Perfil de aluno disponível.", "ok");
}

/* ======================
   Trocar visualização automaticamente
====================== */
selectPerfilVisualizacao?.addEventListener("change", () => {
  const perfilSelecionado = selectPerfilVisualizacao.value;

  if (perfilSelecionado === "professor") {
    if (painelProfessorCards) {
      painelProfessorCards.style.display = "grid";
    }

    return;
  }

  if (perfilSelecionado === "aluno") {
    if (!alunoVinculado?.id) {
      mostrarInfoPerfilAluno(
        "Este usuário não possui perfil de aluno disponível.",
        "erro"
      );

      selectPerfilVisualizacao.value = "professor";

      if (painelProfessorCards) {
        painelProfessorCards.style.display = "grid";
      }

      return;
    }

    localStorage.setItem("alunoIdVisualizacao", alunoVinculado.id);

    window.location.href = "home-aluno-funcionario.html";
  }
});

/* ======================
   Compatibilidade com botão antigo "Ir"
====================== */
btnAbrirPerfil?.addEventListener("click", () => {
  const perfilSelecionado = selectPerfilVisualizacao?.value;

  if (perfilSelecionado === "professor") {
    if (painelProfessorCards) {
      painelProfessorCards.style.display = "grid";
    }

    return;
  }

  if (perfilSelecionado === "aluno") {
    if (!alunoVinculado?.id) {
      mostrarInfoPerfilAluno(
        "Este usuário não possui perfil de aluno disponível.",
        "erro"
      );

      return;
    }

    localStorage.setItem("alunoIdVisualizacao", alunoVinculado.id);

    window.location.href = "home-aluno-funcionario.html";
  }
});

/* ======================
   Sair
====================== */
btnSair?.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Erro ao sair:", error);
  }

  localStorage.removeItem("role");
  localStorage.removeItem("professorId");
  localStorage.removeItem("professorNome");
  localStorage.removeItem("professorEmail");
  localStorage.removeItem("matriculaSelecionada");
  localStorage.removeItem("alunoIdVisualizacao");

  window.location.href = "index.html";
});

/* ======================
   Iniciar
====================== */
await carregarProfessor();