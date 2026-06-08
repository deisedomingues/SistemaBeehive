import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

const perfil = await exigirAdmin();

if (!perfil) {
  throw new Error("Acesso negado: usuário não é admin.");
}

const btnSair = document.getElementById("btnSair");
const tituloAdmin = document.getElementById("tituloAdmin");

if (tituloAdmin) {
  tituloAdmin.textContent = "Área Administrativa";
}

btnSair?.addEventListener("click", async () => {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Erro ao sair:", error);
  }

  localStorage.clear();
  sessionStorage.clear();

  window.location.href = "index.html";
});