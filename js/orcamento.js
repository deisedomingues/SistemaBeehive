document.addEventListener("DOMContentLoaded", () => {
  const formOrcamento = document.getElementById("formOrcamento");

  const secaoPessoa = document.getElementById("secaoPessoa");
  const secaoEmpresa = document.getElementById("secaoEmpresa");

  const campoQuantidadeGrupo = document.getElementById(
    "campoQuantidadeGrupo"
  );

  const campoWhatsapp = document.getElementById("campoWhatsapp");
  const campoEmail = document.getElementById("campoEmail");

  const nomeEmpresa = document.getElementById("nomeEmpresa");
  const whatsapp = document.getElementById("whatsapp");
  const email = document.getElementById("email");

  const interesseNenhuma = document.getElementById(
    "interesseNenhuma"
  );

  const mensagemFormulario = document.getElementById(
    "mensagemFormulario"
  );

  function obterValorRadio(nomeCampo) {
    const selecionado = document.querySelector(
      `input[name="${nomeCampo}"]:checked`
    );

    return selecionado ? selecionado.value : "";
  }

  function limparRadios(nomeCampo) {
    const radios = document.querySelectorAll(
      `input[name="${nomeCampo}"]`
    );

    radios.forEach((radio) => {
      radio.checked = false;
      radio.required = false;
    });
  }

  function definirRadiosObrigatorios(
    nomeCampo,
    obrigatorio
  ) {
    const radios = document.querySelectorAll(
      `input[name="${nomeCampo}"]`
    );

    radios.forEach((radio) => {
      radio.required = obrigatorio;
    });
  }

  function obterInteressesSelecionados() {
    const selecionados = document.querySelectorAll(
      'input[name="interesses"]:checked'
    );

    return Array.from(selecionados).map(
      (item) => item.value
    );
  }

  function mostrarMensagem(texto) {
    mensagemFormulario.textContent = texto;

    mensagemFormulario.className =
      "mensagem-formulario erro";

    mensagemFormulario.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function limparMensagem() {
    mensagemFormulario.textContent = "";

    mensagemFormulario.className =
      "mensagem-formulario";
  }

  function atualizarTipoSolicitacao() {
    const tipoSolicitacao = obterValorRadio(
      "solicitacao_em_nome"
    );

    const solicitacaoPessoal =
      tipoSolicitacao === "pessoal";

    const solicitacaoEmpresa =
      tipoSolicitacao === "empresa";

    secaoPessoa.classList.toggle(
      "ativo",
      solicitacaoPessoal
    );

    secaoEmpresa.classList.toggle(
      "ativo",
      solicitacaoEmpresa
    );

    definirRadiosObrigatorios(
      "tipo_aula_particular",
      solicitacaoPessoal
    );

    definirRadiosObrigatorios(
      "quantidade_funcionarios",
      solicitacaoEmpresa
    );

    if (!solicitacaoPessoal) {
      limparRadios("tipo_aula_particular");
      limparRadios("quantidade_grupo");

      campoQuantidadeGrupo.classList.remove(
        "ativo"
      );
    }

    if (!solicitacaoEmpresa) {
      nomeEmpresa.value = "";

      limparRadios("quantidade_funcionarios");
    }
  }

  function atualizarQuantidadeGrupo() {
    const tipoAula = obterValorRadio(
      "tipo_aula_particular"
    );

    const aulaEmGrupo = tipoAula === "grupo";

    campoQuantidadeGrupo.classList.toggle(
      "ativo",
      aulaEmGrupo
    );

    definirRadiosObrigatorios(
      "quantidade_grupo",
      aulaEmGrupo
    );

    if (!aulaEmGrupo) {
      limparRadios("quantidade_grupo");
    }
  }

  function atualizarCampoContato() {
    const preferenciaContato = obterValorRadio(
      "preferencia_contato"
    );

    const contatoWhatsapp =
      preferenciaContato === "whatsapp";

    const contatoEmail =
      preferenciaContato === "email";

    campoWhatsapp.classList.toggle(
      "ativo",
      contatoWhatsapp
    );

    campoEmail.classList.toggle(
      "ativo",
      contatoEmail
    );

    whatsapp.required = contatoWhatsapp;
    email.required = contatoEmail;

    if (!contatoWhatsapp) {
      whatsapp.value = "";
    }

    if (!contatoEmail) {
      email.value = "";
    }
  }

  function formatarTelefone(valor) {
    const numeros = valor
      .replace(/\D/g, "")
      .slice(0, 11);

    if (numeros.length <= 2) {
      return numeros;
    }

    if (numeros.length <= 6) {
      return (
        `(${numeros.slice(0, 2)}) ` +
        `${numeros.slice(2)}`
      );
    }

    if (numeros.length <= 10) {
      return (
        `(${numeros.slice(0, 2)}) ` +
        `${numeros.slice(2, 6)}-` +
        `${numeros.slice(6)}`
      );
    }

    return (
      `(${numeros.slice(0, 2)}) ` +
      `${numeros.slice(2, 7)}-` +
      `${numeros.slice(7)}`
    );
  }

  function telefoneValido(valor) {
    const numeros = valor.replace(/\D/g, "");

    return (
      numeros.length === 10 ||
      numeros.length === 11
    );
  }

  function emailValido(valor) {
    const formatoEmail =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return formatoEmail.test(valor);
  }

  function configurarInteresses() {
    const checkboxes = document.querySelectorAll(
      'input[name="interesses"]'
    );

    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        if (
          checkbox.value === "nenhuma" &&
          checkbox.checked
        ) {
          checkboxes.forEach((item) => {
            if (item.value !== "nenhuma") {
              item.checked = false;
            }
          });

          return;
        }

        if (
          checkbox.value !== "nenhuma" &&
          checkbox.checked &&
          interesseNenhuma
        ) {
          interesseNenhuma.checked = false;
        }
      });
    });
  }

  function validarFormulario() {
    const nome = document
      .getElementById("nome")
      .value
      .trim();

    const solicitacaoEmNome = obterValorRadio(
      "solicitacao_em_nome"
    );

    const curso = obterValorRadio("curso");

    const preferenciaContato = obterValorRadio(
      "preferencia_contato"
    );

    if (nome.length < 2) {
      mostrarMensagem(
        "Digite seu nome para continuar."
      );

      return false;
    }

    if (!solicitacaoEmNome) {
      mostrarMensagem(
        "Informe se o orçamento é em seu nome ou em nome de uma empresa."
      );

      return false;
    }

    if (solicitacaoEmNome === "pessoal") {
      const tipoAula = obterValorRadio(
        "tipo_aula_particular"
      );

      if (!tipoAula) {
        mostrarMensagem(
          "Escolha entre aula individual ou aula em grupo."
        );

        return false;
      }

      if (tipoAula === "grupo") {
        const quantidadeGrupo = obterValorRadio(
          "quantidade_grupo"
        );

        if (!quantidadeGrupo) {
          mostrarMensagem(
            "Informe a previsão de participantes do grupo."
          );

          return false;
        }
      }
    }

    if (solicitacaoEmNome === "empresa") {
      const quantidadeFuncionarios =
        obterValorRadio(
          "quantidade_funcionarios"
        );

      if (!quantidadeFuncionarios) {
        mostrarMensagem(
          "Informe a previsão de participantes."
        );

        return false;
      }
    }

    if (!curso) {
      mostrarMensagem(
        "Escolha o curso desejado."
      );

      return false;
    }

    if (!preferenciaContato) {
      mostrarMensagem(
        "Escolha como prefere ser contatado."
      );

      return false;
    }

    if (
      preferenciaContato === "whatsapp" &&
      !telefoneValido(whatsapp.value)
    ) {
      mostrarMensagem(
        "Digite um número de WhatsApp válido, incluindo o DDD."
      );

      return false;
    }

    if (
      preferenciaContato === "email" &&
      !emailValido(email.value.trim())
    ) {
      mostrarMensagem(
        "Digite um endereço de e-mail válido."
      );

      return false;
    }

    return true;
  }

  document
    .querySelectorAll(
      'input[name="solicitacao_em_nome"]'
    )
    .forEach((radio) => {
      radio.addEventListener(
        "change",
        atualizarTipoSolicitacao
      );
    });

  document
    .querySelectorAll(
      'input[name="tipo_aula_particular"]'
    )
    .forEach((radio) => {
      radio.addEventListener(
        "change",
        atualizarQuantidadeGrupo
      );
    });

  document
    .querySelectorAll(
      'input[name="preferencia_contato"]'
    )
    .forEach((radio) => {
      radio.addEventListener(
        "change",
        atualizarCampoContato
      );
    });

  whatsapp.addEventListener("input", () => {
    whatsapp.value = formatarTelefone(
      whatsapp.value
    );
  });

  configurarInteresses();

  formOrcamento.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();

      limparMensagem();

      if (!validarFormulario()) {
        return;
      }

      const solicitacaoEmNome = obterValorRadio(
        "solicitacao_em_nome"
      );

      const preferenciaContato = obterValorRadio(
        "preferencia_contato"
      );

      const tipoAulaParticular =
        solicitacaoEmNome === "pessoal"
          ? obterValorRadio(
              "tipo_aula_particular"
            )
          : null;

      const quantidadeGrupo =
        tipoAulaParticular === "grupo"
          ? obterValorRadio(
              "quantidade_grupo"
            )
          : null;

      const quantidadeFuncionarios =
        solicitacaoEmNome === "empresa"
          ? obterValorRadio(
              "quantidade_funcionarios"
            )
          : null;

      const nomeEmpresaPreenchido =
        nomeEmpresa.value.trim();

      const respostasOrcamento = {
        nome: document
          .getElementById("nome")
          .value
          .trim(),

        solicitacao_em_nome:
          solicitacaoEmNome,

        nome_empresa:
          solicitacaoEmNome === "empresa" &&
          nomeEmpresaPreenchido
            ? nomeEmpresaPreenchido
            : null,

        tipo_aula_particular:
          tipoAulaParticular,

        quantidade_grupo:
          quantidadeGrupo,

        quantidade_funcionarios:
          quantidadeFuncionarios,

        curso: obterValorRadio("curso"),

        aulas_por_semana: 2,

        preferencia_contato:
          preferenciaContato,

        whatsapp:
          preferenciaContato === "whatsapp"
            ? whatsapp.value.replace(/\D/g, "")
            : null,

        email:
          preferenciaContato === "email"
            ? email.value
                .trim()
                .toLowerCase()
            : null,

        interesses:
          obterInteressesSelecionados(),

        criado_em: new Date().toISOString()
      };

      try {
        sessionStorage.setItem(
          "bee_orcamento_respostas",
          JSON.stringify(
            respostasOrcamento
          )
        );

        window.location.href =
          "resultado-orcamento.html";
      } catch (error) {
        console.error(
          "Não foi possível guardar as respostas:",
          error
        );

        mostrarMensagem(
          "Não foi possível continuar neste momento. Atualize a página e tente novamente."
        );
      }
    }
  );
});