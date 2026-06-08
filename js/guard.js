import { supabase } from "./supabase.js";

/* ===============================
   1) Garantir que o usuário está logado
================================ */
export async function exigirLogin() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    console.error("Erro ao verificar login:", error);
    window.location.href = "index.html";
    return null;
  }

  if (!user) {
    window.location.href = "index.html";
    return null;
  }

  return user;
}

/* ===============================
   2) Somente ADMIN
================================ */
export async function exigirAdmin() {
  const user = await exigirLogin();
  if (!user) return null;

  const { data: perfil, error } = await supabase
    .from("perfil")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (error || !perfil || perfil.role !== "admin") {
    console.error("Acesso negado para admin:", error);
    window.location.href = "index.html";
    return null;
  }

  localStorage.setItem("role", "admin");

  return perfil;
}

/* ===============================
   3) Somente PROFESSOR
================================ */
export async function exigirProfessor() {
  const user = await exigirLogin();
  if (!user) return null;

  const { data: perfil, error } = await supabase
    .from("perfil")
    .select("role, professor_id")
    .eq("user_id", user.id)
    .single();

  if (error || !perfil || perfil.role !== "professor") {
    console.error("Acesso negado para professor:", error);
    window.location.href = "index.html";
    return null;
  }

  localStorage.setItem("role", "professor");
  localStorage.setItem("professorId", perfil.professor_id || "");

  return perfil;
}

/* ===============================
   4) PROFESSOR OU ADMIN
================================ */
export async function exigirProfessorOuAdmin() {
  const user = await exigirLogin();
  if (!user) return null;

  const { data: perfil, error } = await supabase
    .from("perfil")
    .select("role, professor_id")
    .eq("user_id", user.id)
    .single();

  if (error || !perfil) {
    console.error("Perfil não encontrado:", error);
    window.location.href = "index.html";
    return null;
  }

  if (perfil.role !== "professor" && perfil.role !== "admin") {
    window.location.href = "index.html";
    return null;
  }

  localStorage.setItem("role", perfil.role);

  if (perfil.role === "professor") {
    localStorage.setItem("professorId", perfil.professor_id || "");
  }

  return perfil;
}

/* ===============================
   5) Somente ALUNO
================================ */
export async function exigirAluno() {
  const user = await exigirLogin();
  if (!user) return null;

  const { data: perfil, error } = await supabase
    .from("perfil")
    .select("role, aluno_id")
    .eq("user_id", user.id)
    .single();

  if (error || !perfil || perfil.role !== "aluno") {
    console.error("Acesso negado para aluno:", error);
    window.location.href = "index.html";
    return null;
  }

  localStorage.setItem("role", "aluno");
  localStorage.setItem("alunoId", perfil.aluno_id || "");

  localStorage.removeItem("alunoIdVisualizacao");

  return perfil;
}

/* ===============================
   6) ALUNO OU PROFESSOR VISUALIZANDO COMO ALUNO
================================ */
export async function exigirAlunoOuProfessorFuncionario() {
  const user = await exigirLogin();
  if (!user) return null;

  const { data: perfil, error } = await supabase
    .from("perfil")
    .select("role, aluno_id, professor_id")
    .eq("user_id", user.id)
    .single();

  if (error || !perfil) {
    console.error("Perfil não encontrado:", error);
    window.location.href = "index.html";
    return null;
  }

  if (perfil.role === "aluno") {
    localStorage.setItem("role", "aluno");
    localStorage.setItem("alunoId", perfil.aluno_id || "");
    localStorage.removeItem("alunoIdVisualizacao");

    return perfil;
  }

  if (perfil.role === "professor") {
    localStorage.setItem("role", "professor");
    localStorage.setItem("professorId", perfil.professor_id || "");

    let alunoIdVisualizacao =
      localStorage.getItem("alunoIdVisualizacao") ||
      localStorage.getItem("alunoId") ||
      localStorage.getItem("aluno_id") ||
      localStorage.getItem("idAluno");

    if (!alunoIdVisualizacao && user.email) {
      const { data: alunoPorEmail, error: erroAlunoEmail } = await supabase
        .from("aluno")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      if (erroAlunoEmail) {
        console.error("Erro ao buscar aluno pelo email:", erroAlunoEmail);
      }

      if (alunoPorEmail?.id) {
        alunoIdVisualizacao = alunoPorEmail.id;
      }
    }

    if (!alunoIdVisualizacao) {
      window.location.href = "home-professor.html";
      return null;
    }

    localStorage.setItem("alunoIdVisualizacao", String(alunoIdVisualizacao));
    localStorage.setItem("alunoId", String(alunoIdVisualizacao));

    return perfil;
  }

  window.location.href = "index.html";
  return null;
}