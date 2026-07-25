import { supabase } from "./supabase.js";

/* ===============================
   1) GARANTIR QUE O USUÁRIO ESTÁ LOGADO
================================ */
export async function exigirLogin() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    console.error(
      "Erro ao verificar login:",
      error
    );

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
   2) CARREGAR PERFIL DO USUÁRIO
================================ */
async function carregarPerfilDoUsuario(userId) {
  const {
    data: perfil,
    error
  } = await supabase
    .from("perfil")
    .select(`
      role,
      aluno_id,
      professor_id
    `)
    .eq("user_id", userId)
    .single();

  if (error || !perfil) {
    console.error(
      "Perfil não encontrado:",
      error
    );

    window.location.href = "index.html";
    return null;
  }

  return perfil;
}

/* ===============================
   3) SOMENTE ADMIN
================================ */
export async function exigirAdmin() {
  const user = await exigirLogin();

  if (!user) {
    return null;
  }

  const perfil =
    await carregarPerfilDoUsuario(user.id);

  if (!perfil) {
    return null;
  }

  if (perfil.role !== "admin") {
    console.error(
      "Acesso negado. Perfil atual:",
      perfil.role
    );

    window.location.href = "index.html";
    return null;
  }

  localStorage.setItem("role", "admin");

  return {
    ...perfil,
    user
  };
}

/* ===============================
   4) SOMENTE PROFESSOR
================================ */
export async function exigirProfessor() {
  const user = await exigirLogin();

  if (!user) {
    return null;
  }

  const perfil =
    await carregarPerfilDoUsuario(user.id);

  if (!perfil) {
    return null;
  }

  if (perfil.role !== "professor") {
    console.error(
      "Acesso negado para professor. Perfil atual:",
      perfil.role
    );

    window.location.href = "index.html";
    return null;
  }

  localStorage.setItem(
    "role",
    "professor"
  );

  localStorage.setItem(
    "professorId",
    perfil.professor_id || ""
  );

  return {
    ...perfil,
    user
  };
}

/* ===============================
   5) PROFESSOR OU ADMIN
================================ */
export async function exigirProfessorOuAdmin() {
  const user = await exigirLogin();

  if (!user) {
    return null;
  }

  const perfil =
    await carregarPerfilDoUsuario(user.id);

  if (!perfil) {
    return null;
  }

  const acessoPermitido =
    perfil.role === "professor" ||
    perfil.role === "admin";

  if (!acessoPermitido) {
    console.error(
      "Acesso permitido somente para professor ou admin."
    );

    window.location.href = "index.html";
    return null;
  }

  localStorage.setItem(
    "role",
    perfil.role
  );

  if (perfil.role === "professor") {
    localStorage.setItem(
      "professorId",
      perfil.professor_id || ""
    );
  }

  return {
    ...perfil,
    user
  };
}

/* ===============================
   6) SOMENTE ALUNO NORMAL
================================ */
export async function exigirAluno() {
  const user = await exigirLogin();

  if (!user) {
    return null;
  }

  const perfil =
    await carregarPerfilDoUsuario(user.id);

  if (!perfil) {
    return null;
  }

  if (perfil.role !== "aluno") {
    console.error(
      "Acesso negado para aluno. Perfil atual:",
      perfil.role
    );

    window.location.href = "index.html";
    return null;
  }

  if (!perfil.aluno_id) {
    console.error(
      "O perfil de aluno não possui aluno_id."
    );

    window.location.href = "index.html";
    return null;
  }

  localStorage.setItem(
    "role",
    "aluno"
  );

  localStorage.setItem(
    "alunoId",
    String(perfil.aluno_id)
  );

  localStorage.removeItem(
    "alunoIdVisualizacao"
  );

  return {
    ...perfil,
    user,
    alunoIdEfetivo:
      Number(perfil.aluno_id),
    visualizandoComoAluno: false
  };
}

/* ===============================
   7) LOCALIZAR CADASTRO DE ALUNO
      DA PROFESSORA
================================ */
async function buscarAlunoVinculadoAoProfessor(
  user
) {
  if (!user?.email) {
    return null;
  }

  const emailUsuario =
    String(user.email)
      .trim()
      .toLowerCase();

  const {
    data: aluno,
    error
  } = await supabase
    .from("aluno")
    .select(`
      id,
      nome,
      email
    `)
    .ilike(
      "email",
      emailUsuario
    )
    .maybeSingle();

  if (error) {
    console.error(
      "Erro ao buscar cadastro de aluno da professora:",
      error
    );

    return null;
  }

  return aluno || null;
}

/* ===============================
   8) ÁREA DO ALUNO

   Permite:
   - aluno comum;
   - professora que também é aluna.
================================ */
export async function exigirAlunoOuProfessorFuncionario() {
  const user = await exigirLogin();

  if (!user) {
    return null;
  }

  const perfil =
    await carregarPerfilDoUsuario(user.id);

  if (!perfil) {
    return null;
  }

  /* ===============================
     ALUNO COMUM
  ============================== */
  if (perfil.role === "aluno") {
    if (!perfil.aluno_id) {
      console.error(
        "O perfil de aluno não possui aluno_id."
      );

      window.location.href = "index.html";
      return null;
    }

    const alunoIdEfetivo =
      Number(perfil.aluno_id);

    localStorage.setItem(
      "role",
      "aluno"
    );

    localStorage.setItem(
      "alunoId",
      String(alunoIdEfetivo)
    );

    localStorage.removeItem(
      "alunoIdVisualizacao"
    );

    return {
      ...perfil,
      user,
      alunoIdEfetivo,
      visualizandoComoAluno: false
    };
  }

  /* ===============================
     PROFESSORA QUE TAMBÉM É ALUNA
  ============================== */
  if (perfil.role === "professor") {
    if (!perfil.professor_id) {
      console.error(
        "O perfil de professor não possui professor_id."
      );

      window.location.href = "index.html";
      return null;
    }

    localStorage.setItem(
      "role",
      "professor"
    );

    localStorage.setItem(
      "professorId",
      String(perfil.professor_id)
    );

    /*
      Não confiamos somente no alunoIdVisualizacao
      salvo no navegador, porque o localStorage pode
      ser alterado manualmente.

      Procuramos novamente o aluno pelo e-mail da
      pessoa autenticada.
    */
    const alunoVinculado =
      await buscarAlunoVinculadoAoProfessor(
        user
      );

    if (!alunoVinculado?.id) {
      console.error(
        "Esta professora não possui cadastro correspondente na tabela aluno."
      );

      localStorage.removeItem(
        "alunoIdVisualizacao"
      );

      window.location.href =
        "home-professor.html";

      return null;
    }

    const alunoIdEfetivo =
      Number(alunoVinculado.id);

    localStorage.setItem(
      "alunoIdVisualizacao",
      String(alunoIdEfetivo)
    );

    /*
      Não sobrescrevemos alunoId.

      alunoId representa o perfil de um aluno comum.
      alunoIdVisualizacao representa uma professora
      temporariamente visualizando sua área de aluna.
    */

    return {
      ...perfil,
      user,
      alunoIdEfetivo,
      alunoVinculado,
      visualizandoComoAluno: true
    };
  }

  console.error(
    "Este perfil não pode acessar a área do aluno:",
    perfil.role
  );

  window.location.href = "index.html";
  return null;
}