import { supabase } from "./supabase.js";

const form = document.getElementById("form-login");
const msg = document.getElementById("msg");

function mostrarMensagem(texto, ok = true) {
  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 2200);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim().toLowerCase();
  const senha = document.getElementById("senha").value;

  // 1️⃣ Login no Auth
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha
  });

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Login inválido. Verifique e-mail e senha.", false);
    return;
  }

  // 2️⃣ Pegar usuário logado
  const { data: userData, error: errUser } = await supabase.auth.getUser();

  if (errUser || !userData?.user) {
    console.error(errUser);
    mostrarMensagem("❌ Não foi possível validar o usuário logado.", false);
    return;
  }

  const user = userData.user;

  // 3️⃣ Buscar perfil (admin, professor ou aluno)
  const { data: perfil, error: errPerfil } = await supabase
    .from("perfil")
    .select("role, professor_id, aluno_id")
    .eq("user_id", user.id)
    .single();

  if (errPerfil || !perfil) {
    console.error(errPerfil);
    mostrarMensagem("⚠️ Seu usuário não tem perfil configurado.", false);
    return;
  }

  // Guardar role
  localStorage.setItem("role", perfil.role);

  // Limpar dados antigos
  localStorage.removeItem("professorId");
  localStorage.removeItem("professorNome");
  localStorage.removeItem("professorEmail");
  localStorage.removeItem("alunoId");



  // ===============================
  // 👨‍🏫 PROFESSOR
  // ===============================
  if (perfil.role === "professor") {

    if (!perfil.professor_id) {
      mostrarMensagem("⚠️ Professor sem vínculo (professor_id).", false);
      return;
    }

    localStorage.setItem("professorId", perfil.professor_id);

    const { data: prof, error: errProf } = await supabase
      .from("professor")
      .select("id, nome, email")
      .eq("id", perfil.professor_id)
      .single();

    if (!errProf && prof) {
      localStorage.setItem("professorNome", prof.nome);
      localStorage.setItem("professorEmail", prof.email || "");
    }
  }



  // ===============================
  // 🎓 ALUNO
  // ===============================
  if (perfil.role === "aluno") {

    if (!perfil.aluno_id) {
      mostrarMensagem("⚠️ Aluno sem vínculo (aluno_id).", false);
      return;
    }

    localStorage.setItem("alunoId", perfil.aluno_id);

    const { data: aluno, error: errAluno } = await supabase
      .from("aluno")
      .select("id, nome, email")
      .eq("id", perfil.aluno_id)
      .single();

    if (!errAluno && aluno) {
      localStorage.setItem("alunoNome", aluno.nome);
      localStorage.setItem("alunoEmail", aluno.email || "");
    }
  }



  // ===============================
  // ✅ Mensagem
  // ===============================
  mostrarMensagem("✅ Login realizado com sucesso");



  // ===============================
  // 🚀 Redirecionamento
  // ===============================
  setTimeout(() => {

    if (perfil.role === "admin") {
      window.location.href = "home-admin.html";
      return;
    }

    if (perfil.role === "professor") {
      window.location.href = "home-professor.html";
      return;
    }

    if (perfil.role === "aluno") {
      window.location.href = "home-aluno.html";
      return;
    }

    // fallback
    window.location.href = "login.html";

  }, 500);

});