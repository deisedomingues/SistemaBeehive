import { supabase } from "./supabase.js";
import { exigirLogin } from "./guard.js";

// ✅ garante que está logado (se não estiver, vai para login.html)
await exigirLogin();

function esconder(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "none";
}

function mostrar(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = "";
}

// 👤 role vem do login.js
let role = localStorage.getItem("role");

// Se não tiver role no localStorage, busca no banco
if (!role) {

  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil, error } = await supabase
    .from("perfil")
    .select("role, professor_id, aluno_id")
    .eq("user_id", user.id)
    .single();

  if (!error && perfil) {
    localStorage.setItem("role", perfil.role);
    localStorage.setItem("professorId", perfil.professor_id || "");
    localStorage.setItem("alunoId", perfil.aluno_id || "");
  }

}

const roleFinal = localStorage.getItem("role");


// 🎯 REDIRECIONAMENTO DO ALUNO
if (roleFinal === "aluno") {
  window.location.href = "home-aluno.html";
}


// 🎯 UI por perfil
if (roleFinal === "professor") {

  // professor: esconder botões de admin
  esconder("btn-alunos");
  esconder("btn-professores");
  esconder("btn-resumo");

} else {

  // admin: garantir visibilidade
  mostrar("btn-alunos");
  mostrar("btn-professores");
  mostrar("btn-resumo");

}


// 🚪 Logout
const btnSair = document.getElementById("btnSair");

if (btnSair) {
  btnSair.addEventListener("click", async () => {

    await supabase.auth.signOut();

    // limpa dados locais
    localStorage.removeItem("role");
    localStorage.removeItem("professorId");
    localStorage.removeItem("alunoId");
    localStorage.removeItem("professorNome");
    localStorage.removeItem("professorEmail");

    window.location.href = "login.html";

  });
}