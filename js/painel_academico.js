import { supabase } from "./supabase.js";
import { exigirAluno } from "./guard.js";

// ========================================
// PROTEÇÃO DA PÁGINA
// ========================================
try {
  await exigirAluno();
} catch (erro) {
  console.error("Erro ao validar acesso do aluno:", erro);
}

// ========================================
// CONFIGURAÇÕES DA ESCOLA
// ========================================
const CONFIG = {
  WHATSAPP_NUMERO: "5511956177084",
  WHATSAPP_MENSAGEM: "teste de mensagem via link do whatsapp",
  EMAIL: "contato.beehiveidiomas@gmail.com",
  TELEFONE_TEXTO: "(11) 95617-7084", 
  TELEFONE_LINK: "+5511956177084"
};

// ========================================
// ELEMENTOS DA TELA
// ========================================
const msg = document.getElementById("msg");

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

// ========================================
// CONTATO DA ESCOLA
// ========================================
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

// ========================================
// UTILITÁRIOS
// ========================================
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

// ========================================
// IDENTIFICA O ALUNO LOGADO
// ========================================
function obterAlunoId() {
  return localStorage.getItem("alunoId");
}

// ========================================
// BUSCA DADOS DO ALUNO
// ========================================
// CORREÇÃO:
// link_zoom e link_youtube NÃO estão na tabela aluno.
// Eles estão na tabela matricula.
// Por isso aqui buscamos apenas campos do aluno.
async function carregarAluno(alunoId) {
  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome, email")
    .eq("id", alunoId)
    .single();

  if (error || !data) {
    console.error("Erro ao buscar aluno:", error);
    throw new Error("Não foi possível carregar os dados do aluno.");
  }

  setTexto(nomeAluno, data.nome || "Aluno(a)");

  return data;
}

// ========================================
// BUSCA MATRÍCULA DO ALUNO
// ========================================
// Aqui sim podemos buscar link_zoom e link_youtube,
// porque esses campos pertencem à matrícula.
async function carregarMatricula(alunoId) {
  const { data, error } = await supabase
    .from("matricula")
    .select("id, ativa, data_inicio, data_fim, materia_id, modulo_id, professor_id, link_zoom, link_youtube")
    .eq("aluno_id", alunoId)
    .order("ativa", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar matrícula:", error);
    throw new Error("Não foi possível carregar a matrícula do aluno.");
  }

  const matricula = data?.[0];

  if (!matricula) {
    throw new Error("Este aluno não possui matrícula cadastrada.");
  }

  setTexto(statusMatricula, matricula.ativa ? "Ativa" : "Inativa");
  setTexto(dataInicio, formatarData(matricula.data_inicio));

  return matricula;
}

// ========================================
// BUSCA MATÉRIA
// ========================================
async function carregarMateria(materiaId) {
  if (!materiaId) {
    setTexto(nomeCurso, "--");
    return null;
  }

  const { data, error } = await supabase
    .from("materia")
    .select("id, nome")
    .eq("id", materiaId)
    .single();

  if (error) {
    console.error("Erro ao buscar matéria:", error);
    setTexto(nomeCurso, "--");
    return null;
  }

  setTexto(nomeCurso, data?.nome || "--");
  return data;
}

// ========================================
// BUSCA MÓDULO
// ========================================
async function carregarModulo(moduloId) {
  if (!moduloId) {
    setTexto(nomeModulo, "--");
    return null;
  }

  const { data, error } = await supabase
    .from("modulo")
    .select("id, nome")
    .eq("id", moduloId)
    .single();

  if (error) {
    console.error("Erro ao buscar módulo:", error);
    setTexto(nomeModulo, "--");
    return null;
  }

  setTexto(nomeModulo, data?.nome || "--");
  return data;
}

// ========================================
// BUSCA PROFESSOR
// ========================================
async function carregarProfessor(professorId) {
  if (!professorId) {
    setTexto(nomeProfessor, "--");
    return null;
  }

  const { data, error } = await supabase
    .from("professor")
    .select("id, nome")
    .eq("id", professorId)
    .single();

  if (error) {
    console.error("Erro ao buscar professor:", error);
    setTexto(nomeProfessor, "--");
    return null;
  }

  setTexto(nomeProfessor, data?.nome || "--");
  return data;
}

// ========================================
// BUSCA AULAS DA MATRÍCULA
// ========================================
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

// ========================================
// BUSCA NOTAS DA MATRÍCULA
// ========================================
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

// ========================================
// BUSCA REPOSIÇÕES DO ALUNO
// ========================================
async function carregarReposicoesDoAluno(alunoId) {
  const { data, error } = await supabase
    .from("reposicao_agendada")
    .select("id, aula_id, cancelado, data_agendamento")
    .eq("aluno_id", alunoId)
    .eq("cancelado", false)
    .order("data_agendamento", { ascending: false });

  if (error) {
    console.error("Erro ao buscar reposições:", error);
    return [];
  }

  return data || [];
}

// ========================================
// RESUMO ACADÊMICO
// ========================================
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

// ========================================
// NOTAS
// ========================================
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

// ========================================
// REPOSIÇÕES
// ========================================
function preencherReposicoes(aulas, reposicoes) {
  const qtdReposicoesAgendadas = reposicoes.length;
  const qtdAulasPrecisaReposicao = aulas.filter(
    (aula) => aula.precisa_reposicao === true
  ).length;

  setTexto(totalReposicoes, String(qtdReposicoesAgendadas));
  setTexto(aulasPrecisaReposicao, String(qtdAulasPrecisaReposicao));
}

// ========================================
// HISTÓRICO
// ========================================
function renderizarHistorico(aulas) {
  if (!listaHistorico) return;

  listaHistorico.innerHTML = "";

  if (!aulas.length) {
    listaHistorico.innerHTML = `
      <div class="vazio-box">
        Nenhuma aula registrada ainda.
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
      <div style="margin-top: 6px;"><strong>Lição de casa:</strong> ${licao}</div>
      <div style="margin-top: 6px;"><strong>Precisa de reposição:</strong> ${precisaReposicao}</div>
      ${
        justificativa
          ? `<div style="margin-top: 6px;"><strong>Justificativa:</strong> ${justificativa}</div>`
          : ""
      }
    `;

    listaHistorico.appendChild(item);
  });
}

// ========================================
// DEBUG ÚTIL
// ========================================
function debugLoginAluno() {
  console.log("role:", localStorage.getItem("role"));
  console.log("alunoId:", localStorage.getItem("alunoId"));
  console.log("alunoNome:", localStorage.getItem("alunoNome"));
  console.log("alunoEmail:", localStorage.getItem("alunoEmail"));
}

// ========================================
// INÍCIO
// ========================================
async function init() {
  limparMensagem();
  configurarContatoEscola();
  debugLoginAluno();

  const alunoId = obterAlunoId();

  if (!alunoId) {
    mostrarMensagem("Não foi possível identificar o aluno logado.");
    return;
  }

  try {
    // Mostra o nome salvo no navegador enquanto os dados carregam
    const nomeSalvo = localStorage.getItem("alunoNome");
    if (nomeSalvo) {
      setTexto(nomeAluno, nomeSalvo);
    }

    const aluno = await carregarAluno(alunoId);
    const matricula = await carregarMatricula(alunoId);

    await Promise.all([
      carregarMateria(matricula.materia_id),
      carregarModulo(matricula.modulo_id),
      carregarProfessor(matricula.professor_id)
    ]);

    const [aulas, notas, reposicoes] = await Promise.all([
      carregarAulasDaMatricula(matricula.id),
      carregarNotasDaMatricula(matricula.id),
      carregarReposicoesDoAluno(aluno.id)
    ]);

    preencherResumoAcademico(aulas);
    preencherNotas(notas);
    preencherReposicoes(aulas, reposicoes);
    renderizarHistorico(aulas);
  } catch (erro) {
    console.error("Erro no painel acadêmico:", erro);
    mostrarMensagem(erro.message || "Erro ao carregar o painel acadêmico.");
  }
}

init();