import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

/* =====================================================
   1. PARÂMETROS
===================================================== */

const params = new URLSearchParams(window.location.search);

const aulaId =
  params.get("id") ||
  localStorage.getItem("aulaSelecionadaEdicaoAdmin") ||
  localStorage.getItem("aulaSelecionadaEdicao");

const grupoAulaId =
  params.get("grupo_aula_id") ||
  localStorage.getItem("grupoAulaSelecionadoEdicaoAdmin");

const professorIdUrl =
  params.get("professor_id") ||
  localStorage.getItem("professorSelecionadoAdmin");

const professorId = Number(professorIdUrl || 0);

const ehEdicaoColetiva =
  Boolean(String(grupoAulaId || "").trim());

/* =====================================================
   2. ELEMENTOS
===================================================== */

const msg = document.getElementById("msg");

const boxCarregando =
  document.getElementById("boxCarregando");

const conteudoPagina =
  document.getElementById("conteudoPagina");

const textoOrientacao =
  document.getElementById("textoOrientacao");

const infoTipoAula =
  document.getElementById("infoTipoAula");

const infoProfessor =
  document.getElementById("infoProfessor");

const infoMateria =
  document.getElementById("infoMateria");

const infoModulo =
  document.getElementById("infoModulo");

const infoParte =
  document.getElementById("infoParte");

const infoDuracao =
  document.getElementById("infoDuracao");

const boxAlunoIndividual =
  document.getElementById("boxAlunoIndividual");

const infoAlunoIndividual =
  document.getElementById("infoAlunoIndividual");

const boxAlunosColetivos =
  document.getElementById("boxAlunosColetivos");

const listaEdicaoAlunosColetivos =
  document.getElementById("listaEdicaoAlunosColetivos");

const boxFormularioIndividual =
  document.getElementById("boxFormularioIndividual");

const formEditarAulaIndividual =
  document.getElementById("formEditarAulaIndividual");

const dataAulaIndividual =
  document.getElementById("dataAulaIndividual");

const statusAulaIndividual =
  document.getElementById("statusAulaIndividual");

const avisoRegraStatusIndividual =
  document.getElementById("avisoRegraStatusIndividual");

const boxJustificativaIndividual =
  document.getElementById("boxJustificativaIndividual");

const justificativaIndividual =
  document.getElementById("justificativaIndividual");

const boxAusenciaIndividual =
  document.getElementById("boxAusenciaIndividual");

const aulaGravadaIndividual =
  document.getElementById("aulaGravadaIndividual");

const precisaReposicaoIndividual =
  document.getElementById("precisaReposicaoIndividual");

const cardAulaGravadaIndividual =
  document.getElementById("cardAulaGravadaIndividual");

const cardPrecisaReposicaoIndividual =
  document.getElementById("cardPrecisaReposicaoIndividual");

const boxReposicaoIndividual =
  document.getElementById("boxReposicaoIndividual");

const aulaOriginalIndividual =
  document.getElementById("aulaOriginalIndividual");

const conteudoIndividual =
  document.getElementById("conteudoIndividual");

const labelLicaoIndividual =
  document.getElementById("labelLicaoIndividual");

const licaoIndividual =
  document.getElementById("licaoIndividual");

const btnSalvarIndividual =
  document.getElementById("btnSalvarIndividual");

const btnCancelarIndividual =
  document.getElementById("btnCancelarIndividual");

const boxFormularioColetivo =
  document.getElementById("boxFormularioColetivo");

const formEditarAulaColetiva =
  document.getElementById("formEditarAulaColetiva");

const dataAulaColetiva =
  document.getElementById("dataAulaColetiva");

const conteudoColetivo =
  document.getElementById("conteudoColetivo");

const licaoColetiva =
  document.getElementById("licaoColetiva");

const btnSalvarColetivo =
  document.getElementById("btnSalvarColetivo");

const btnCancelarColetivo =
  document.getElementById("btnCancelarColetivo");

const btnVoltarTopo =
  document.getElementById("btnVoltarTopo");

const btnVoltarRodape =
  document.getElementById("btnVoltarRodape");

/* =====================================================
   3. ESTADO
===================================================== */

let aulaAtual = null;
let aulasDoGrupo = [];
let alunosColetivosEdicao = [];

/* =====================================================
   4. CONSTANTES
===================================================== */

const STATUS = {
  PRESENTE: "Presente",
  AUSENTE: "Ausente",
  CANCELADA: "Cancelada",
  TRANCADA: "Trancada",
  REPOSICAO: "Reposição",
  AULA_INSTRUMENTAL: "Aula Instrumental",
  PLANTAO_DUVIDAS: "Plantão de dúvidas",
  AULA_EXPERIMENTAL: "Aula Experimental"
};

const DURACAO_AULA_EXPERIMENTAL_SEGUNDOS = 40 * 60;

/* =====================================================
   5. UTILITÁRIOS
===================================================== */

function mostrarMensagem(texto, ok = true) {
  if (!msg) {
    alert(texto);
    return;
  }

  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok
    ? "#e8f5e9"
    : "#ffebee";

  msg.style.color = ok
    ? "#1b5e20"
    : "#b71c1c";

  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";
  msg.style.fontWeight = "600";
  msg.style.textAlign = "center";

  msg.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 4500);
}

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatarDataBR(dataISO) {
  if (!dataISO) {
    return "-";
  }

  const [ano, mes, dia] =
    String(dataISO).split("-");

  if (!ano || !mes || !dia) {
    return String(dataISO);
  }

  return `${dia}/${mes}/${ano}`;
}

function formatarDuracao(segundos) {
  if (
    segundos === null ||
    segundos === undefined ||
    segundos === ""
  ) {
    return "Não informada";
  }

  const total = Number(segundos);

  if (!Number.isFinite(total)) {
    return "Não informada";
  }

  const minutos = Math.floor(total / 60);
  const segundosRestantes = total % 60;

  if (segundosRestantes === 0) {
    return `${minutos} minuto(s)`;
  }

  return `${minutos} min e ${segundosRestantes} s`;
}

function textoParte(parte) {
  if (!parte) {
    return "Parte não informada";
  }

  return `Parte ${parte}`;
}

function statusExigeJustificativa(status) {
  return (
    status === STATUS.AUSENTE ||
    status === STATUS.CANCELADA ||
    status === STATUS.TRANCADA
  );
}

function statusDesabilitaConteudo(status) {
  return (
    status === STATUS.CANCELADA ||
    status === STATUS.TRANCADA
  );
}

function voltarParaDetalhesProfessor() {
  localStorage.removeItem(
    "grupoAulaSelecionadoEdicaoAdmin"
  );

  if (professorId) {
    localStorage.setItem(
      "professorSelecionadoAdmin",
      String(professorId)
    );

    window.location.href =
      `detalhes-professor-admin.html?id=${professorId}`;

    return;
  }

  window.location.href =
    "detalhes-professor-admin.html";
}

function bloquearBotao(
  botao,
  textoCarregando
) {
  if (!botao) {
    return;
  }

  botao.dataset.textoOriginal =
    botao.textContent;

  botao.disabled = true;
  botao.textContent = textoCarregando;
}

function liberarBotao(botao) {
  if (!botao) {
    return;
  }

  botao.disabled = false;

  botao.textContent =
    botao.dataset.textoOriginal ||
    "Salvar alterações";
}

function obterProfessorNome(aula) {
  return (
    aula?.professor?.nome ||
    "Professor não informado"
  );
}

function obterMateriaNome(aula) {
  return (
    aula?.matricula?.materia?.nome ||
    "Curso não informado"
  );
}

function obterModuloNome(aula) {
  return (
    aula?.modulo?.nome ||
    aula?.matricula?.modulo?.nome ||
    "Módulo não informado"
  );
}

function obterAlunoNome(aula) {
  return (
    aula?.matricula?.aluno?.nome ||
    "Aluno não informado"
  );
}

/* =====================================================
   6. REGRAS AUTOMÁTICAS DE STATUS
===================================================== */

function criarRegrasDoStatus({
  statusNovo,
  statusAnterior,
  duracaoAnterior,
  aulaGravadaAusente = false,
  precisaReposicaoAusente = false,
  aulaOriginalId = null
}) {
  const statusMudou =
    statusNovo !== statusAnterior;

  const regras = {
    aula_gravada: false,
    precisa_reposicao: false,
    aula_original_id: null,
    reposicao_com_custo: false,
    duracao_segundos: duracaoAnterior
  };

  if (statusNovo === STATUS.PRESENTE) {
    regras.aula_gravada = true;
    regras.precisa_reposicao = false;
    regras.aula_original_id = null;

    if (statusMudou) {
      regras.duracao_segundos = null;
    }

    return regras;
  }

  if (statusNovo === STATUS.AUSENTE) {
    regras.aula_gravada =
      Boolean(aulaGravadaAusente);

    regras.precisa_reposicao =
      Boolean(precisaReposicaoAusente);

    regras.aula_original_id = null;

    if (statusMudou) {
      regras.duracao_segundos = null;
    }

    return regras;
  }

  if (
    statusNovo === STATUS.CANCELADA ||
    statusNovo === STATUS.TRANCADA
  ) {
    regras.aula_gravada = false;
    regras.precisa_reposicao = true;
    regras.aula_original_id = null;

    if (statusMudou) {
      regras.duracao_segundos = null;
    }

    return regras;
  }

  if (statusNovo === STATUS.REPOSICAO) {
    regras.aula_gravada = true;
    regras.precisa_reposicao = false;

    regras.aula_original_id =
      aulaOriginalId
        ? Number(aulaOriginalId)
        : null;

    if (statusMudou) {
      regras.duracao_segundos = null;
    }

    return regras;
  }

  if (
    statusNovo === STATUS.AULA_INSTRUMENTAL ||
    statusNovo === STATUS.PLANTAO_DUVIDAS
  ) {
    regras.aula_gravada = true;
    regras.precisa_reposicao = false;
    regras.aula_original_id = null;

    if (statusMudou) {
      regras.duracao_segundos = null;
    }

    return regras;
  }

  if (statusNovo === STATUS.AULA_EXPERIMENTAL) {
    regras.aula_gravada = false;
    regras.precisa_reposicao = false;
    regras.aula_original_id = null;
    regras.duracao_segundos =
      DURACAO_AULA_EXPERIMENTAL_SEGUNDOS;

    return regras;
  }

  return regras;
}

function validarStatus({
  status,
  justificativa,
  aulaGravada,
  precisaReposicao,
  aulaOriginalId
}) {
  if (!status) {
    return "Selecione o status da aula.";
  }

  if (
    statusExigeJustificativa(status) &&
    !String(justificativa || "").trim()
  ) {
    return `Preencha a justificativa para o status "${status}".`;
  }

  if (status === STATUS.AUSENTE) {
    if (
      !aulaGravada &&
      !precisaReposicao
    ) {
      return (
        'Para uma aula ausente, escolha "Aula foi gravada" ' +
        'ou "Precisa de reposição".'
      );
    }

    if (
      aulaGravada &&
      precisaReposicao
    ) {
      return (
        "Uma aula ausente não pode estar gravada e " +
        "precisar de reposição ao mesmo tempo."
      );
    }
  }

  if (
    status === STATUS.REPOSICAO &&
    !aulaOriginalId
  ) {
    return (
      "Selecione a aula original que está sendo reposta."
    );
  }

  return null;
}

/* =====================================================
   7. BUSCAR AULAS PENDENTES
===================================================== */

async function buscarAulasPendentes(
  matriculaId,
  aulaOriginalAtual = null,
  aulaEmEdicaoId = null
) {
  if (!matriculaId) {
    return [];
  }

  /*
    Buscamos, em paralelo:

    1) as aulas que podem gerar reposição;
    2) as reposições já registradas para esta matrícula.

    Assim, uma aula original que já foi vinculada a uma
    reposição deixa de aparecer como pendente.

    Exceção:
    ao editar uma aula que já é uma reposição, mantemos no
    seletor a aula original atualmente vinculada.
  */
  const [
    resultadoPendentes,
    resultadoReposicoes
  ] = await Promise.all([
    supabase
      .from("aula")
      .select(`
        id,
        data_aula,
        status,
        justificativa,
        aula_gravada,
        precisa_reposicao
      `)
      .eq("matricula_id", Number(matriculaId))
      .in("status", [
        STATUS.AUSENTE,
        STATUS.CANCELADA,
        STATUS.TRANCADA
      ])
      .order("data_aula", {
        ascending: true
      }),

    supabase
      .from("aula")
      .select(`
        id,
        aula_original_id
      `)
      .eq("matricula_id", Number(matriculaId))
      .eq("status", STATUS.REPOSICAO)
      .not("aula_original_id", "is", null)
  ]);

  if (resultadoPendentes.error) {
    console.error(
      "Erro ao buscar aulas pendentes:",
      resultadoPendentes.error
    );

    return [];
  }

  if (resultadoReposicoes.error) {
    console.error(
      "Erro ao verificar reposições já realizadas:",
      resultadoReposicoes.error
    );

    return [];
  }

  const idsJaRepostos = new Set(
    (resultadoReposicoes.data || [])
      .filter((reposicao) => {
        /*
          Ignoramos somente a própria reposição que está
          sendo editada. Isso permite manter a aula original
          atual disponível no seletor.
        */
        return (
          Number(reposicao.id) !==
          Number(aulaEmEdicaoId)
        );
      })
      .map((reposicao) =>
        Number(reposicao.aula_original_id)
      )
      .filter((id) =>
        Number.isFinite(id) && id > 0
      )
  );

  return (resultadoPendentes.data || [])
    .filter((aula) => {
      const aulaIdNumerico =
        Number(aula.id);

      const ehOriginalAtual =
        aulaOriginalAtual &&
        aulaIdNumerico ===
          Number(aulaOriginalAtual);

      /*
        A própria aula em edição nunca pode ser escolhida
        como aula original de si mesma.
      */
      const ehAPropriaAula =
        aulaEmEdicaoId &&
        aulaIdNumerico ===
          Number(aulaEmEdicaoId);

      if (ehAPropriaAula) {
        return false;
      }

      if (ehOriginalAtual) {
        return true;
      }

      if (idsJaRepostos.has(aulaIdNumerico)) {
        return false;
      }

      if (aula.precisa_reposicao !== true) {
        return false;
      }

      if (aula.status === STATUS.AUSENTE) {
        return aula.aula_gravada === false;
      }

      return (
        aula.status === STATUS.CANCELADA ||
        aula.status === STATUS.TRANCADA
      );
    });
}

function textoAulaPendente(aula) {
  const data = formatarDataBR(
    aula.data_aula
  );

  const justificativa =
    aula.justificativa?.trim()
      ? ` — ${aula.justificativa.trim()}`
      : "";

  return (
    `${data} — ${aula.status}` +
    justificativa
  );
}

async function preencherSelectAulasPendentes({
  select,
  matriculaId,
  aulaOriginalAtual = null,
  aulaEmEdicaoId = null
}) {
  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="">
      Carregando aulas pendentes...
    </option>
  `;

  const aulas = await buscarAulasPendentes(
    matriculaId,
    aulaOriginalAtual,
    aulaEmEdicaoId
  );

  if (!aulas.length) {
    select.innerHTML = `
      <option value="">
        Nenhuma aula pendente encontrada
      </option>
    `;

    return;
  }

  select.innerHTML = `
    <option value="">
      Selecione a aula original
    </option>
  `;

  aulas.forEach((aula) => {
    const option =
      document.createElement("option");

    option.value = String(aula.id);
    option.textContent =
      textoAulaPendente(aula);

    select.appendChild(option);
  });

  if (aulaOriginalAtual) {
    select.value =
      String(aulaOriginalAtual);
  }
}
/* =====================================================
   8. BUSCAR AULA INDIVIDUAL
===================================================== */

async function carregarAulaIndividual() {
  const id = Number(aulaId);

  if (!id) {
    mostrarMensagem(
      "Nenhuma aula foi selecionada para edição.",
      false
    );

    return false;
  }

  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      status,
      justificativa,
      conteudo,
      licao_casa,
      matricula_id,
      duracao_segundos,
      professor_id,
      parte,
      modulo_id,
      aula_gravada,
      precisa_reposicao,
      aula_original_id,
      reposicao_com_custo,
      aula_coletiva,
      grupo_aula_id,
      quantidade_alunos,
      professor:professor_id (
        id,
        nome
      ),
      modulo:modulo_id (
        id,
        nome
      ),
      matricula:matricula_id (
        id,
        aluno_id,
        materia_id,
        modulo_id,
        aluno:aluno_id (
          id,
          nome
        ),
        materia:materia_id (
          id,
          nome
        ),
        modulo:modulo_id (
          id,
          nome
        )
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error(
      "Erro ao carregar aula:",
      error
    );

    mostrarMensagem(
      "Não foi possível carregar a aula.",
      false
    );

    return false;
  }

  if (
    professorId &&
    Number(data.professor_id) !== professorId
  ) {
    mostrarMensagem(
      "Esta aula não pertence ao professor selecionado.",
      false
    );

    return false;
  }

  aulaAtual = data;

  preencherTelaIndividual();

  return true;
}

/* =====================================================
   9. PREENCHER AULA INDIVIDUAL
===================================================== */

async function preencherTelaIndividual() {
  infoTipoAula.textContent =
    "Aula individual";

  infoProfessor.textContent =
    obterProfessorNome(aulaAtual);

  infoMateria.textContent =
    obterMateriaNome(aulaAtual);

  infoModulo.textContent =
    obterModuloNome(aulaAtual);

  infoParte.textContent =
    textoParte(aulaAtual.parte);

  infoDuracao.textContent =
    formatarDuracao(
      aulaAtual.duracao_segundos
    );

  infoAlunoIndividual.textContent =
    obterAlunoNome(aulaAtual);

  dataAulaIndividual.value =
    aulaAtual.data_aula || "";

  statusAulaIndividual.value =
    aulaAtual.status || "";

  justificativaIndividual.value =
    aulaAtual.justificativa || "";

  conteudoIndividual.value =
    aulaAtual.conteudo || "";

  licaoIndividual.value =
    aulaAtual.licao_casa || "";

  aulaGravadaIndividual.checked =
    aulaAtual.aula_gravada === true;

  precisaReposicaoIndividual.checked =
    aulaAtual.precisa_reposicao === true;

  boxAlunoIndividual.style.display =
    "block";

  boxFormularioIndividual.style.display =
    "block";

  boxAlunosColetivos.style.display =
    "none";

  boxFormularioColetivo.style.display =
    "none";

  await atualizarCamposIndividual({
    preservarAusencia: true
  });
}

/* =====================================================
   10. INTERFACE INDIVIDUAL
===================================================== */

function atualizarCardsAusenciaIndividual() {
  cardAulaGravadaIndividual?.classList.toggle(
    "ativo",
    aulaGravadaIndividual.checked
  );

  cardPrecisaReposicaoIndividual?.classList.toggle(
    "ativo",
    precisaReposicaoIndividual.checked
  );
}

function textoRegraStatus(status) {
  if (status === STATUS.PRESENTE) {
    return (
      "A aula será marcada automaticamente como gravada, " +
      "sem reposição. A duração não será preenchida manualmente."
    );
  }

  if (status === STATUS.AUSENTE) {
    return (
      "Escolha se a aula foi gravada ou se o aluno precisa " +
      "de reposição."
    );
  }

  if (status === STATUS.CANCELADA) {
    return (
      "A aula será marcada automaticamente como não gravada " +
      "e com reposição pendente."
    );
  }

  if (status === STATUS.TRANCADA) {
    return (
      "A aula será marcada automaticamente como não gravada " +
      "e com reposição pendente."
    );
  }

  if (status === STATUS.REPOSICAO) {
    return (
      "A aula será marcada como gravada, sem nova reposição. " +
      "É necessário selecionar a aula original."
    );
  }

  if (status === STATUS.AULA_INSTRUMENTAL) {
    return (
      "A aula será marcada automaticamente como gravada e " +
      "não gerará reposição."
    );
  }

  if (status === STATUS.PLANTAO_DUVIDAS) {
    return (
      "A aula será marcada automaticamente como gravada e " +
      "não gerará reposição."
    );
  }

  if (status === STATUS.AULA_EXPERIMENTAL) {
    return (
      "A aula será marcada como não gravada, sem reposição e " +
      "com duração automática de 40 minutos."
    );
  }

  return "";
}

async function atualizarCamposIndividual({
  preservarAusencia = false
} = {}) {
  const status =
    statusAulaIndividual.value;

  const exigeJustificativa =
    statusExigeJustificativa(status);

  boxJustificativaIndividual.style.display =
    exigeJustificativa
      ? "block"
      : "none";

  boxAusenciaIndividual.style.display =
    status === STATUS.AUSENTE
      ? "block"
      : "none";

  boxReposicaoIndividual.style.display =
    status === STATUS.REPOSICAO
      ? "block"
      : "none";

  const textoRegra =
    textoRegraStatus(status);

  avisoRegraStatusIndividual.textContent =
    textoRegra;

  avisoRegraStatusIndividual.style.display =
    textoRegra
      ? "block"
      : "none";

  if (
    status !== STATUS.AUSENTE ||
    !preservarAusencia
  ) {
    if (status !== STATUS.AUSENTE) {
      aulaGravadaIndividual.checked = false;
      precisaReposicaoIndividual.checked = false;
    }
  }

  if (status === STATUS.PRESENTE) {
    aulaGravadaIndividual.checked = true;
    precisaReposicaoIndividual.checked = false;
  }

  if (
    status === STATUS.CANCELADA ||
    status === STATUS.TRANCADA
  ) {
    aulaGravadaIndividual.checked = false;
    precisaReposicaoIndividual.checked = true;
  }

  if (
    status === STATUS.REPOSICAO ||
    status === STATUS.AULA_INSTRUMENTAL ||
    status === STATUS.PLANTAO_DUVIDAS
  ) {
    aulaGravadaIndividual.checked = true;
    precisaReposicaoIndividual.checked = false;
  }

  if (status === STATUS.AULA_EXPERIMENTAL) {
    aulaGravadaIndividual.checked = false;
    precisaReposicaoIndividual.checked = false;
  }

  if (!exigeJustificativa) {
    justificativaIndividual.value = "";
  }

  const desabilitarConteudo =
    statusDesabilitaConteudo(status);

  conteudoIndividual.disabled =
    desabilitarConteudo;

  licaoIndividual.disabled =
    desabilitarConteudo ||
    status === STATUS.AULA_EXPERIMENTAL;

  labelLicaoIndividual.style.display =
    status === STATUS.AULA_EXPERIMENTAL
      ? "none"
      : "block";

  if (desabilitarConteudo) {
    conteudoIndividual.value = "";
    licaoIndividual.value = "";
  }

  if (status === STATUS.AULA_EXPERIMENTAL) {
    licaoIndividual.value = "";
  }

  atualizarCardsAusenciaIndividual();

  if (status === STATUS.REPOSICAO) {
    await preencherSelectAulasPendentes({
      select: aulaOriginalIndividual,
      matriculaId: aulaAtual.matricula_id,
      aulaOriginalAtual:
        aulaAtual.aula_original_id,
      aulaEmEdicaoId:
        aulaAtual.id
    });
  } else {
    aulaOriginalIndividual.innerHTML = `
      <option value="">
        Selecione o status Reposição
      </option>
    `;
  }
}

/* =====================================================
   11. SALVAR AULA INDIVIDUAL
===================================================== */

async function salvarAulaIndividual(event) {
  event.preventDefault();

  if (!aulaAtual?.id) {
    mostrarMensagem(
      "A aula ainda não foi carregada.",
      false
    );

    return;
  }

  const novaData =
    dataAulaIndividual.value;

  const novoStatus =
    statusAulaIndividual.value;

  const novaJustificativa =
    justificativaIndividual.value.trim();

  const novoConteudo =
    conteudoIndividual.value.trim();

  const novaLicao =
    licaoIndividual.value.trim();

  const aulaOriginalIdSelecionada =
    aulaOriginalIndividual.value || null;

  if (!novaData) {
    mostrarMensagem(
      "Selecione a data da aula.",
      false
    );

    return;
  }

  const erroValidacao = validarStatus({
    status: novoStatus,
    justificativa: novaJustificativa,
    aulaGravada:
      aulaGravadaIndividual.checked,
    precisaReposicao:
      precisaReposicaoIndividual.checked,
    aulaOriginalId:
      aulaOriginalIdSelecionada
  });

  if (erroValidacao) {
    mostrarMensagem(
      erroValidacao,
      false
    );

    return;
  }

  const regras = criarRegrasDoStatus({
    statusNovo: novoStatus,
    statusAnterior: aulaAtual.status,
    duracaoAnterior:
      aulaAtual.duracao_segundos,
    aulaGravadaAusente:
      aulaGravadaIndividual.checked,
    precisaReposicaoAusente:
      precisaReposicaoIndividual.checked,
    aulaOriginalId:
      aulaOriginalIdSelecionada
  });

  const payload = {
    data_aula: novaData,
    status: novoStatus,

    justificativa:
      statusExigeJustificativa(novoStatus)
        ? novaJustificativa
        : null,

    conteudo:
      statusDesabilitaConteudo(novoStatus)
        ? null
        : novoConteudo || null,

    licao_casa:
      statusDesabilitaConteudo(novoStatus) ||
      novoStatus === STATUS.AULA_EXPERIMENTAL
        ? null
        : novaLicao || null,

    aula_gravada:
      regras.aula_gravada,

    precisa_reposicao:
      regras.precisa_reposicao,

    aula_original_id:
      regras.aula_original_id,

    reposicao_com_custo:
      regras.reposicao_com_custo,

    duracao_segundos:
      regras.duracao_segundos
  };

  bloquearBotao(
    btnSalvarIndividual,
    "Salvando..."
  );

  const { error } = await supabase
    .from("aula")
    .update(payload)
    .eq("id", aulaAtual.id)
    .eq("professor_id", aulaAtual.professor_id);

  liberarBotao(btnSalvarIndividual);

  if (error) {
    console.error(
      "Erro ao atualizar aula:",
      error
    );

    mostrarMensagem(
      "Não foi possível salvar as alterações da aula.",
      false
    );

    return;
  }

  mostrarMensagem(
    "Aula atualizada com sucesso!"
  );

  setTimeout(() => {
    voltarParaDetalhesProfessor();
  }, 1000);
}

/* =====================================================
   12. BUSCAR AULA COLETIVA
===================================================== */

async function carregarAulaColetiva() {
  const grupoId =
    String(grupoAulaId || "").trim();

  if (!grupoId) {
    mostrarMensagem(
      "Grupo da aula coletiva não encontrado.",
      false
    );

    return false;
  }

  let query = supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      status,
      justificativa,
      conteudo,
      licao_casa,
      matricula_id,
      duracao_segundos,
      professor_id,
      parte,
      modulo_id,
      aula_gravada,
      precisa_reposicao,
      aula_original_id,
      reposicao_com_custo,
      aula_coletiva,
      grupo_aula_id,
      quantidade_alunos,
      professor:professor_id (
        id,
        nome
      ),
      modulo:modulo_id (
        id,
        nome
      ),
      matricula:matricula_id (
        id,
        aluno_id,
        materia_id,
        modulo_id,
        aluno:aluno_id (
          id,
          nome
        ),
        materia:materia_id (
          id,
          nome
        ),
        modulo:modulo_id (
          id,
          nome
        )
      )
    `)
    .eq("grupo_aula_id", grupoId)
    .eq("aula_coletiva", true)
    .order("id", {
      ascending: true
    });

  if (professorId) {
    query = query.eq(
      "professor_id",
      professorId
    );
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    console.error(
      "Erro ao carregar aula coletiva:",
      error
    );

    mostrarMensagem(
      "Não foi possível carregar a aula coletiva.",
      false
    );

    return false;
  }

  aulasDoGrupo = data;

  aulaAtual = aulasDoGrupo[0];

  alunosColetivosEdicao =
    aulasDoGrupo.map((aula) => {
      return {
        id: aula.id,
        matriculaId: aula.matricula_id,
        nome: obterAlunoNome(aula),
        status: aula.status,
        statusOriginal: aula.status,
        justificativa:
          aula.justificativa || "",
        aulaGravada:
          aula.aula_gravada === true,
        precisaReposicao:
          aula.precisa_reposicao === true,
        aulaOriginalId:
          aula.aula_original_id || null,
        duracaoSegundos:
          aula.duracao_segundos,
        dadosCompletos: aula
      };
    });

  await preencherTelaColetiva();

  return true;
}
/* =====================================================
   13. PREENCHER AULA COLETIVA
===================================================== */

async function preencherTelaColetiva() {
  infoTipoAula.textContent =
    "Aula coletiva";

  infoProfessor.textContent =
    obterProfessorNome(aulaAtual);

  infoMateria.textContent =
    obterMateriaNome(aulaAtual);

  infoModulo.textContent =
    obterModuloNome(aulaAtual);

  infoParte.textContent =
    textoParte(aulaAtual.parte);

  infoDuracao.textContent =
    formatarDuracao(
      aulaAtual.duracao_segundos
    );

  dataAulaColetiva.value =
    aulaAtual.data_aula || "";

  conteudoColetivo.value =
    aulaAtual.conteudo || "";

  licaoColetiva.value =
    aulaAtual.licao_casa || "";

  boxAlunoIndividual.style.display =
    "none";

  boxFormularioIndividual.style.display =
    "none";

  boxAlunosColetivos.style.display =
    "block";

  boxFormularioColetivo.style.display =
    "block";

  textoOrientacao.textContent =
    "Na aula coletiva, a data, o conteúdo e a lição são comuns ao grupo. O status e a justificativa podem ser corrigidos separadamente para cada aluno.";

  await renderizarAlunosColetivos();
}

/* =====================================================
   14. HTML DO ALUNO COLETIVO
===================================================== */

function opcoesStatusHTML(statusAtual) {
  const statusDisponiveis = [
    STATUS.PRESENTE,
    STATUS.AUSENTE,
    STATUS.CANCELADA,
    STATUS.TRANCADA,
    STATUS.REPOSICAO,
    STATUS.AULA_INSTRUMENTAL,
    STATUS.PLANTAO_DUVIDAS,
    STATUS.AULA_EXPERIMENTAL
  ];

  return statusDisponiveis
    .map((status) => {
      const selecionado =
        status === statusAtual
          ? "selected"
          : "";

      return `
        <option
          value="${escaparHTML(status)}"
          ${selecionado}
        >
          ${escaparHTML(status)}
        </option>
      `;
    })
    .join("");
}

function htmlJustificativaColetiva(
  aluno,
  index
) {
  if (
    !statusExigeJustificativa(
      aluno.status
    )
  ) {
    return "";
  }

  return `
    <label
      style="
        display:block;
        margin-top:10px;
      "
    >
      Justificativa

      <textarea
        class="justificativa-coletiva"
        data-index="${index}"
        rows="3"
        style="
          width:100%;
          margin-top:4px;
        "
        placeholder="Informe a justificativa"
      >${escaparHTML(aluno.justificativa)}</textarea>
    </label>
  `;
}

function htmlAusenciaColetiva(
  aluno,
  index
) {
  if (aluno.status !== STATUS.AUSENTE) {
    return "";
  }

  return `
    <div
      class="box-regra-ausencia"
      style="margin-top:10px;"
    >
      <h3>
        Regra da ausência
      </h3>

      <p>
        Escolha apenas uma opção.
      </p>

      <div class="opcoes-ausencia">

        <label
          class="
            card-opcao-ausencia
            ${aluno.aulaGravada ? "ativo" : ""}
          "
        >
          <input
            type="checkbox"
            class="gravada-coletiva"
            data-index="${index}"
            ${aluno.aulaGravada ? "checked" : ""}
          />

          <span>
            <strong>
              Aula foi gravada
            </strong>

            <small>
              O aluno poderá assistir depois.
            </small>
          </span>
        </label>

        <label
          class="
            card-opcao-ausencia
            ${aluno.precisaReposicao ? "ativo" : ""}
          "
        >
          <input
            type="checkbox"
            class="reposicao-coletiva"
            data-index="${index}"
            ${aluno.precisaReposicao ? "checked" : ""}
          />

          <span>
            <strong>
              Precisa de reposição
            </strong>

            <small>
              A aula não foi gravada.
            </small>
          </span>
        </label>

      </div>
    </div>
  `;
}

function htmlReposicaoColetiva(
  aluno,
  index
) {
  if (aluno.status !== STATUS.REPOSICAO) {
    return "";
  }

  return `
    <label
      style="
        display:block;
        margin-top:10px;
      "
    >
      Aula original

      <select
        class="aula-original-coletiva"
        data-index="${index}"
        style="
          width:100%;
          margin-top:4px;
        "
      >
        <option value="">
          Carregando aulas pendentes...
        </option>
      </select>
    </label>
  `;
}

function htmlRegraAutomaticaColetiva(
  aluno
) {
  const texto =
    textoRegraStatus(aluno.status);

  if (!texto) {
    return "";
  }

  return `
    <div
      style="
        background:#fff8dc;
        border:1px solid #f1bc32;
        color:#5f4700;
        padding:9px 10px;
        border-radius:10px;
        margin-top:10px;
        font-size:12px;
        line-height:1.4;
      "
    >
      ${escaparHTML(texto)}
    </div>
  `;
}

/* =====================================================
   15. RENDERIZAR ALUNOS COLETIVOS
===================================================== */

async function renderizarAlunosColetivos() {
  listaEdicaoAlunosColetivos.innerHTML =
    "";

  alunosColetivosEdicao.forEach(
    (aluno, index) => {
      const div =
        document.createElement("div");

      div.style.padding = "12px";
      div.style.marginBottom = "12px";
      div.style.border =
        "1px solid #e6dfcf";
      div.style.borderRadius = "12px";
      div.style.background = "#fffdf5";

      div.innerHTML = `
        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:10px;
            flex-wrap:wrap;
          "
        >
          <div>
            <strong>
              ${escaparHTML(aluno.nome)}
            </strong>

            <div
              style="
                font-size:12px;
                opacity:0.75;
                margin-top:3px;
              "
            >
              Matrícula ${escaparHTML(aluno.matriculaId)}
            </div>
          </div>

          <div
            style="
              font-size:12px;
              opacity:0.75;
            "
          >
            Duração atual:
            ${escaparHTML(
              formatarDuracao(
                aluno.duracaoSegundos
              )
            )}
          </div>
        </div>

        <label
          style="
            display:block;
            margin-top:10px;
          "
        >
          Status

          <select
            class="status-coletivo"
            data-index="${index}"
            style="
              width:100%;
              margin-top:4px;
            "
          >
            ${opcoesStatusHTML(aluno.status)}
          </select>
        </label>

        ${htmlRegraAutomaticaColetiva(aluno)}

        ${htmlJustificativaColetiva(
          aluno,
          index
        )}

        ${htmlAusenciaColetiva(
          aluno,
          index
        )}

        ${htmlReposicaoColetiva(
          aluno,
          index
        )}
      `;

      listaEdicaoAlunosColetivos
        .appendChild(div);
    }
  );

  vincularEventosAlunosColetivos();

  await carregarSelectsReposicaoColetivos();
}

/* =====================================================
   16. EVENTOS DOS ALUNOS COLETIVOS
===================================================== */

function vincularEventosAlunosColetivos() {
  document
    .querySelectorAll(".status-coletivo")
    .forEach((select) => {
      select.addEventListener(
        "change",
        async (event) => {
          const index = Number(
            event.target.dataset.index
          );

          const aluno =
            alunosColetivosEdicao[index];

          aluno.status =
            event.target.value;

          if (
            aluno.status !== STATUS.AUSENTE &&
            aluno.status !== STATUS.CANCELADA &&
            aluno.status !== STATUS.TRANCADA
          ) {
            aluno.justificativa = "";
          }

          if (aluno.status === STATUS.AUSENTE) {
            aluno.aulaGravada = false;
            aluno.precisaReposicao = false;
          }

          if (
            aluno.status === STATUS.CANCELADA ||
            aluno.status === STATUS.TRANCADA
          ) {
            aluno.aulaGravada = false;
            aluno.precisaReposicao = true;
            aluno.aulaOriginalId = null;
          }

          if (
            aluno.status === STATUS.PRESENTE ||
            aluno.status === STATUS.AULA_INSTRUMENTAL ||
            aluno.status === STATUS.PLANTAO_DUVIDAS
          ) {
            aluno.aulaGravada = true;
            aluno.precisaReposicao = false;
            aluno.aulaOriginalId = null;
          }

          if (aluno.status === STATUS.REPOSICAO) {
            aluno.aulaGravada = true;
            aluno.precisaReposicao = false;
          }

          if (
            aluno.status === STATUS.AULA_EXPERIMENTAL
          ) {
            aluno.aulaGravada = false;
            aluno.precisaReposicao = false;
            aluno.aulaOriginalId = null;
          }

          await renderizarAlunosColetivos();
        }
      );
    });

  document
    .querySelectorAll(".justificativa-coletiva")
    .forEach((input) => {
      input.addEventListener(
        "input",
        (event) => {
          const index = Number(
            event.target.dataset.index
          );

          alunosColetivosEdicao[index]
            .justificativa =
              event.target.value;
        }
      );
    });

  document
    .querySelectorAll(".gravada-coletiva")
    .forEach((checkbox) => {
      checkbox.addEventListener(
        "change",
        async (event) => {
          const index = Number(
            event.target.dataset.index
          );

          const aluno =
            alunosColetivosEdicao[index];

          aluno.aulaGravada =
            event.target.checked;

          if (event.target.checked) {
            aluno.precisaReposicao = false;
          }

          await renderizarAlunosColetivos();
        }
      );
    });

  document
    .querySelectorAll(".reposicao-coletiva")
    .forEach((checkbox) => {
      checkbox.addEventListener(
        "change",
        async (event) => {
          const index = Number(
            event.target.dataset.index
          );

          const aluno =
            alunosColetivosEdicao[index];

          aluno.precisaReposicao =
            event.target.checked;

          if (event.target.checked) {
            aluno.aulaGravada = false;
          }

          await renderizarAlunosColetivos();
        }
      );
    });

  document
    .querySelectorAll(".aula-original-coletiva")
    .forEach((select) => {
      select.addEventListener(
        "change",
        (event) => {
          const index = Number(
            event.target.dataset.index
          );

          alunosColetivosEdicao[index]
            .aulaOriginalId =
              event.target.value || null;
        }
      );
    });
}

async function carregarSelectsReposicaoColetivos() {
  const selects = document
    .querySelectorAll(
      ".aula-original-coletiva"
    );

  for (const select of selects) {
    const index = Number(
      select.dataset.index
    );

    const aluno =
      alunosColetivosEdicao[index];

    await preencherSelectAulasPendentes({
      select,
      matriculaId:
        aluno.matriculaId,
      aulaOriginalAtual:
        aluno.aulaOriginalId,
      aulaEmEdicaoId:
        aluno.id
    });
  }
}
/* =====================================================
   17. SALVAR AULA COLETIVA
===================================================== */

async function salvarAulaColetiva(event) {
  event.preventDefault();

  if (!aulasDoGrupo.length) {
    mostrarMensagem(
      "A aula coletiva ainda não foi carregada.",
      false
    );

    return;
  }

  const novaData =
    dataAulaColetiva.value;

  const novoConteudo =
    conteudoColetivo.value.trim();

  const novaLicao =
    licaoColetiva.value.trim();

  if (!novaData) {
    mostrarMensagem(
      "Selecione a data da aula coletiva.",
      false
    );

    return;
  }

  for (
    let index = 0;
    index < alunosColetivosEdicao.length;
    index += 1
  ) {
    const aluno =
      alunosColetivosEdicao[index];

    const erro = validarStatus({
      status: aluno.status,
      justificativa:
        aluno.justificativa,
      aulaGravada:
        aluno.aulaGravada,
      precisaReposicao:
        aluno.precisaReposicao,
      aulaOriginalId:
        aluno.aulaOriginalId
    });

    if (erro) {
      mostrarMensagem(
        `${aluno.nome}: ${erro}`,
        false
      );

      return;
    }
  }

  const confirmou = confirm(
    "Deseja salvar as alterações desta aula coletiva para todos os alunos do grupo?"
  );

  if (!confirmou) {
    return;
  }

  bloquearBotao(
    btnSalvarColetivo,
    "Salvando..."
  );

  for (
    let index = 0;
    index < alunosColetivosEdicao.length;
    index += 1
  ) {
    const aluno =
      alunosColetivosEdicao[index];

    const regras = criarRegrasDoStatus({
      statusNovo: aluno.status,
      statusAnterior:
        aluno.statusOriginal,
      duracaoAnterior:
        aluno.duracaoSegundos,
      aulaGravadaAusente:
        aluno.aulaGravada,
      precisaReposicaoAusente:
        aluno.precisaReposicao,
      aulaOriginalId:
        aluno.aulaOriginalId
    });

    const semConteudo =
      statusDesabilitaConteudo(
        aluno.status
      );

    const payload = {
      data_aula: novaData,
      status: aluno.status,

      justificativa:
        statusExigeJustificativa(
          aluno.status
        )
          ? String(
              aluno.justificativa || ""
            ).trim()
          : null,

      conteudo:
        semConteudo
          ? null
          : novoConteudo || null,

      licao_casa:
        semConteudo ||
        aluno.status ===
          STATUS.AULA_EXPERIMENTAL
          ? null
          : novaLicao || null,

      aula_gravada:
        regras.aula_gravada,

      precisa_reposicao:
        regras.precisa_reposicao,

      aula_original_id:
        regras.aula_original_id,

      reposicao_com_custo:
        regras.reposicao_com_custo,

      duracao_segundos:
        regras.duracao_segundos
    };

    const { error } = await supabase
      .from("aula")
      .update(payload)
      .eq("id", aluno.id)
      .eq(
        "grupo_aula_id",
        String(grupoAulaId)
      )
      .eq("aula_coletiva", true);

    if (error) {
      console.error(
        `Erro ao atualizar aula do aluno ${aluno.nome}:`,
        error
      );

      liberarBotao(btnSalvarColetivo);

      mostrarMensagem(
        `Não foi possível salvar a aula de ${aluno.nome}. Algumas aulas do grupo podem ter sido atualizadas antes do erro.`,
        false
      );

      return;
    }
  }

  liberarBotao(btnSalvarColetivo);

  mostrarMensagem(
    "Aula coletiva atualizada com sucesso!"
  );

  setTimeout(() => {
    voltarParaDetalhesProfessor();
  }, 1000);
}

/* =====================================================
   18. EVENTOS
===================================================== */

statusAulaIndividual?.addEventListener(
  "change",
  async () => {
    await atualizarCamposIndividual({
      preservarAusencia: false
    });
  }
);

aulaGravadaIndividual?.addEventListener(
  "change",
  () => {
    if (aulaGravadaIndividual.checked) {
      precisaReposicaoIndividual.checked =
        false;
    }

    atualizarCardsAusenciaIndividual();
  }
);

precisaReposicaoIndividual?.addEventListener(
  "change",
  () => {
    if (
      precisaReposicaoIndividual.checked
    ) {
      aulaGravadaIndividual.checked =
        false;
    }

    atualizarCardsAusenciaIndividual();
  }
);

formEditarAulaIndividual?.addEventListener(
  "submit",
  salvarAulaIndividual
);

formEditarAulaColetiva?.addEventListener(
  "submit",
  salvarAulaColetiva
);

btnCancelarIndividual?.addEventListener(
  "click",
  voltarParaDetalhesProfessor
);

btnCancelarColetivo?.addEventListener(
  "click",
  voltarParaDetalhesProfessor
);

btnVoltarTopo?.addEventListener(
  "click",
  voltarParaDetalhesProfessor
);

btnVoltarRodape?.addEventListener(
  "click",
  voltarParaDetalhesProfessor
);

/* =====================================================
   19. INICIAR
===================================================== */

async function iniciar() {
  let carregou = false;

  if (ehEdicaoColetiva) {
    carregou =
      await carregarAulaColetiva();
  } else {
    carregou =
      await carregarAulaIndividual();
  }

  boxCarregando.style.display =
    "none";

  if (!carregou) {
    conteudoPagina.style.display =
      "none";

    return;
  }

  conteudoPagina.style.display =
    "block";
}

iniciar();