import { supabase } from "./supabase.js";
import { exigirAdmin } from "./guard.js";

await exigirAdmin();

const btnSair = document.getElementById("btnSair");

btnSair.addEventListener("click", async () => {
  await supabase.auth.signOut();

  localStorage.removeItem("role");
  localStorage.removeItem("professorId");
  localStorage.removeItem("professorNome");
  localStorage.removeItem("professorEmail");

  window.location.href = "index.html"; // login
});
