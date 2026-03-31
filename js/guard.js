import { supabase } from "./supabase.js";

/* ===============================
   1) Garantir que o usuário está logado
================================ */
export async function exigirLogin() {

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = "login.html";
    return null;
  }

  return user;
}


/* ===============================
   2) Somente ADMIN
================================ */
export async function exigirAdmin() {

  const user = await exigirLogin();
  if (!user) return;

  const { data: perfil, error } = await supabase
    .from("perfil")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (error || !perfil || perfil.role !== "admin") {
    window.location.href = "index.html";
    return;
  }

}


/* ===============================
   3) Somente PROFESSOR
================================ */
export async function exigirProfessor() {

  const user = await exigirLogin();
  if (!user) return;

  const { data: perfil, error } = await supabase
    .from("perfil")
    .select("role, professor_id")
    .eq("user_id", user.id)
    .single();

  if (error || !perfil || perfil.role !== "professor") {
    window.location.href = "index.html";
    return;
  }

  // guarda o id do professor para usar nas páginas
  localStorage.setItem("professorId", perfil.professor_id || "");
}


/* ===============================
   4) PROFESSOR OU ADMIN
   (para páginas compartilhadas)
================================ */
export async function exigirProfessorOuAdmin() {

  const user = await exigirLogin();
  if (!user) return;

  const { data: perfil, error } = await supabase
    .from("perfil")
    .select("role, professor_id")
    .eq("user_id", user.id)
    .single();

  if (error || !perfil) {
    window.location.href = "index.html";
    return;
  }

  // se for professor guarda o id
  if (perfil.role === "professor") {
    localStorage.setItem("professorId", perfil.professor_id || "");
  }

  // se não for professor nem admin → bloqueia
  if (perfil.role !== "professor" && perfil.role !== "admin") {
    window.location.href = "index.html";
  }

}


/* ===============================
   3) Somente ALUNO
================================ */
export async function exigirAluno() {

  const user = await exigirLogin();
  if (!user) return;

  const { data: perfil, error } = await supabase
    .from("perfil")
    .select("role, aluno_id")
    .eq("user_id", user.id)
    .single();

  if (error || !perfil || perfil.role !== "aluno") {
    window.location.href = "index.html";
    return;
  }

  // guarda id do aluno
  localStorage.setItem("alunoId", perfil.aluno_id || "");

}