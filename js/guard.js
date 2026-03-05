import { supabase } from "./supabase.js";

export async function exigirLogin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}

export async function exigirAdmin() {
  const user = await exigirLogin();
  if (!user) return;

  const { data: perfil } = await supabase
    .from("perfil")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!perfil || perfil.role !== "admin") {
    window.location.href = "registrar-aula.html";
  }
}

export async function exigirProfessor() {
  const user = await exigirLogin();
  if (!user) return;

  const { data: perfil } = await supabase
    .from("perfil")
    .select("role, professor_id")
    .eq("user_id", user.id)
    .single();

  if (!perfil || perfil.role !== "professor") {
    window.location.href = "index.html";
    return;
  }

  localStorage.setItem("professorId", perfil.professor_id || "");
}
