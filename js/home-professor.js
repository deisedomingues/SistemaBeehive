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

const professorId = localStorage.getItem("professorId");

let professorLogado = null;
let alunoVinculado = null;

if (!professorId) {
  window.location.href = "index.html";
}

// ======================
// carregar professor logado
// ======================
async function carregarProfessor() {
  const { data, error } = await supabase
    .from("professor")
    .select("id, nome, email")
    .eq("id", professorId)
    .single();

  if (error || !data) {
    console.error("Erro ao carregar professor:", error);
    saudacao.textContent = "Olá!";
    tituloProfessor.textContent = "Bem-vindo(a)";
    return;
  }

  professorLogado = data;

  saudacao.textContent = `Olá, ${data.nome}!`;
  tituloProfessor.textContent = "Bem-vindo(a)";

  // por padrão, exibe professor
  selectPerfilVisualizacao.value = "professor";
  painelProfessorCards.style.display = "grid";

  await verificarVinculoAluno();
}

// ======================
// verificar se esse professor também é aluno
// ======================
async function verificarVinculoAluno() {
  if (!professorLogado?.email) {
    optionAluno.disabled = true;
    infoPerfilAluno.textContent = "Perfil de aluno indisponível.";
    return;
  }

  const { data, error } = await supabase
    .from("aluno")
    .select("id, nome, email, empresa_cnpj")
    .eq("email", professorLogado.email)
    .maybeSingle();

  if (error) {
    console.error("Erro ao verificar vínculo como aluno:", error);
    optionAluno.disabled = true;
    infoPerfilAluno.textContent = "Não foi possível verificar o perfil de aluno.";
    return;
  }

  if (!data) {
    optionAluno.disabled = true;
    infoPerfilAluno.textContent = "Este usuário não possui cadastro como aluno.";
    return;
  }

  alunoVinculado = data;
  optionAluno.disabled = false;
  infoPerfilAluno.textContent = "Perfil de aluno disponível.";
}

// ======================
// abrir perfil escolhido
// ======================
btnAbrirPerfil?.addEventListener("click", () => {
  const perfilSelecionado = selectPerfilVisualizacao.value;

  if (perfilSelecionado === "professor") {
    painelProfessorCards.style.display = "grid";
    return;
  }

  if (perfilSelecionado === "aluno") {
    if (!alunoVinculado?.id) {
      alert("Este usuário não possui perfil de aluno disponível.");
      return;
    }

    localStorage.setItem("alunoIdVisualizacao", alunoVinculado.id);
    window.location.href = "detalhes-aluno-funcionario.html";
  }
});

// ======================
// sair
// ======================
btnSair?.addEventListener("click", () => {
  localStorage.removeItem("professorId");
  localStorage.removeItem("matriculaSelecionada");
  localStorage.removeItem("alunoIdVisualizacao");
  window.location.href = "index.html";
});

// iniciar
carregarProfessor();