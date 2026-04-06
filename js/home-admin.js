import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

/*
  Permite acesso apenas ao perfil admin.
  Professor e aluno não devem entrar nesta tela.
*/
await exigirAdmin();

const btnSair = document.getElementById("btnSair");

btnSair.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();

    localStorage.removeItem("role");
    localStorage.removeItem("professorId");
    localStorage.removeItem("professorNome");
    localStorage.removeItem("professorEmail");

    window.location.href = "index.html";
  } catch (error) {
    console.error("Erro ao sair:", error);
    alert("Não foi possível sair neste momento.");
  }
});