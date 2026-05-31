import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

const btnVoltar = document.getElementById("btnVoltar");
const msg = document.getElementById("msg");

const nomeAluno = document.getElementById("nomeAluno");
const infoAluno = document.getElementById("infoAluno");

const formObservacaoPedagogica = document.getElementById("formObservacaoPedagogica");
const dataInclusao = document.getElementById("dataInclusao");
const nomeProfessor = document.getElementById("nomeProfessor");
const campoObservacao = document.getElementById("campoObservacao");
const btnSalvarObservacao = document.getElementById("btnSalvarObservacao");

let alunoId = null;
let matriculaId = null;
let professorAtual = null;
let alunoAtual = null;
let matriculaAtual = null;

// =============================
// Utilitários
// =============================
function obterParametroUrl(nome) {
  const params = new URLSearchParams(window.location.search);
  return params.get(nome);
}

function mostrarMensagem(texto, erro = false) {
  if (!msg) return;

  msg.textContent = texto;
  msg.className = erro ? "msg-erro" : "msg-sucesso";
  msg.style.display = "block";

  setTimeout(() => {
    msg.textContent = "";
    msg.className = "";
    msg.style.display = "none";
  }, 4000);
}

function formatarDataHoraAgora() {
  const agora = new Date();

  return agora.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function obterProfessorIdLogado() {
  return (
    localStorage.getItem("professorId") ||
    localStorage.getItem("professor_id") ||
    localStorage.getItem("idProfessor") ||
    sessionStorage.getItem("professorId") ||
    sessionStorage.getItem("professor_id") ||
    sessionStorage.getItem("idProfessor")
  );
}

function montarNomeCurso(matricula) {
  const materia = matricula?.materia?.nome || "Curso não informado";
  const modulo = matricula?.modulo?.nome || "Módulo não informado";
  return `${materia} — ${modulo}`;
}

// =============================
// Voltar
// =============================
function voltarParaDetalhes() {
  if (!alunoId) {
    window.location.href = "home-professor.html";
    return;
  }

  let url = `detalhes-aluno.html?aluno_id=${encodeURIComponent(alunoId)}`;

  if (matriculaId) {
    url += `&matricula_id=${encodeURIComponent(matriculaId)}`;
  }

  window.location.href = url;
}

if (btnVoltar) {
  btnVoltar.addEventListener("click", voltarParaDetalhes);
}

// =============================
// Buscar professor
// =============================
async function buscarProfessorAtual() {
  const professorId = obterProfessorIdLogado();

  if (!professorId) {
    mostrarMensagem("Não foi possível identificar o professor logado.", true);
    return null;
  }

  const { data, error } = await supabase
    .from("professor")
    .select("id, nome")
    .eq("id", professorId)
    .maybeSingle();

  if (error || !data) {
    console.error("Erro ao buscar professor:", error);
    mostrarMensagem("Professor não encontrado.", true);
    return null;
  }

  return data;
}

// =============================
// Buscar aluno
// =============================
async function buscarAluno() {
  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome, email, telefone")
    .eq("id", alunoId)
    .maybeSingle();

  if (error || !data) {
    console.error("Erro ao buscar aluno:", error);
    mostrarMensagem("Aluno não encontrado.", true);
    return null;
  }

  return data;
}

// =============================
// Buscar matrícula
// =============================
async function buscarMatricula() {
  if (!matriculaId) return null;

  const { data, error } = await supabase
    .from("matricula")
    .select(`
      id,
      aluno_id,
      materia_id,
      modulo_id,
      professor_id,
      materia:materia_id (
        id,
        nome
      ),
      modulo:modulo_id (
        id,
        nome
      ),
      professor:professor_id (
        id,
        nome
      )
    `)
    .eq("id", matriculaId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar matrícula:", error);
    return null;
  }

  return data;
}

// =============================
// Carregar dados iniciais
// =============================
async function carregarDados() {
  alunoId =
    obterParametroUrl("aluno_id") ||
    obterParametroUrl("alunoId") ||
    obterParametroUrl("id");

  matriculaId =
    obterParametroUrl("matricula_id") ||
    obterParametroUrl("matriculaId");

  if (!alunoId) {
    mostrarMensagem("Aluno não informado.", true);

    if (nomeAluno) {
      nomeAluno.textContent = "Aluno não informado";
    }

    if (infoAluno) {
      infoAluno.textContent = "Volte para a tela de detalhes e tente novamente.";
    }

    if (btnSalvarObservacao) {
      btnSalvarObservacao.disabled = true;
    }

    return;
  }

  if (dataInclusao) {
    dataInclusao.value = formatarDataHoraAgora();
  }

  professorAtual = await buscarProfessorAtual();

  if (nomeProfessor) {
    nomeProfessor.value = professorAtual?.nome || "Professor não identificado";
  }

  alunoAtual = await buscarAluno();
  matriculaAtual = await buscarMatricula();

  if (nomeAluno) {
    nomeAluno.textContent = alunoAtual?.nome || "Aluno não encontrado";
  }

  if (infoAluno) {
    if (matriculaAtual) {
      const curso = montarNomeCurso(matriculaAtual);
      const professorRegular = matriculaAtual?.professor?.nome
        ? ` Professor regular: ${matriculaAtual.professor.nome}.`
        : "";

      infoAluno.textContent = `${curso}.${professorRegular}`;
    } else {
      infoAluno.textContent = "Matrícula não informada. A observação será salva no histórico geral do aluno.";
    }
  }

  if (!professorAtual || !alunoAtual) {
    if (btnSalvarObservacao) {
      btnSalvarObservacao.disabled = true;
    }
  }
}

// =============================
// Salvar observação
// =============================
if (formObservacaoPedagogica) {
  formObservacaoPedagogica.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!alunoId) {
      mostrarMensagem("Aluno não identificado.", true);
      return;
    }

    if (!professorAtual?.id) {
      mostrarMensagem("Professor não identificado.", true);
      return;
    }

    const texto = campoObservacao.value.trim();

    if (!texto) {
      mostrarMensagem("Escreva a observação antes de salvar.", true);
      return;
    }

    btnSalvarObservacao.disabled = true;
    btnSalvarObservacao.textContent = "Salvando...";

    try {
      const { error } = await supabase
        .from("observacao_pedagogica")
        .insert({
          aluno_id: Number(alunoId),
          professor_id: Number(professorAtual.id),
          observacao: texto
        });

      if (error) {
        throw error;
      }

      mostrarMensagem("Observação salva com sucesso!");

      setTimeout(() => {
        voltarParaDetalhes();
      }, 800);

    } catch (error) {
      console.error("Erro ao salvar observação pedagógica:", error);
      mostrarMensagem("Erro ao salvar observação pedagógica.", true);
    } finally {
      btnSalvarObservacao.disabled = false;
      btnSalvarObservacao.textContent = "Salvar observação";
    }
  });
}

// =============================
// Iniciar
// =============================
carregarDados();