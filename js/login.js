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

  // 1) Login no Auth
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha
  });

  if (error) {
    console.error(error);
    mostrarMensagem("❌ Login inválido. Verifique e-mail e senha.", false);
    return;
  }

  // 2) Pegar usuário logado
  const { data: userData, error: errUser } = await supabase.auth.getUser();
  if (errUser || !userData?.user) {
    console.error(errUser);
    mostrarMensagem("❌ Não foi possível validar o usuário logado.", false);
    return;
  }

  const user = userData.user;

  // 3) Buscar perfil (admin ou professor)
  const { data: perfil, error: errPerfil } = await supabase
    .from("perfil")
    .select("role, professor_id")
    .eq("user_id", user.id)
    .single();

  if (errPerfil || !perfil) {
    console.error(errPerfil);
    mostrarMensagem("⚠️ Seu usuário não tem perfil configurado.", false);
    return;
  }

  // Guardar role para as páginas saberem o que mostrar/permitir
  localStorage.setItem("role", perfil.role);

  // 4) Se for professor, salvar professorId e (opcional) nome
  if (perfil.role === "professor") {
    if (!perfil.professor_id) {
      mostrarMensagem("⚠️ Professor sem vínculo (professor_id).", false);
      return;
    }

    localStorage.setItem("professorId", perfil.professor_id);

    // Buscar nome do professor (para mostrar na home, se quiser)
    const { data: prof, error: errProf } = await supabase
      .from("professor")
      .select("id, nome, email")
      .eq("id", perfil.professor_id)
      .single();

    if (!errProf && prof) {
      localStorage.setItem("professorNome", prof.nome);
      localStorage.setItem("professorEmail", prof.email || "");
    }
  } else {
    // admin: limpa dados de professor, caso existam
    localStorage.removeItem("professorId");
    localStorage.removeItem("professorNome");
    localStorage.removeItem("professorEmail");
  }

    //mostrarMensagem("✅ Entrou!");

  // 5) Redirecionar para a HOME correta
  setTimeout(() => {
    if (perfil.role === "admin") {
      window.location.href = "home-admin.html";
    } else {
      window.location.href = "home-professor.html";
    }
  }, 400);
});
