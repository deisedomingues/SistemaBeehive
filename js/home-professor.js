import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

await exigirProfessor();

const btnSair = document.getElementById("btnSair");
const saudacao = document.getElementById("saudacao");

// ======================
// pegar professor logado
// ======================

const professorId = localStorage.getItem("professorId");

if (!professorId) {
  window.location.href = "index.html";
}

// ======================
// carregar nome do professor
// ======================

async function carregarProfessor() {

  const { data, error } = await supabase
    .from("professor")
    .select("nome")
    .eq("id", professorId)
    .single();

  if (error || !data) {
    console.error("Erro ao carregar professor:", error);
    saudacao.textContent = "Olá!";
    return;
  }

  saudacao.textContent = `Olá, ${data.nome}!`;
}

// ======================
// sair
// ======================

btnSair?.addEventListener("click", () => {
  localStorage.removeItem("professorId");
  localStorage.removeItem("matriculaSelecionada");
  window.location.href = "index.html";
});

// iniciar
carregarProfessor();