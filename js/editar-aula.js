import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

// ===============================
// ID DA AULA
// ===============================

const params = new URLSearchParams(window.location.search);

const aulaId =
  params.get("id") ||
  localStorage.getItem("aulaSelecionadaEdicao");

const matriculaAnterior =
  localStorage.getItem("matriculaSelecionadaEdicao") ||
  localStorage.getItem("matriculaSelecionada");

// ===============================
// ELEMENTOS
// ===============================

const msg = document.getElementById("msg");

const infoAluno = document.getElementById("infoAluno");
const infoMateria = document.getElementById("infoMateria");
const infoModulo = document.getElementById("infoModulo");
const infoProfessor = document.getElementById("infoProfessor");
const infoData = document.getElementById("infoData");
const infoStatus = document.getElementById("infoStatus");
const infoParte = document.getElementById("infoParte");
const infoRegras = document.getElementById("infoRegras");

const formEditarAula = document.getElementById("formEditarAula");
const conteudo = document.getElementById("conteudo");
const licaoCasa = document.getElementById("licaoCasa");
const justificativa = document.getElementById("justificativa");

const btnSalvar = document.getElementById("btnSalvar");
const btnCancelar = document.getElementById("btnCancelar");
const btnVoltarTopo = document.getElementById("btnVoltarTopo");
const btnVoltarRodape = document.getElementById("btnVoltarRodape");

let aulaAtual = null;

// ===============================
// FUNÇÕES AUXILIARES
// ===============================

function mostrarMensagem(texto, ok = true) {
  if (!msg) return;

  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";
  msg.style.padding = "10px 12px";
  msg.style.borderRadius = "10px";

  setTimeout(() => {
    msg.style.display = "none";
  }, 3000);
}

function formatarDataBR(dataISO) {
  if (!dataISO) return "-";

  const texto = String(dataISO);

  if (texto.includes("T")) {
    const data = new Date(texto);

    if (!Number.isNaN(data.getTime())) {
      return data.toLocaleDateString("pt-BR");
    }
  }

  const [yyyy, mm, dd] = texto.split("-");

  if (!yyyy || !mm || !dd) {
    return texto;
  }

  return `${dd}/${mm}/${yyyy}`;
}

function textoSimNao(valor) {
  return valor === true ? "Sim" : "Não";
}

function textoParte(parte) {
  if (!parte) return "Parte não informada";
  return `Parte ${parte}`;
}

function voltarParaDetalhesAluno() {
  const matriculaId = aulaAtual?.matricula_id || matriculaAnterior;

  if (matriculaId) {
    localStorage.setItem("matriculaSelecionada", String(matriculaId));
  }

  window.location.href = "detalhes-aluno.html";
}

function bloquearFormulario() {
  conteudo.disabled = true;
  licaoCasa.disabled = true;
  justificativa.disabled = true;
  btnSalvar.disabled = true;
}

function liberarFormulario() {
  conteudo.disabled = false;
  licaoCasa.disabled = false;
  justificativa.disabled = false;
  btnSalvar.disabled = false;
}

// ===============================
// CARREGAR AULA
// ===============================

async function carregarAula() {
  if (!aulaId) {
    mostrarMensagem("Nenhuma aula foi selecionada para edição.", false);
    bloquearFormulario();
    return;
  }

  bloquearFormulario();

  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      matricula_id,
      data_aula,
      status,
      conteudo,
      licao_casa,
      justificativa,
      precisa_reposicao,
      aula_gravada,
      aula_original_id,
      parte,
      modulo_id,
      duracao_segundos,
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
    .eq("id", aulaId)
    .single();

  if (error || !data) {
    console.error(error);
    mostrarMensagem("Erro ao carregar aula para edição.", false);
    bloquearFormulario();
    return;
  }

  aulaAtual = data;

  preencherTela(data);
  liberarFormulario();
}

function preencherTela(aula) {
  const alunoNome = aula.matricula?.aluno?.nome || "-";
  const materiaNome = aula.matricula?.materia?.nome || "-";
  const moduloNome =
    aula.modulo?.nome ||
    aula.matricula?.modulo?.nome ||
    "-";
  const professorNome = aula.professor?.nome || "-";

  infoAluno.textContent = alunoNome;
  infoMateria.textContent = materiaNome;
  infoModulo.textContent = moduloNome;
  infoProfessor.textContent = professorNome;
  infoData.textContent = formatarDataBR(aula.data_aula);
  infoStatus.textContent = aula.status || "-";
  infoParte.textContent = textoParte(aula.parte);

  infoRegras.textContent =
    `Gravada: ${textoSimNao(aula.aula_gravada)} | ` +
    `Reposição pendente: ${textoSimNao(aula.precisa_reposicao)}`;

  conteudo.value = aula.conteudo || "";
  licaoCasa.value = aula.licao_casa || "";
  justificativa.value = aula.justificativa || "";
}

// ===============================
// SALVAR
// ===============================

formEditarAula.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!aulaAtual?.id) {
    mostrarMensagem("A aula ainda não foi carregada.", false);
    return;
  }

  const novoConteudo = conteudo.value.trim();
  const novaLicaoCasa = licaoCasa.value.trim();
  const novaJustificativa = justificativa.value.trim();

  btnSalvar.disabled = true;
  btnSalvar.textContent = "Salvando...";

  const { error } = await supabase
    .from("aula")
    .update({
      conteudo: novoConteudo || null,
      licao_casa: novaLicaoCasa || null,
      justificativa: novaJustificativa || null
    })
    .eq("id", aulaAtual.id);

  if (error) {
    console.error(error);
    mostrarMensagem("Erro ao salvar alterações da aula.", false);
    btnSalvar.disabled = false;
    btnSalvar.textContent = "Salvar alterações";
    return;
  }

  mostrarMensagem("Aula atualizada com sucesso!");

  setTimeout(() => {
    voltarParaDetalhesAluno();
  }, 900);
});

// ===============================
// BOTÕES
// ===============================

btnCancelar?.addEventListener("click", voltarParaDetalhesAluno);
btnVoltarTopo?.addEventListener("click", voltarParaDetalhesAluno);
btnVoltarRodape?.addEventListener("click", voltarParaDetalhesAluno);

// ===============================
// INIT
// ===============================

carregarAula();