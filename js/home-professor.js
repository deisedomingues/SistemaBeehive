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

    mostrarInfoPerfilAluno("Não foi possível carregar os dados do professor.", "erro");
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
    mostrarInfoPerfilAluno("Não foi possível verificar o perfil de aluno.", "erro");
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
   Pode apagar o botão do HTML depois.
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