import { exigirProfessor } from "./guard.js";

await exigirProfessor();

// Botão Sair
const btnSair = document.getElementById("btnSair");

btnSair?.addEventListener("click", () => {
  localStorage.removeItem("professorId");
  localStorage.removeItem("matriculaSelecionada");
  window.location.href = "index.html";
});
