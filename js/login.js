import { supabase } from "./supabase.js";

const form = document.getElementById("form-login");
const msg = document.getElementById("msg");
const btnEntrar = document.getElementById("btnEntrar");

/* =====================================================
   MENSAGENS
===================================================== */

function mostrarMensagem(texto, ok = true) {
  if (!msg) return;

  msg.textContent = texto;
  msg.style.display = "block";
  msg.style.backgroundColor = ok ? "#e8f5e9" : "#ffebee";
  msg.style.color = ok ? "#1b5e20" : "#b71c1c";
  msg.style.border = ok
    ? "1px solid #a5d6a7"
    : "1px solid #ef9a9a";

  setTimeout(() => {
    msg.style.display = "none";
    msg.textContent = "";
  }, 3500);
}

/* =====================================================
   BOTÃO DE LOGIN
===================================================== */

function definirCarregamento(carregando) {
  if (!btnEntrar) return;

  btnEntrar.disabled = carregando;
  btnEntrar.textContent = carregando
    ? "Entrando..."
    : "Entrar";

  btnEntrar.style.opacity = carregando ? "0.7" : "1";
  btnEntrar.style.cursor = carregando
    ? "not-allowed"
    : "pointer";
}

/* =====================================================
   LIMPAR DADOS ANTIGOS
===================================================== */

function limparDadosLocais() {
  localStorage.removeItem("role");

  localStorage.removeItem("professorId");
  localStorage.removeItem("professorNome");
  localStorage.removeItem("professorEmail");

  localStorage.removeItem("alunoId");
  localStorage.removeItem("alunoNome");
  localStorage.removeItem("alunoEmail");
}

/* =====================================================
   FORMULÁRIO DE LOGIN
===================================================== */

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  definirCarregamento(true);

  try {
    const email = document
      .getElementById("email")
      .value
      .trim()
      .toLowerCase();

    const senha = document
      .getElementById("senha")
      .value;

    /* ---------------------------------------------
       1. LOGIN NO SUPABASE AUTH
    --------------------------------------------- */

    const { error: erroLogin } =
      await supabase.auth.signInWithPassword({
        email,
        password: senha
      });

    if (erroLogin) {
      console.error("Erro no login:", erroLogin);

      mostrarMensagem(
        "❌ Login inválido. Verifique o e-mail e a senha.",
        false
      );

      return;
    }

    /* ---------------------------------------------
       2. PEGAR O USUÁRIO LOGADO
    --------------------------------------------- */

    const {
      data: dadosUsuario,
      error: erroUsuario
    } = await supabase.auth.getUser();

    if (
      erroUsuario ||
      !dadosUsuario?.user
    ) {
      console.error(
        "Erro ao validar usuário:",
        erroUsuario
      );

      await supabase.auth.signOut();

      mostrarMensagem(
        "❌ Não foi possível validar o usuário logado.",
        false
      );

      return;
    }

    const usuario = dadosUsuario.user;

    /* ---------------------------------------------
       3. BUSCAR O PERFIL
    --------------------------------------------- */

    const {
      data: perfil,
      error: erroPerfil
    } = await supabase
      .from("perfil")
      .select(`
        role,
        professor_id,
        aluno_id
      `)
      .eq("user_id", usuario.id)
      .single();

    if (
      erroPerfil ||
      !perfil
    ) {
      console.error(
        "Erro ao buscar perfil:",
        erroPerfil
      );

      await supabase.auth.signOut();
      limparDadosLocais();

      mostrarMensagem(
        "⚠️ Seu usuário não possui um perfil configurado.",
        false
      );

      return;
    }

    /* ---------------------------------------------
       4. LIMPAR INFORMAÇÕES ANTIGAS
    --------------------------------------------- */

    limparDadosLocais();

    /* ---------------------------------------------
       5. SALVAR O PERFIL
    --------------------------------------------- */

    localStorage.setItem(
      "role",
      perfil.role
    );

    /* =================================================
       PROFESSOR
    ================================================= */

    if (perfil.role === "professor") {
      if (!perfil.professor_id) {
        await supabase.auth.signOut();
        limparDadosLocais();

        mostrarMensagem(
          "⚠️ Professor sem vínculo com um cadastro.",
          false
        );

        return;
      }

      localStorage.setItem(
        "professorId",
        String(perfil.professor_id)
      );

      const {
        data: professor,
        error: erroProfessor
      } = await supabase
        .from("professor")
        .select(`
          id,
          nome,
          email
        `)
        .eq("id", perfil.professor_id)
        .single();

      if (erroProfessor) {
        console.error(
          "Erro ao buscar professor:",
          erroProfessor
        );
      }

      if (professor) {
        localStorage.setItem(
          "professorNome",
          professor.nome || ""
        );

        localStorage.setItem(
          "professorEmail",
          professor.email || ""
        );
      }
    }

    /* =================================================
       ALUNO
    ================================================= */

    if (perfil.role === "aluno") {
      if (!perfil.aluno_id) {
        await supabase.auth.signOut();
        limparDadosLocais();

        mostrarMensagem(
          "⚠️ Aluno sem vínculo com um cadastro.",
          false
        );

        return;
      }

      localStorage.setItem(
        "alunoId",
        String(perfil.aluno_id)
      );

      const {
        data: aluno,
        error: erroAluno
      } = await supabase
        .from("aluno")
        .select(`
          id,
          nome,
          email
        `)
        .eq("id", perfil.aluno_id)
        .single();

      if (erroAluno) {
        console.error(
          "Erro ao buscar aluno:",
          erroAluno
        );
      }

      if (aluno) {
        localStorage.setItem(
          "alunoNome",
          aluno.nome || ""
        );

        localStorage.setItem(
          "alunoEmail",
          aluno.email || ""
        );
      }
    }

    /* ---------------------------------------------
       6. VALIDAR ROLE
    --------------------------------------------- */

    const rolesPermitidas = [
      "admin",
      "professor",
      "aluno"
    ];

    if (!rolesPermitidas.includes(perfil.role)) {
      await supabase.auth.signOut();
      limparDadosLocais();

      mostrarMensagem(
        "⚠️ Tipo de perfil não reconhecido.",
        false
      );

      return;
    }

    /* ---------------------------------------------
       7. MENSAGEM DE SUCESSO
    --------------------------------------------- */

    mostrarMensagem(
      "✅ Login realizado com sucesso."
    );

    /* ---------------------------------------------
       8. REDIRECIONAMENTO
    --------------------------------------------- */

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
      }
    }, 500);

  } catch (erro) {
    console.error(
      "Erro inesperado no login:",
      erro
    );

    mostrarMensagem(
      "❌ Ocorreu um erro inesperado. Tente novamente.",
      false
    );
  } finally {
    definirCarregamento(false);
  }
});