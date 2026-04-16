import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

try {
  await exigirAluno();
} catch (erro) {
  console.error("Erro ao validar acesso do aluno:", erro);
}

/* ========================================
   CONFIGURAÇÕES DA ESCOLA
======================================== */
const CONFIG = {
  WHATSAPP_NUMERO: "5511956177084",
  WHATSAPP_MENSAGEM: "Olá! Preciso de ajuda no painel acadêmico.",
  EMAIL: "contato.beehiveidiomas@gmail.com",
  TELEFONE_TEXTO: "(11) 95617-7084",
  TELEFONE_LINK: "+5511956177084"
};

/* ========================================
   ELEMENTOS DA TELA
======================================== */
const msg = document.getElementById("msg");

const blocoCursoPainel = document.getElementById("blocoCursoPainel");
const textoCursoPainel = document.getElementById("textoCursoPainel");
const labelSelectMatriculaPainel = document.getElementById("labelSelectMatriculaPainel");
const selectMatriculaPainel = document.getElementById("selectMatriculaPainel");

const nomeAluno = document.getElementById("nomeAluno");
const statusMatricula = document.getElementById("statusMatricula");
const nomeCurso = document.getElementById("nomeCurso");
const nomeModulo = document.getElementById("nomeModulo");
const nomeProfessor = document.getElementById("nomeProfessor");
const dataInicio = document.getElementById("dataInicio");

const totalAulas = document.getElementById("totalAulas");
const totalPresencas = document.getElementById("totalPresencas");
const totalAusencias = document.getElementById("totalAusencias");
const totalCanceladas = document.getElementById("totalCanceladas");
const percentualPresenca = document.getElementById("percentualPresenca");
const barraPresenca = document.getElementById("barraPresenca");

const mediaNotas = document.getElementById("mediaNotas");
const ultimaNota = document.getElementById("ultimaNota");
const totalReposicoes = document.getElementById("totalReposicoes");
const aulasPrecisaReposicao = document.getElementById("aulasPrecisaReposicao");

const listaHistorico = document.getElementById("listaHistorico");

const emailEscola = document.getElementById("emailEscola");
const telefoneEscola = document.getElementById("telefoneEscola");
const btnWhatsapp = document.getElementById("btnWhatsapp");

/* ========================================
   ESTADO
======================================== */
let alunoId = null;
let alunoAtual = null;
let matriculasAtivas = [];
let matriculaSelecionada = null;

/* ========================================
   CONTATO DA ESCOLA
======================================== */
function configurarContatoEscola() {
  if (emailEscola) {
    emailEscola.textContent = CONFIG.EMAIL;
    emailEscola.href = `mailto:${CONFIG.EMAIL}`;
  }

  if (telefoneEscola) {
    telefoneEscola.textContent = CONFIG.TELEFONE_TEXTO;
    telefoneEscola.href = `tel:${CONFIG.TELEFONE_LINK}`;
  }

  if (btnWhatsapp) {
    const mensagem = encodeURIComponent(CONFIG.WHATSAPP_MENSAGEM);
    btnWhatsapp.href = `https://wa.me/${CONFIG.WHATSAPP_NUMERO}?text=${mensagem}`;
  }
}

/* ========================================
   UTILITÁRIOS
======================================== */
function mostrarMensagem(texto, tipo = "erro") {
  if (!msg) return;
  msg.textContent = texto;
  msg.className = `msg-box show ${tipo}`;
}

function limparMensagem() {
  if (!msg) return;
  msg.textContent = "";
  msg.className = "msg-box";
}

function setTexto(el, valor) {
  if (!el) return;
  el.textContent = valor ?? "--";
}

function formatarData(data) {
  if (!data) return "--";

  const d = new Date(`${data}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "--";

  return d.toLocaleDateString("pt-BR");
}

function normalizarStatus(status) {
  if (!status) return "";
  return String(status).trim().toLowerCase();
}

function textoStatus(status) {
  const s = normalizarStatus(status);

  if (s === "p") return "Presente";
  if (s === "a") return "Ausente";
  if (s === "c") return "Cancelada";
  if (s === "t") return "Trancada";

  if (!status) return "--";

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function classeStatus(status) {
  const s = normalizarStatus(status);

  if (s === "presente" || s === "p") return "status-presente";
  if (s === "ausente" || s === "a") return "status-ausente";
  if (s === "cancelada" || s === "cancelado" || s === "c") return "status-cancelada";
  if (s === "trancada" || s === "trancamento" || s === "t") return "status-trancada";

  return "status-cancelada";
}

function formatarNota(valor) {
  if (valor === null || valor === undefined || valor === "") return "--";
  return Number(valor).toFixed(1).replace(".", ",");
}

function obterAlunoId() {
  return (
    localStorage.getItem("alunoId") ||
    localStorage.getItem("aluno_id") ||
    localStorage.getItem("idAluno")
  );
}

function montarNomeCurso(matricula) {
  const materia = matricula?.materia?.nome || "Curso";
  const modulo = matricula?.modulo?.nome || "Módulo não informado";
  return `${materia} — ${modulo}`;
}

function salvarMatriculaSelecionada(matricula) {
  if (!matricula?.id) return;

  localStorage.setItem("matriculaSelecionadaId", String(matricula.id));
  localStorage.setItem("materiaSelecionadaId", String(matricula.materia_id || ""));
  localStorage.setItem("moduloSelecionadoId", String(matricula.modulo_id || ""));
  localStorage.setItem("nomeCursoSelecionado", montarNomeCurso(matricula));
}

function limparCardsResumo() {
  setTexto(statusMatricula, "--");
  setTexto(nomeCurso, "--");
  setTexto(nomeModulo, "--");
  setTexto(nomeProfessor, "--");
  setTexto(dataInicio, "--");

  setTexto(totalAulas, "0");
  setTexto(totalPresencas, "0");
  setTexto(totalAusencias, "0");
  setTexto(totalCanceladas, "0");
  setTexto(percentualPresenca, "0%");
  if (barraPresenca) barraPresenca.style.width = "0%";

  setTexto(mediaNotas, "--");
  setTexto(ultimaNota, "--");

  setTexto(totalReposicoes, "0");
  setTexto(aulasPrecisaReposicao, "0");

  if (listaHistorico) {
    listaHistorico.innerHTML = `<div class="vazio-box">Nenhuma informação carregada.</div>`;
  }
}

/* ========================================
   CARGA INICIAL
======================================== */
async function carregarAluno(alunoIdParam) {
  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome, email")
    .eq("id", alunoIdParam)
    .single();

  if (error || !data) {
    console.error("Erro ao buscar aluno:", error);
    throw new Error("Não foi possível carregar os dados do aluno.");
  }

  setTexto(nomeAluno, data.nome || "Aluno(a)");
  return data;
}

async function carregarMatriculasAtivas(alunoIdParam) {
  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      professor_id,
      ativa,
      data_inicio,
      data_fim,
      link_zoom,
      link_youtube,
      materia:materia_id (
        id,
        nome
      ),
      modulo:modulo_id (
        id,
        nome,
        ordem,
        materia_id
      ),
      professor:professor_id (
        id,
        nome
      )
    `)
    .eq("aluno_id", alunoIdParam)
    .eq("ativa", true)
    .order("id", { ascending: true });

  if (error) {
    console.error("Erro ao buscar matrículas ativas:", error);
    throw new Error("Não foi possível carregar os cursos do aluno.");
  }

  return data || [];
}

function definirMatriculaSelecionadaInicial() {
  if (!matriculasAtivas.length) {
    matriculaSelecionada = null;
    return;
  }

  const matriculaSalvaId = localStorage.getItem("matriculaSelecionadaId");

  const encontrada = matriculasAtivas.find(
    (m) => String(m.id) === String(matriculaSalvaId)
  );

  if (encontrada) {
    matriculaSelecionada = encontrada;
    return;
  }

  matriculaSelecionada = matriculasAtivas[0];
  salvarMatriculaSelecionada(matriculaSelecionada);
}

function preencherSelectMatriculas() {
  if (!blocoCursoPainel || !textoCursoPainel || !labelSelectMatriculaPainel || !selectMatriculaPainel) {
    return;
  }

  blocoCursoPainel.style.display = "block";
  selectMatriculaPainel.innerHTML = "";

  matriculasAtivas.forEach((matricula) => {
    const option = document.createElement("option");
    option.value = String(matricula.id);
    option.textContent = montarNomeCurso(matricula);
    selectMatriculaPainel.appendChild(option);
  });

  if (matriculasAtivas.length > 1) {
    labelSelectMatriculaPainel.style.display = "block";
  } else {
    labelSelectMatriculaPainel.style.display = "none";
  }

  if (matriculaSelecionada?.id) {
    selectMatriculaPainel.value = String(matriculaSelecionada.id);
    textoCursoPainel.textContent =
      `Você está visualizando o painel do curso ${montarNomeCurso(matriculaSelecionada)}.`;
  } else {
    textoCursoPainel.textContent = "Nenhum curso ativo encontrado.";
  }
}

/* ========================================
   BUSCAS POR MATRÍCULA SELECIONADA
======================================== */
async function carregarAulasDaMatricula(matriculaId) {
  const { data, error } = await supabase
    .from("aula")
    .select(`
      id,
      data_aula,
      status,
      justificativa,
      conteudo,
      licao_casa,
      parte,
      precisa_reposicao
    `)
    .eq("matricula_id", matriculaId)
    .order("data_aula", { ascending: false })
    .order("parte", { ascending: false });

  if (error) {
    console.error("Erro ao buscar aulas:", error);
    throw new Error("Não foi possível carregar o histórico de aulas.");
  }

  return data || [];
}

async function carregarNotasDaMatricula(matriculaId) {
  const { data, error } = await supabase
    .from("nota")
    .select("id, data, tipo, valor, observacao")
    .eq("matricula_id", matriculaId)
    .order("data", { ascending: false });

  if (error) {
    console.error("Erro ao buscar notas:", error);
    return [];
  }

  return data || [];
}

async function carregarReposicoesDaMatricula(matriculaId) {
  const { data, error } = await supabase
    .from("reposicao_agendada")
    .select("id, aula_id, cancelado, data_agendamento, matricula_id")
    .eq("matricula_id", matriculaId)
    .eq("cancelado", false)
    .order("data_agendamento", { ascending: false });

  if (error) {
    console.error("Erro ao buscar reposições da matrícula:", error);
    return [];
  }

  return data || [];
}

/* ========================================
   PREENCHIMENTO
======================================== */
function preencherCabecalhoMatricula(matricula) {
  setTexto(statusMatricula, matricula.ativa ? "Ativa" : "Inativa");
  setTexto(dataInicio, formatarData(matricula.data_inicio));
  setTexto(nomeCurso, matricula?.materia?.nome || "--");
  setTexto(nomeModulo, matricula?.modulo?.nome || "--");
  setTexto(nomeProfessor, matricula?.professor?.nome || "--");
}

function preencherResumoAcademico(aulas) {
  const total = aulas.length;

  const presentes = aulas.filter((aula) => {
    const s = normalizarStatus(aula.status);
    return s === "presente" || s === "p";
  }).length;

  const ausentes = aulas.filter((aula) => {
    const s = normalizarStatus(aula.status);
    return s === "ausente" || s === "a";
  }).length;

  const canceladasOuTrancadas = aulas.filter((aula) => {
    const s = normalizarStatus(aula.status);
    return (
      s === "cancelada" ||
      s === "cancelado" ||
      s === "c" ||
      s === "trancada" ||
      s === "trancamento" ||
      s === "t"
    );
  }).length;

  setTexto(totalAulas, String(total));
  setTexto(totalPresencas, String(presentes));
  setTexto(totalAusencias, String(ausentes));
  setTexto(totalCanceladas, String(canceladasOuTrancadas));

  const percentual = total > 0 ? Math.round((presentes / total) * 100) : 0;
  setTexto(percentualPresenca, `${percentual}%`);

  if (barraPresenca) {
    barraPresenca.style.width = `${percentual}%`;
  }
}

function preencherNotas(notas) {
  if (!notas.length) {
    setTexto(mediaNotas, "--");
    setTexto(ultimaNota, "--");
    return;
  }

  const soma = notas.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const media = soma / notas.length;

  setTexto(mediaNotas, formatarNota(media));
  setTexto(ultimaNota, formatarNota(notas[0].valor));
}

function preencherReposicoes(aulas, reposicoes) {
  const qtdReposicoesAgendadas = reposicoes.length;
  const qtdAulasPrecisaReposicao = aulas.filter(
    (aula) => aula.precisa_reposicao === true
  ).length;

  setTexto(totalReposicoes, String(qtdReposicoesAgendadas));
  setTexto(aulasPrecisaReposicao, String(qtdAulasPrecisaReposicao));
}

function renderizarHistorico(aulas) {
  if (!listaHistorico) return;

  listaHistorico.innerHTML = "";

  if (!aulas.length) {
    listaHistorico.innerHTML = `
      <div class="vazio-box">
        Nenhuma aula registrada ainda para este curso.
      </div>
    `;
    return;
  }

  const ultimasAulas = aulas.slice(0, 8);

  ultimasAulas.forEach((aula) => {
    const item = document.createElement("div");
    item.className = "item-historico";

    const dataAula = formatarData(aula.data_aula);
    const status = textoStatus(aula.status);
    const conteudo = aula.conteudo || "Não informado";
    const licao = aula.licao_casa || "Não informada";
    const justificativa = aula.justificativa || "";
    const precisaReposicao = aula.precisa_reposicao ? "Sim" : "Não";
    const parte = aula.parte ? ` - Parte ${aula.parte}` : "";

    item.innerHTML = `
      <div class="item-historico-topo">
        <strong>${dataAula}${parte}</strong>
        <span class="status-badge ${classeStatus(aula.status)}">${status}</span>
      </div>

      <div><strong>Conteúdo:</strong> ${conteudo}</div>
      <div style="margin-top:6px;"><strong>Lição de casa:</strong> ${licao}</div>
      <div style="margin-top:6px;"><strong>Precisa de reposição:</strong> ${precisaReposicao}</div>
      ${
        justificativa
          ? `<div style="margin-top:6px;"><strong>Justificativa:</strong> ${justificativa}</div>`
          : ""
      }
    `;

    listaHistorico.appendChild(item);
  });
}

/* ========================================
   CARREGAR DADOS DA MATRÍCULA
======================================== */
async function carregarDadosDaMatriculaSelecionada() {
  limparMensagem();

  if (!matriculaSelecionada) {
    limparCardsResumo();
    mostrarMensagem("Nenhum curso ativo foi encontrado para este aluno.");
    return;
  }

  salvarMatriculaSelecionada(matriculaSelecionada);
  preencherSelectMatriculas();
  preencherCabecalhoMatricula(matriculaSelecionada);

  const [aulas, notas, reposicoes] = await Promise.all([
    carregarAulasDaMatricula(matriculaSelecionada.id),
    carregarNotasDaMatricula(matriculaSelecionada.id),
    carregarReposicoesDaMatricula(matriculaSelecionada.id)
  ]);

  preencherResumoAcademico(aulas);
  preencherNotas(notas);
  preencherReposicoes(aulas, reposicoes);
  renderizarHistorico(aulas);
}

/* ========================================
   DEBUG
======================================== */
function debugLoginAluno() {
  console.log("role:", localStorage.getItem("role"));
  console.log("alunoId:", localStorage.getItem("alunoId"));
  console.log("alunoNome:", localStorage.getItem("alunoNome"));
  console.log("alunoEmail:", localStorage.getItem("alunoEmail"));
  console.log("matriculaSelecionadaId:", localStorage.getItem("matriculaSelecionadaId"));
}

/* ========================================
   EVENTOS DA INTERFACE
======================================== */
if (selectMatriculaPainel) {
  selectMatriculaPainel.addEventListener("change", async () => {
    const idSelecionado = selectMatriculaPainel.value;

    const encontrada = matriculasAtivas.find(
      (m) => String(m.id) === String(idSelecionado)
    );

    if (!encontrada) return;

    matriculaSelecionada = encontrada;
    await carregarDadosDaMatriculaSelecionada();
  });
}

/* ========================================
   INÍCIO
======================================== */
async function init() {
  limparMensagem();
  configurarContatoEscola();
  debugLoginAluno();

  alunoId = obterAlunoId();

  if (!alunoId) {
    mostrarMensagem("Não foi possível identificar o aluno logado.");
    return;
  }

  try {
    const nomeSalvo = localStorage.getItem("alunoNome");
    if (nomeSalvo) {
      setTexto(nomeAluno, nomeSalvo);
    }

    alunoAtual = await carregarAluno(alunoId);
    matriculasAtivas = await carregarMatriculasAtivas(alunoId);

    if (!matriculasAtivas.length) {
      if (blocoCursoPainel) blocoCursoPainel.style.display = "block";
      if (textoCursoPainel) {
        textoCursoPainel.textContent = "Você não possui curso ativo no momento.";
      }

      limparCardsResumo();
      mostrarMensagem("Você não possui matrícula ativa.");
      return;
    }

    definirMatriculaSelecionadaInicial();
    preencherSelectMatriculas();
    await carregarDadosDaMatriculaSelecionada();
  } catch (erro) {
    console.error("Erro no painel acadêmico:", erro);
    mostrarMensagem(erro.message || "Erro ao carregar o painel acadêmico.");
  }
}

init();