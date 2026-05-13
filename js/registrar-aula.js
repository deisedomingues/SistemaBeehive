import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

// ==========================================
// 1. ELEMENTOS
// ==========================================
const form = document.getElementById("form-aula");
const inputDataAula = document.getElementById("dataAula");

const aulaIndividualRadio = document.getElementById("aulaIndividual");
const aulaColetivaRadio = document.getElementById("aulaColetiva");
const cardAulaIndividual = document.getElementById("cardAulaIndividual");
const cardAulaColetiva = document.getElementById("cardAulaColetiva");
const avisoAulaColetiva = document.getElementById("avisoAulaColetiva");

const selectMatricula = document.getElementById("matricula");
const listaAlunosBox = document.getElementById("listaAlunos");
const alunosSelecionadosDiv = document.getElementById("alunosSelecionados");

const boxStatusGeral = document.getElementById("boxStatus");
const selectStatusGeral = document.getElementById("status");
const avisoAulaExperimental = document.getElementById("avisoAulaExperimental");
const boxAusenciaGeral = document.getElementById("boxAusencia");
const boxReposicaoGeral = document.getElementById("boxReposicao");

const labelParteAula = document.getElementById("labelParteAula");
const selectParte = document.getElementById("parteAula");
const moduloAula = document.getElementById("moduloAula");

const boxJustificativaGeral = document.getElementById("boxJustificativa");
const inputJustificativa = document.getElementById("justificativa");

const inputConteudo = document.getElementById("conteudo");
const labelLicaoCasa = document.getElementById("labelLicaoCasa");
const inputLicaoCasa = document.getElementById("licaoCasa");

const inputAulaGravada = document.getElementById("aulaGravada");
const inputPrecisaReposicao = document.getElementById("precisaReposicao");

const cardAulaGravada = document.getElementById("cardAulaGravada");
const cardPrecisaReposicao = document.getElementById("cardPrecisaReposicao");

const aulaOriginalIdGeral = document.getElementById("aulaOriginalId");

// Campo antigo. Professor não controla custo nesta tela.
const reposicaoComCustoGeral = document.getElementById("reposicaoComCusto");

let msg = document.getElementById("msg");

let matriculasLista = [];
let materiaColetivaId = null;
let moduloColetivoId = null;

// ==========================================
// 2. STATUS
// ==========================================
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

// ==========================================
// 3. UI / MENSAGENS
// ==========================================
function prepararMensagemAbaixoDoBotao() {
  const botaoSalvar =
    form.querySelector('button[type="submit"]') ||
    form.querySelector("button");

  if (!msg) {
    msg = document.createElement("div");
    msg.id = "msg";
    msg.style.display = "none";
  }

  if (botaoSalvar) {
    botaoSalvar.insertAdjacentElement("afterend", msg);
  }

  msg.style.display = "none";
  msg.style.marginTop = "12px";
  msg.style.marginBottom = "0";
}

function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";
  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";
  msg.style.marginTop = "12px";
  msg.style.marginBottom = "0";
  msg.style.fontWeight = "600";
  msg.style.textAlign = "center";

  msg.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  setTimeout(() => {
    msg.style.display = "none";
  }, 4500);
}

function esconderCampoReposicaoComCusto() {
  if (!reposicaoComCustoGeral) return;

  reposicaoComCustoGeral.checked = false;
  reposicaoComCustoGeral.disabled = true;

  const label = reposicaoComCustoGeral.closest("label");
  const box = reposicaoComCustoGeral.closest("div");

  if (label) {
    label.style.display = "none";
  } else if (box) {
    box.style.display = "none";
  } else {
    reposicaoComCustoGeral.style.display = "none";
  }
}

function ehAulaColetiva() {
  return aulaColetivaRadio.checked;
}

function ehAulaExperimentalGeral() {
  return selectStatusGeral.value === STATUS.AULA_EXPERIMENTAL;
}

function atualizarCardsTipoAula() {
  const isColetivo = ehAulaColetiva();

  if (cardAulaIndividual) {
    cardAulaIndividual.classList.toggle("ativo", !isColetivo);
  }

  if (cardAulaColetiva) {
    cardAulaColetiva.classList.toggle("ativo", isColetivo);
  }

  if (avisoAulaColetiva) {
    avisoAulaColetiva.style.display = isColetivo ? "block" : "none";
  }

  const optionPadrao = selectMatricula.querySelector('option[value=""]');

  if (optionPadrao) {
    optionPadrao.textContent = isColetivo
      ? "Selecione os alunos participantes"
      : "Selecione o aluno";
  }
}

function atualizarCardsAusenciaGeral() {
  if (cardAulaGravada) {
    cardAulaGravada.classList.toggle("ativo", inputAulaGravada.checked);
  }

  if (cardPrecisaReposicao) {
    cardPrecisaReposicao.classList.toggle("ativo", inputPrecisaReposicao.checked);
  }
}

function setarDataHoje() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  inputDataAula.value = `${ano}-${mes}-${dia}`;
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

// ==========================================
// 4. REGRAS
// ==========================================
function statusExigeJustificativa(status) {
  return (
    status === STATUS.AUSENTE ||
    status === STATUS.CANCELADA ||
    status === STATUS.TRANCADA
  );
}

function statusGravaAutomaticamente(status) {
  return (
    status === STATUS.PRESENTE ||
    status === STATUS.REPOSICAO ||
    status === STATUS.AULA_INSTRUMENTAL ||
    status === STATUS.PLANTAO_DUVIDAS
  );
}

function statusNaoGeraReposicao(status) {
  return (
    status === STATUS.PRESENTE ||
    status === STATUS.AULA_INSTRUMENTAL ||
    status === STATUS.PLANTAO_DUVIDAS ||
    status === STATUS.AULA_EXPERIMENTAL
  );
}

function validarJustificativaObrigatoria(status, justificativa) {
  const texto = (justificativa || "").trim();

  if (statusExigeJustificativa(status) && !texto) {
    return `Preencha a justificativa para o status "${status}".`;
  }

  return null;
}

function validarRegraAusente({ status, aulaGravada, precisaReposicao }) {
  if (status !== STATUS.AUSENTE) return null;

  if (!aulaGravada && !precisaReposicao) {
    return 'Em aula ausente, escolha uma opção: "aula foi gravada" ou "precisa de reposição".';
  }

  if (aulaGravada && precisaReposicao) {
    return 'A aula ausente não pode ter "aula gravada" e "precisa de reposição" ao mesmo tempo.';
  }

  return null;
}

function textoStatusAulaOriginal(aula) {
  if (aula.status === STATUS.AUSENTE) {
    return "Ausente — aluno pediu reposição";
  }

  if (aula.status === STATUS.CANCELADA) {
    return "Cancelada — reposição sem custo, responsabilidade da escola";
  }

  if (aula.status === STATUS.TRANCADA) {
    return "Trancada — reposição sem custo";
  }

  return `${aula.status || "Status não informado"} — reposição pendente`;
}

function criarOpcaoAulaPendente(aula) {
  const dataBR = formatarDataBR(aula.data_aula);
  const statusTexto = textoStatusAulaOriginal(aula);

  const justificativa = aula.justificativa?.trim()
    ? ` — ${aula.justificativa.trim()}`
    : "";

  return `
    <option value="${aula.id}">
      ${dataBR} — ${statusTexto}${justificativa}
    </option>
  `;
}

function limparCamposAuxiliaresGerais() {
  boxAusenciaGeral.style.display = "none";
  boxReposicaoGeral.style.display = "none";
  boxJustificativaGeral.style.display = "none";

  inputAulaGravada.checked = false;
  inputPrecisaReposicao.checked = false;
  atualizarCardsAusenciaGeral();

  aulaOriginalIdGeral.innerHTML = `<option value="">Selecione o aluno primeiro</option>`;

  if (reposicaoComCustoGeral) {
    reposicaoComCustoGeral.checked = false;
    reposicaoComCustoGeral.disabled = true;
  }

  inputJustificativa.value = "";
}

function limparEstadoColetivo() {
  matriculasLista = [];
  materiaColetivaId = null;
  moduloColetivoId = null;
  alunosSelecionadosDiv.innerHTML = "";
  listaAlunosBox.style.display = "none";
}

function atualizarBoxJustificativaGeral() {
  const status = selectStatusGeral.value;
  boxJustificativaGeral.style.display = statusExigeJustificativa(status)
    ? "block"
    : "none";
}

function atualizarCamposTextoPorStatusGeral() {
  const status = selectStatusGeral.value;

  const desabilitarConteudo =
    status === STATUS.CANCELADA ||
    status === STATUS.TRANCADA;

  inputConteudo.disabled = desabilitarConteudo;

  if (desabilitarConteudo) {
    inputConteudo.value = "";
  }

  if (status === STATUS.AULA_EXPERIMENTAL) {
    inputLicaoCasa.value = "";
    inputLicaoCasa.disabled = true;
  } else {
    inputLicaoCasa.disabled = desabilitarConteudo;

    if (desabilitarConteudo) {
      inputLicaoCasa.value = "";
    }
  }
}

function atualizarCamposAulaExperimental() {
  const ehExperimental = ehAulaExperimentalGeral();

  if (avisoAulaExperimental) {
    avisoAulaExperimental.style.display = ehExperimental ? "block" : "none";
  }

  if (labelParteAula) {
    labelParteAula.style.display = ehExperimental ? "none" : "block";
  }

  if (labelLicaoCasa) {
    labelLicaoCasa.style.display = ehExperimental ? "none" : "block";
  }

  if (ehExperimental) {
    selectParte.value = "1";
    inputLicaoCasa.value = "";
    inputAulaGravada.checked = false;
    inputPrecisaReposicao.checked = false;
  }
}

function gerarGrupoAulaId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `grupo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizarAlunoPorStatus(aluno) {
  const status = aluno.status;

  if (status === STATUS.PRESENTE) {
    aluno.aulaGravada = true;
    aluno.precisaReposicao = false;
    aluno.justificativa = "";
    aluno.aulaOriginalId = null;
    aluno.reposicaoComCusto = false;
    aluno.duracaoSegundos = null;
    return;
  }

  if (status === STATUS.AUSENTE) {
    if (aluno.aulaGravada && aluno.precisaReposicao) {
      aluno.precisaReposicao = false;
    }

    aluno.aulaOriginalId = null;
    aluno.reposicaoComCusto = false;
    aluno.duracaoSegundos = null;
    return;
  }

  if (status === STATUS.CANCELADA || status === STATUS.TRANCADA) {
    aluno.aulaGravada = false;
    aluno.precisaReposicao = true;
    aluno.aulaOriginalId = null;
    aluno.reposicaoComCusto = false;
    aluno.duracaoSegundos = null;
    return;
  }

  if (status === STATUS.REPOSICAO) {
    aluno.aulaGravada = true;
    aluno.precisaReposicao = false;
    aluno.reposicaoComCusto = false;
    aluno.duracaoSegundos = null;
    return;
  }

  if (status === STATUS.AULA_INSTRUMENTAL || status === STATUS.PLANTAO_DUVIDAS) {
    aluno.aulaGravada = true;
    aluno.precisaReposicao = false;
    aluno.justificativa = "";
    aluno.aulaOriginalId = null;
    aluno.reposicaoComCusto = false;
    aluno.duracaoSegundos = null;
    return;
  }

  if (status === STATUS.AULA_EXPERIMENTAL) {
    aluno.aulaGravada = false;
    aluno.precisaReposicao = false;
    aluno.justificativa = "";
    aluno.aulaOriginalId = null;
    aluno.reposicaoComCusto = false;
    aluno.duracaoSegundos = DURACAO_AULA_EXPERIMENTAL_SEGUNDOS;
    return;
  }
}

function aplicarRegrasStatusGeral() {
  const status = selectStatusGeral.value;

  boxAusenciaGeral.style.display = status === STATUS.AUSENTE ? "block" : "none";
  boxReposicaoGeral.style.display = status === STATUS.REPOSICAO ? "block" : "none";

  if (status === STATUS.AUSENTE) {
    inputAulaGravada.checked = false;
    inputPrecisaReposicao.checked = false;
  } else if (status === STATUS.CANCELADA || status === STATUS.TRANCADA) {
    inputAulaGravada.checked = false;
    inputPrecisaReposicao.checked = true;
  } else if (status === STATUS.REPOSICAO) {
    inputAulaGravada.checked = true;
    inputPrecisaReposicao.checked = false;
  } else if (status === STATUS.AULA_EXPERIMENTAL) {
    inputAulaGravada.checked = false;
    inputPrecisaReposicao.checked = false;
  } else if (statusNaoGeraReposicao(status)) {
    inputAulaGravada.checked = statusGravaAutomaticamente(status);
    inputPrecisaReposicao.checked = false;
  } else {
    inputAulaGravada.checked = false;
    inputPrecisaReposicao.checked = false;
  }

  atualizarCardsAusenciaGeral();

  if (status !== STATUS.REPOSICAO) {
    aulaOriginalIdGeral.innerHTML = `<option value="">Selecione o aluno primeiro</option>`;
  }

  if (reposicaoComCustoGeral) {
    reposicaoComCustoGeral.checked = false;
    reposicaoComCustoGeral.disabled = true;
  }

  if (!statusExigeJustificativa(status)) {
    inputJustificativa.value = "";
  }

  atualizarBoxJustificativaGeral();
  atualizarCamposTextoPorStatusGeral();
  atualizarCamposAulaExperimental();
  esconderCampoReposicaoComCusto();
}

// ==========================================
// 5. BUSCAS
// ==========================================
async function buscarAulasPendentes(matriculaId) {
  const { data: pendentes, error: errorPendentes } = await supabase
    .from("aula")
    .select("id, data_aula, status, justificativa")
    .eq("matricula_id", matriculaId)
    .eq("precisa_reposicao", true)
    .in("status", [STATUS.AUSENTE, STATUS.CANCELADA, STATUS.TRANCADA])
    .order("data_aula", { ascending: true });

  if (errorPendentes) {
    console.error("Erro ao buscar aulas pendentes:", errorPendentes);
    return [];
  }

  const { data: reposicoesJaRegistradas, error: errorReposicoes } = await supabase
    .from("aula")
    .select("aula_original_id")
    .eq("matricula_id", matriculaId)
    .eq("status", STATUS.REPOSICAO)
    .not("aula_original_id", "is", null);

  if (errorReposicoes) {
    console.error("Erro ao buscar reposições já registradas:", errorReposicoes);
    return pendentes || [];
  }

  const idsJaRepostos = new Set(
    (reposicoesJaRegistradas || []).map((item) => Number(item.aula_original_id))
  );

  return (pendentes || []).filter(
    (aula) => !idsJaRepostos.has(Number(aula.id))
  );
}

async function buscarMaiorParteDaMatriculaNaData(matriculaId, dataAula) {
  if (!matriculaId || !dataAula) return 0;

  const { data, error } = await supabase
    .from("aula")
    .select("parte")
    .eq("matricula_id", matriculaId)
    .eq("data_aula", dataAula)
    .order("parte", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar maior parte da aula:", error);
    return 0;
  }

  const maiorParte = Number(data?.[0]?.parte || 0);
  return maiorParte;
}

async function buscarProximaParteParaMatricula(matriculaId, dataAula) {
  const maiorParte = await buscarMaiorParteDaMatriculaNaData(matriculaId, dataAula);
  return maiorParte + 1;
}

async function buscarProximaParteParaVariasMatriculas(matriculasIds, dataAula) {
  if (!matriculasIds.length || !dataAula) return 1;

  const maioresPartes = await Promise.all(
    matriculasIds.map((id) => buscarMaiorParteDaMatriculaNaData(id, dataAula))
  );

  const maiorParteGeral = Math.max(...maioresPartes, 0);
  return maiorParteGeral + 1;
}

function garantirOpcaoParte(valorParte) {
  if (!selectParte) return;

  const valor = String(valorParte);

  const jaExiste = Array.from(selectParte.options).some(
    (opt) => opt.value === valor
  );

  if (!jaExiste) {
    const opt = document.createElement("option");
    opt.value = valor;
    opt.textContent = `Parte ${valor}`;
    selectParte.appendChild(opt);
  }
}

async function atualizarParteAutomatica() {
  const dataAula = inputDataAula.value;

  if (ehAulaExperimentalGeral()) {
    garantirOpcaoParte(1);
    selectParte.value = "1";
    return;
  }

  if (!dataAula) {
    garantirOpcaoParte(1);
    selectParte.value = "1";
    return;
  }

  if (ehAulaColetiva()) {
    const idsSelecionados = matriculasLista.map((aluno) => aluno.id);

    if (!idsSelecionados.length) {
      garantirOpcaoParte(1);
      selectParte.value = "1";
      return;
    }

    const proximaParte = await buscarProximaParteParaVariasMatriculas(
      idsSelecionados,
      dataAula
    );

    garantirOpcaoParte(proximaParte);
    selectParte.value = String(proximaParte);
    return;
  }

  const matriculaId = selectMatricula.value;

  if (!matriculaId) {
    garantirOpcaoParte(1);
    selectParte.value = "1";
    return;
  }

  const proximaParte = await buscarProximaParteParaMatricula(
    matriculaId,
    dataAula
  );

  garantirOpcaoParte(proximaParte);
  selectParte.value = String(proximaParte);
}

async function validarParteNaoDuplicada(registros) {
  for (const registro of registros) {
    const { data, error } = await supabase
      .from("aula")
      .select("id")
      .eq("matricula_id", registro.matricula_id)
      .eq("data_aula", registro.data_aula)
      .eq("parte", registro.parte)
      .limit(1);

    if (error) {
      console.error("Erro ao validar parte duplicada:", error);
      return "Não foi possível validar se esta parte da aula já existe.";
    }

    if (data && data.length > 0) {
      return `Já existe uma Parte ${registro.parte} registrada para este aluno nesta data. O sistema ajustou automaticamente, mas revise antes de salvar.`;
    }
  }

  return null;
}

async function carregarMatriculas() {
  const professorId = Number(localStorage.getItem("professorId"));

  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      materia_id,
      modulo_id,
      aluno:aluno_id(nome),
      materia:materia_id(nome),
      modulo:modulo_id(nome)
    `)
    .eq("professor_id", professorId)
    .eq("ativa", true);

  if (error) {
    console.error("Erro ao carregar matrículas:", error);
    selectMatricula.innerHTML = `<option value="">Erro ao carregar alunos</option>`;
    return;
  }

  selectMatricula.innerHTML = `<option value="">Selecione o aluno</option>`;

  (data || [])
    .sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome))
    .forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.aluno.nome} — ${m.materia.nome}`;
      opt.dataset.materiaId = m.materia_id;
      opt.dataset.moduloAtual = m.modulo_id;
      opt.dataset.materiaNome = m.materia.nome;
      opt.dataset.moduloNome = m.modulo?.nome || "Módulo não informado";
      selectMatricula.appendChild(opt);
    });

  atualizarCardsTipoAula();
}

async function carregarModulos(materiaId, moduloAtual = null) {
  if (!materiaId) {
    moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;
    return;
  }

  const { data, error } = await supabase
    .from("modulo")
    .select("id, nome")
    .eq("materia_id", materiaId)
    .order("ordem");

  if (error) {
    console.error("Erro ao carregar módulos:", error);
    moduloAula.innerHTML = `<option value="">Erro ao carregar módulos</option>`;
    return;
  }

  moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;

  (data || []).forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.nome;

    if (moduloAtual && String(m.id) === String(moduloAtual)) {
      opt.selected = true;
    }

    moduloAula.appendChild(opt);
  });
}

async function carregarAulasPendentesGeral() {
  const matriculaId = selectMatricula.value;

  if (!matriculaId) {
    aulaOriginalIdGeral.innerHTML = `<option value="">Selecione o aluno primeiro</option>`;
    return;
  }

  const pendentes = await buscarAulasPendentes(matriculaId);

  if (!pendentes.length) {
    aulaOriginalIdGeral.innerHTML = `
      <option value="">Este aluno não possui aulas pendentes de reposição</option>
    `;

    mostrarMensagem(
      "Este aluno não possui aulas ausentes, canceladas ou trancadas pendentes para reposição.",
      false
    );
    return;
  }

  aulaOriginalIdGeral.innerHTML = `<option value="">Selecione a aula original...</option>`;

  pendentes.forEach((aula) => {
    aulaOriginalIdGeral.insertAdjacentHTML("beforeend", criarOpcaoAulaPendente(aula));
  });
}

// ==========================================
// 6. AULA COLETIVA
// ==========================================
function htmlOpcoesAusenciaColetiva(aluno, index) {
  return `
    <div class="box-regra-ausencia" style="margin-top:10px;">
      <h3>Regra da ausência</h3>

      <p>
        Escolha apenas uma opção para este aluno.
      </p>

      <label style="font-size:13px; display:block; margin-bottom:10px;">
        Justificativa
        <input
          type="text"
          class="justificativa-ind"
          data-index="${index}"
          value="${aluno.justificativa || ""}"
          placeholder="Ex: viagem / compromisso / aviso à escola"
          style="width:100%; margin-top:5px;"
        >
      </label>

      <div class="opcoes-ausencia">
        <label class="card-opcao-ausencia ${aluno.aulaGravada ? "ativo" : ""}">
          <input
            type="checkbox"
            class="gravada-ind"
            data-index="${index}"
            ${aluno.aulaGravada ? "checked" : ""}
          >
          <span>
            <strong>Aula foi gravada</strong>
            <small>O aluno poderá assistir ao conteúdo depois.</small>
          </span>
        </label>

        <label class="card-opcao-ausencia ${aluno.precisaReposicao ? "ativo" : ""}">
          <input
            type="checkbox"
            class="reposicao-ind"
            data-index="${index}"
            ${aluno.precisaReposicao ? "checked" : ""}
          >
          <span>
            <strong>Precisa de reposição</strong>
            <small>A aula não foi gravada e deverá ser reposta.</small>
          </span>
        </label>
      </div>
    </div>
  `;
}

async function renderizarAlunosColetivo() {
  alunosSelecionadosDiv.innerHTML = "";

  for (const [index, aluno] of matriculasLista.entries()) {
    normalizarAlunoPorStatus(aluno);

    let htmlExtras = "";

    if (aluno.status === STATUS.AUSENTE) {
      htmlExtras = htmlOpcoesAusenciaColetiva(aluno, index);
    } else if (aluno.status === STATUS.CANCELADA) {
      htmlExtras = `
        <div class="box-info-status">
          <label style="font-size:13px; display:block;">
            Justificativa
            <input
              type="text"
              class="justificativa-ind"
              data-index="${index}"
              value="${aluno.justificativa || ""}"
              placeholder="Ex: professor sem luz / escola fechada / problema interno"
              style="width:100%; margin-top:5px;"
            >
          </label>

          <small style="display:block; margin-top:6px; color:#666;">
            Aula cancelada será salva automaticamente como sem gravação e com reposição pendente.
          </small>
        </div>
      `;
    } else if (aluno.status === STATUS.TRANCADA) {
      htmlExtras = `
        <div class="box-info-status">
          <label style="font-size:13px; display:block;">
            Justificativa
            <input
              type="text"
              class="justificativa-ind"
              data-index="${index}"
              value="${aluno.justificativa || ""}"
              placeholder="Ex: aluno solicitou trancamento no período"
              style="width:100%; margin-top:5px;"
            >
          </label>

          <small style="display:block; margin-top:6px; color:#666;">
            Aula trancada será salva automaticamente como sem gravação e com reposição pendente.
          </small>
        </div>
      `;
    } else if (aluno.status === STATUS.REPOSICAO) {
      const pendentes = await buscarAulasPendentes(aluno.id);
      const semPendencias = !pendentes.length;

      htmlExtras = `
        <div class="box-info-status">
          <label style="font-size:13px; font-weight:bold; display:block; margin-bottom:6px;">
            Aula original
          </label>

          <select class="aula-original-ind" data-index="${index}" style="width:100%; margin-bottom:8px; font-size:12px;">
            ${
              semPendencias
                ? `<option value="">Este aluno não possui aulas pendentes de reposição</option>`
                : `<option value="">Selecione a aula original...</option>${pendentes
                    .map((p) => criarOpcaoAulaPendente(p))
                    .join("")}`
            }
          </select>

          ${
            semPendencias
              ? `<small style="display:block; color:#b71c1c; margin-bottom:8px;">
                  Este aluno não possui aula pendente para vincular a esta reposição.
                </small>`
              : `<small style="display:block; color:#555;">
                  A reposição não consome pacote novamente. Ela apenas quita uma aula anterior.
                </small>`
          }
        </div>
      `;
    } else if (
      aluno.status === STATUS.AULA_INSTRUMENTAL ||
      aluno.status === STATUS.PLANTAO_DUVIDAS
    ) {
      htmlExtras = `
        <div class="box-info-status">
          Esta aula será salva como gravada e não gera reposição.
        </div>
      `;
    }

    const div = document.createElement("div");
    div.className = "aluno-box";

    div.innerHTML = `
      <button
        type="button"
        class="btn-remover-aluno"
        data-index="${index}"
      >
        ✕
      </button>

      <strong>${aluno.nome}</strong><br>

      <small style="display:block; margin-top:4px; color:#555;">
        Curso: ${aluno.materiaNome}
      </small>

      <small style="display:block; margin-top:2px; color:#555;">
        Módulo: ${aluno.moduloNome || "Módulo não informado"}
      </small>

      <select
        class="status-individual"
        data-index="${index}"
        style="width:100%; margin-top:8px; padding:8px; border-radius:6px;"
      >
        <option value="${STATUS.PRESENTE}" ${aluno.status === STATUS.PRESENTE ? "selected" : ""}>Presente</option>
        <option value="${STATUS.AUSENTE}" ${aluno.status === STATUS.AUSENTE ? "selected" : ""}>Ausente</option>
        <option value="${STATUS.CANCELADA}" ${aluno.status === STATUS.CANCELADA ? "selected" : ""}>Cancelada</option>
        <option value="${STATUS.TRANCADA}" ${aluno.status === STATUS.TRANCADA ? "selected" : ""}>Trancada</option>
        <option value="${STATUS.REPOSICAO}" ${aluno.status === STATUS.REPOSICAO ? "selected" : ""}>Reposição</option>
        <option value="${STATUS.AULA_INSTRUMENTAL}" ${aluno.status === STATUS.AULA_INSTRUMENTAL ? "selected" : ""}>Aula Instrumental</option>
        <option value="${STATUS.PLANTAO_DUVIDAS}" ${aluno.status === STATUS.PLANTAO_DUVIDAS ? "selected" : ""}>Plantão de dúvidas</option>
      </select>

      ${htmlExtras}
    `;

    alunosSelecionadosDiv.appendChild(div);

    if (aluno.status === STATUS.REPOSICAO) {
      const selectAula = div.querySelector(".aula-original-ind");
      if (selectAula && aluno.aulaOriginalId) {
        selectAula.value = aluno.aulaOriginalId;
      }
    }
  }

  vincularEventosIndividuais();
}

function vincularEventosIndividuais() {
  document.querySelectorAll(".status-individual").forEach((sel) => {
    sel.onchange = async (e) => {
      const index = Number(e.target.dataset.index);
      const novoStatus = e.target.value;

      matriculasLista[index].status = novoStatus;

      if (
        novoStatus !== STATUS.AUSENTE &&
        novoStatus !== STATUS.CANCELADA &&
        novoStatus !== STATUS.TRANCADA
      ) {
        matriculasLista[index].justificativa = "";
      }

      if (novoStatus !== STATUS.REPOSICAO) {
        matriculasLista[index].aulaOriginalId = null;
        matriculasLista[index].reposicaoComCusto = false;
      }

      if (novoStatus === STATUS.AUSENTE) {
        matriculasLista[index].aulaGravada = false;
        matriculasLista[index].precisaReposicao = false;
      }

      normalizarAlunoPorStatus(matriculasLista[index]);
      await renderizarAlunosColetivo();
      await atualizarParteAutomatica();
    };
  });

  document.querySelectorAll(".gravada-ind").forEach((chk) => {
    chk.onchange = async (e) => {
      const index = Number(e.target.dataset.index);
      matriculasLista[index].aulaGravada = e.target.checked;

      if (e.target.checked) {
        matriculasLista[index].precisaReposicao = false;
      }

      await renderizarAlunosColetivo();
      await atualizarParteAutomatica();
    };
  });

  document.querySelectorAll(".reposicao-ind").forEach((chk) => {
    chk.onchange = async (e) => {
      const index = Number(e.target.dataset.index);
      matriculasLista[index].precisaReposicao = e.target.checked;

      if (e.target.checked) {
        matriculasLista[index].aulaGravada = false;
      }

      await renderizarAlunosColetivo();
      await atualizarParteAutomatica();
    };
  });

  document.querySelectorAll(".justificativa-ind").forEach((input) => {
    input.oninput = (e) => {
      const index = Number(e.target.dataset.index);
      matriculasLista[index].justificativa = e.target.value;
    };
  });

  document.querySelectorAll(".aula-original-ind").forEach((sel) => {
    sel.onchange = (e) => {
      const index = Number(e.target.dataset.index);
      matriculasLista[index].aulaOriginalId = e.target.value || null;
      matriculasLista[index].reposicaoComCusto = false;
    };
  });

  document.querySelectorAll(".btn-remover-aluno").forEach((btn) => {
    btn.onclick = async (e) => {
      const idx = Number(e.target.closest("button").dataset.index);
      matriculasLista.splice(idx, 1);

      if (matriculasLista.length === 0) {
        limparEstadoColetivo();
        moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;
        await atualizarParteAutomatica();
        return;
      }

      await renderizarAlunosColetivo();
      await atualizarParteAutomatica();
    };
  });
}

// ==========================================
// 7. EVENTOS
// ==========================================
async function alternarTipoAula() {
  const isColetivo = ehAulaColetiva();

  atualizarCardsTipoAula();

  if (boxStatusGeral) {
    boxStatusGeral.style.display = isColetivo ? "none" : "block";

    if (isColetivo) {
      selectStatusGeral.removeAttribute("required");
    } else {
      selectStatusGeral.setAttribute("required", "required");
    }
  }

  limparCamposAuxiliaresGerais();
  atualizarCamposTextoPorStatusGeral();

  if (!isColetivo) {
    limparEstadoColetivo();
    moduloAula.innerHTML = `<option value="">Selecione o módulo</option>`;
  } else {
    listaAlunosBox.style.display = matriculasLista.length > 0 ? "block" : "none";

    if (matriculasLista.length > 0) {
      await renderizarAlunosColetivo();
    }
  }

  atualizarCamposAulaExperimental();
  await atualizarParteAutomatica();
  esconderCampoReposicaoComCusto();
}

aulaIndividualRadio.addEventListener("change", alternarTipoAula);
aulaColetivaRadio.addEventListener("change", alternarTipoAula);

inputDataAula.addEventListener("change", async () => {
  await atualizarParteAutomatica();

  if (!ehAulaColetiva() && selectStatusGeral.value === STATUS.REPOSICAO) {
    await carregarAulasPendentesGeral();
  }
});

selectMatricula.addEventListener("change", async () => {
  const id = selectMatricula.value;

  if (!id) {
    await atualizarParteAutomatica();
    return;
  }

  const opt = selectMatricula.selectedOptions[0];
  const materiaId = opt.dataset.materiaId;
  const moduloAtual = opt.dataset.moduloAtual;
  const materiaNome = opt.dataset.materiaNome;
  const moduloNome = opt.dataset.moduloNome;

  if (ehAulaColetiva()) {
    const jaExiste = matriculasLista.find((a) => String(a.id) === String(id));

    if (jaExiste) {
      mostrarMensagem("Esse aluno já foi adicionado na aula coletiva.", false);
      selectMatricula.value = "";
      return;
    }

    if (matriculasLista.length === 0) {
      materiaColetivaId = materiaId;
      moduloColetivoId = moduloAtual;

      await carregarModulos(materiaId, moduloAtual);
      moduloAula.value = moduloAtual;
    } else {
      if (String(materiaId) !== String(materiaColetivaId)) {
        mostrarMensagem(
          "Em aula coletiva, todos os alunos precisam ser do mesmo curso.",
          false
        );
        selectMatricula.value = "";
        return;
      }

      if (String(moduloAtual) !== String(moduloColetivoId)) {
        mostrarMensagem(
          "Em aula coletiva, todos os alunos precisam ser do mesmo módulo.",
          false
        );
        selectMatricula.value = "";
        return;
      }
    }

    const novoAluno = {
      id: id,
      nome: opt.textContent,
      materiaId: materiaId,
      materiaNome: materiaNome,
      moduloAtual: moduloAtual,
      moduloNome: moduloNome,
      status: STATUS.PRESENTE,
      aulaGravada: true,
      precisaReposicao: false,
      justificativa: "",
      aulaOriginalId: null,
      reposicaoComCusto: false,
      duracaoSegundos: null
    };

    matriculasLista.push(novoAluno);

    listaAlunosBox.style.display = "block";
    await renderizarAlunosColetivo();
    await atualizarParteAutomatica();

    selectMatricula.value = "";
    atualizarCardsTipoAula();
    return;
  }

  await carregarModulos(materiaId, moduloAtual);
  await atualizarParteAutomatica();

  if (selectStatusGeral.value === STATUS.REPOSICAO) {
    await carregarAulasPendentesGeral();
  }
});

selectStatusGeral.addEventListener("change", async () => {
  aplicarRegrasStatusGeral();

  if (selectStatusGeral.value === STATUS.REPOSICAO) {
    await carregarAulasPendentesGeral();
  }

  await atualizarParteAutomatica();
  esconderCampoReposicaoComCusto();
});

inputPrecisaReposicao.addEventListener("change", () => {
  if (inputPrecisaReposicao.checked) {
    inputAulaGravada.checked = false;
  }

  atualizarCardsAusenciaGeral();
  atualizarBoxJustificativaGeral();
});

inputAulaGravada.addEventListener("change", () => {
  if (inputAulaGravada.checked) {
    inputPrecisaReposicao.checked = false;
  }

  atualizarCardsAusenciaGeral();
  atualizarBoxJustificativaGeral();
});

// ==========================================
// 8. MONTAR REGISTRO
// ==========================================
function montarRegistroBase({
  matriculaId,
  professorId,
  dataAula,
  parte,
  moduloId,
  status,
  justificativa,
  conteudo,
  licaoCasa,
  aulaOriginalId,
  aulaGravada,
  precisaReposicao,
  aulaColetiva = false,
  grupoAulaId = null,
  quantidadeAlunos = 1
}) {
  const ehSemConteudo =
    status === STATUS.CANCELADA ||
    status === STATUS.TRANCADA;

  const ehReposicao = status === STATUS.REPOSICAO;
  const ehAulaExperimental = status === STATUS.AULA_EXPERIMENTAL;

  return {
    matricula_id: Number(matriculaId),
    professor_id: professorId,
    data_aula: dataAula,
    parte: ehAulaExperimental ? 1 : Number(parte),
    modulo_id: moduloId,
    status: status,
    justificativa: statusExigeJustificativa(status) ? justificativa.trim() : null,
    conteudo: ehSemConteudo ? null : (conteudo || null),
    licao_casa: ehAulaExperimental || ehSemConteudo ? null : (licaoCasa || null),
    aula_original_id: ehReposicao ? Number(aulaOriginalId) : null,
    reposicao_com_custo: false,
    aula_gravada: ehAulaExperimental ? false : !!aulaGravada,
    precisa_reposicao: ehAulaExperimental ? false : !!precisaReposicao,
    duracao_segundos: ehAulaExperimental ? DURACAO_AULA_EXPERIMENTAL_SEGUNDOS : null,
    aula_coletiva: !!aulaColetiva,
    grupo_aula_id: aulaColetiva ? grupoAulaId : null,
    quantidade_alunos: Number(quantidadeAlunos || 1)
  };
}

// ==========================================
// 9. SUBMIT
// ==========================================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const professorId = Number(localStorage.getItem("professorId"));
  const moduloId = Number(moduloAula.value);
  const conteudo = inputConteudo.value.trim();
  const licaoCasa = inputLicaoCasa.value.trim();

  if (!moduloId) {
    mostrarMensagem("Selecione o módulo.", false);
    return;
  }

  let registros = [];

  if (ehAulaColetiva()) {
    if (matriculasLista.length === 0) {
      mostrarMensagem("Adicione pelo menos um aluno.", false);
      return;
    }

    if (matriculasLista.length < 2) {
      mostrarMensagem("Para aula coletiva, adicione pelo menos 2 alunos.", false);
      return;
    }

    const modulosDosAlunos = new Set(
      matriculasLista.map((aluno) => String(aluno.moduloAtual))
    );

    if (modulosDosAlunos.size > 1) {
      mostrarMensagem(
        "Em aula coletiva, todos os alunos precisam ser do mesmo módulo.",
        false
      );
      return;
    }

    if (String(moduloId) !== String(moduloColetivoId)) {
      mostrarMensagem(
        "O módulo selecionado precisa ser o mesmo módulo dos alunos da aula coletiva.",
        false
      );
      return;
    }

    await atualizarParteAutomatica();

    const grupoAulaId = gerarGrupoAulaId();
    const quantidadeAlunos = matriculasLista.length;

    for (const aluno of matriculasLista) {
      normalizarAlunoPorStatus(aluno);

      const erroJustificativa = validarJustificativaObrigatoria(
        aluno.status,
        aluno.justificativa || ""
      );

      if (erroJustificativa) {
        mostrarMensagem(`Aluno ${aluno.nome}: ${erroJustificativa}`, false);
        return;
      }

      const erroAusente = validarRegraAusente({
        status: aluno.status,
        aulaGravada: aluno.aulaGravada,
        precisaReposicao: aluno.precisaReposicao
      });

      if (erroAusente) {
        mostrarMensagem(`Aluno ${aluno.nome}: ${erroAusente}`, false);
        return;
      }

      if (aluno.status === STATUS.REPOSICAO && !aluno.aulaOriginalId) {
        mostrarMensagem(
          `Aluno ${aluno.nome}: selecione a aula original da reposição.`,
          false
        );
        return;
      }

      registros.push(
        montarRegistroBase({
          matriculaId: aluno.id,
          professorId,
          dataAula: inputDataAula.value,
          parte: selectParte.value,
          moduloId,
          status: aluno.status,
          justificativa: aluno.justificativa || "",
          conteudo,
          licaoCasa,
          aulaOriginalId: aluno.aulaOriginalId,
          aulaGravada: aluno.aulaGravada,
          precisaReposicao: aluno.precisaReposicao,
          aulaColetiva: true,
          grupoAulaId,
          quantidadeAlunos
        })
      );
    }
  } else {
    const status = selectStatusGeral.value;
    const matriculaId = selectMatricula.value;
    const justificativa = inputJustificativa.value.trim();

    if (!matriculaId) {
      mostrarMensagem("Selecione o aluno.", false);
      return;
    }

    if (!status) {
      mostrarMensagem("Selecione o status da aula.", false);
      return;
    }

    await atualizarParteAutomatica();

    const erroJustificativa = validarJustificativaObrigatoria(status, justificativa);

    if (erroJustificativa) {
      mostrarMensagem(erroJustificativa, false);
      return;
    }

    const erroAusente = validarRegraAusente({
      status,
      aulaGravada: inputAulaGravada.checked,
      precisaReposicao: inputPrecisaReposicao.checked
    });

    if (erroAusente) {
      mostrarMensagem(erroAusente, false);
      return;
    }

    if (status === STATUS.REPOSICAO && !aulaOriginalIdGeral.value) {
      mostrarMensagem("Selecione a aula original da reposição.", false);
      return;
    }

    let aulaGravada = false;
    let precisaReposicao = false;

    if (status === STATUS.AUSENTE) {
      aulaGravada = inputAulaGravada.checked;
      precisaReposicao = inputPrecisaReposicao.checked;
    } else if (status === STATUS.CANCELADA || status === STATUS.TRANCADA) {
      aulaGravada = false;
      precisaReposicao = true;
    } else if (status === STATUS.AULA_EXPERIMENTAL) {
      aulaGravada = false;
      precisaReposicao = false;
    } else if (statusGravaAutomaticamente(status)) {
      aulaGravada = true;
      precisaReposicao = false;
    }

    registros = [
      montarRegistroBase({
        matriculaId,
        professorId,
        dataAula: inputDataAula.value,
        parte: selectParte.value,
        moduloId,
        status,
        justificativa,
        conteudo,
        licaoCasa,
        aulaOriginalId: aulaOriginalIdGeral.value,
        aulaGravada,
        precisaReposicao,
        aulaColetiva: false,
        grupoAulaId: null,
        quantidadeAlunos: 1
      })
    ];
  }

  const erroParteDuplicada = await validarParteNaoDuplicada(registros);

  if (erroParteDuplicada) {
    mostrarMensagem(erroParteDuplicada, false);
    await atualizarParteAutomatica();
    return;
  }

  const { error } = await supabase.from("aula").insert(registros);

  if (error) {
    console.error("Erro ao salvar aulas:", error);
    mostrarMensagem("Erro ao salvar os dados.", false);
    return;
  }

  mostrarMensagem("Aula(s) registrada(s) com sucesso!");

  setTimeout(() => {
    location.reload();
  }, 1500);
});

// ==========================================
// 10. INICIAR
// ==========================================
async function iniciar() {
  prepararMensagemAbaixoDoBotao();
  esconderCampoReposicaoComCusto();
  setarDataHoje();

  await carregarMatriculas();

  aplicarRegrasStatusGeral();
  atualizarCardsTipoAula();
  await atualizarParteAutomatica();
}

iniciar();