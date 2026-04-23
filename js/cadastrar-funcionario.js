document.addEventListener("DOMContentLoaded", async () => {
  if (typeof exigirAdmin === "function") {
    await exigirAdmin();
  }

  const form = document.getElementById("formFuncionario");
  const msg = document.getElementById("msg");

  const nome = document.getElementById("nome");
  const emailInstitucional = document.getElementById("emailInstitucional");
  const telefone = document.getElementById("telefone");
  const dataNascimento = document.getElementById("dataNascimento");
  const dataAdmissao = document.getElementById("dataAdmissao");
  const ativo = document.getElementById("ativo");
  const observacao = document.getElementById("observacao");

  function mostrarMsg(texto, tipo = "sucesso") {
    msg.style.display = "block";
    msg.textContent = texto;
    msg.className = tipo === "erro" ? "msg-erro" : "msg-sucesso";
  }

  function limparTexto(valor) {
    return valor && valor.trim() !== "" ? valor.trim() : null;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nomeFuncionario = limparTexto(nome.value);

    if (!nomeFuncionario) {
      mostrarMsg("Informe o nome do funcionário.", "erro");
      return;
    }

    const novoFuncionario = {
      nome: nomeFuncionario,
      email_institucional: limparTexto(emailInstitucional.value),
      telefone: limparTexto(telefone.value),
      data_nascimento: dataNascimento.value || null,
      data_admissao: dataAdmissao.value || null,
      ativo: ativo.value === "true",
      observacao: limparTexto(observacao.value)
    };

    const { error } = await supabase
      .from("funcionario")
      .insert([novoFuncionario]);

    if (error) {
      console.error(error);

      if (error.code === "23505") {
        mostrarMsg("Já existe um funcionário com este e-mail institucional.", "erro");
        return;
      }

      mostrarMsg("Erro ao cadastrar funcionário.", "erro");
      return;
    }

    mostrarMsg("Funcionário cadastrado com sucesso!");
    form.reset();
    ativo.value = "true";
  });
});