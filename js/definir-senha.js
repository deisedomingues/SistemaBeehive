import { supabase } from "./supabase.js";

/* =========================
   Elementos da página
========================= */

const msg = document.getElementById("msg");

const cardCarregando = document.getElementById(
  "cardCarregando"
);

const cardLinkInvalido = document.getElementById(
  "cardLinkInvalido"
);

const cardCriarSenha = document.getElementById(
  "cardCriarSenha"
);

const cardSucesso = document.getElementById(
  "cardSucesso"
);

const dadosConvite = document.getElementById(
  "dadosConvite"
);

const nomeUsuario = document.getElementById(
  "nomeUsuario"
);

const emailUsuario = document.getElementById(
  "emailUsuario"
);

const formDefinirSenha = document.getElementById(
  "formDefinirSenha"
);

const novaSenha = document.getElementById(
  "novaSenha"
);

const confirmarSenha = document.getElementById(
  "confirmarSenha"
);

const btnMostrarNovaSenha = document.getElementById(
  "btnMostrarNovaSenha"
);

const btnMostrarConfirmacao = document.getElementById(
  "btnMostrarConfirmacao"
);

const btnSalvarSenha = document.getElementById(
  "btnSalvarSenha"
);

const regraTamanho = document.getElementById(
  "regraTamanho"
);

const regraLetra = document.getElementById(
  "regraLetra"
);

const regraNumero = document.getElementById(
  "regraNumero"
);

const regraIguais = document.getElementById(
  "regraIguais"
);

/* =========================
   Funções de mensagem
========================= */

function mostrarMensagem(texto, tipo = "erro") {
  msg.style.display = "block";
  msg.textContent = texto;

  if (tipo === "sucesso") {
    msg.className = "msg sucesso";
    return;
  }

  msg.className = "msg erro";
}

function esconderMensagem() {
  msg.style.display = "none";
  msg.textContent = "";
  msg.className = "";
}

/* =========================
   Controle dos cards
========================= */

function esconderTodosOsCards() {
  cardCarregando.style.display = "none";
  cardLinkInvalido.style.display = "none";
  cardCriarSenha.style.display = "none";
  cardSucesso.style.display = "none";
}

function mostrarCardCriarSenha() {
  esconderTodosOsCards();
  esconderMensagem();

  cardCriarSenha.style.display = "block";
}

function mostrarCardLinkInvalido() {
  esconderTodosOsCards();
  esconderMensagem();

  cardLinkInvalido.style.display = "block";
}

function mostrarCardSucesso() {
  esconderTodosOsCards();
  esconderMensagem();

  cardSucesso.style.display = "block";
}

/* =========================
   Validação da senha
========================= */

function senhaPossuiTamanhoValido(senha) {
  return senha.length >= 8;
}

function senhaPossuiLetra(senha) {
  return /[A-Za-zÀ-ÿ]/.test(senha);
}

function senhaPossuiNumero(senha) {
  return /\d/.test(senha);
}

function senhasSaoIguais() {
  return (
    novaSenha.value.length > 0 &&
    novaSenha.value === confirmarSenha.value
  );
}

function atualizarAparenciaRegra(
  elemento,
  regraCumprida
) {
  if (regraCumprida) {
    elemento.style.fontWeight = "bold";
    elemento.style.textDecoration = "none";
    elemento.setAttribute(
      "data-cumprida",
      "true"
    );

    return;
  }

  elemento.style.fontWeight = "normal";
  elemento.style.textDecoration = "none";
  elemento.setAttribute(
    "data-cumprida",
    "false"
  );
}

function formularioEstaValido() {
  const senha = novaSenha.value;

  return (
    senhaPossuiTamanhoValido(senha) &&
    senhaPossuiLetra(senha) &&
    senhaPossuiNumero(senha) &&
    senhasSaoIguais()
  );
}

function validarCamposSenha() {
  const senha = novaSenha.value;

  atualizarAparenciaRegra(
    regraTamanho,
    senhaPossuiTamanhoValido(senha)
  );

  atualizarAparenciaRegra(
    regraLetra,
    senhaPossuiLetra(senha)
  );

  atualizarAparenciaRegra(
    regraNumero,
    senhaPossuiNumero(senha)
  );

  atualizarAparenciaRegra(
    regraIguais,
    senhasSaoIguais()
  );

  btnSalvarSenha.disabled =
    !formularioEstaValido();
}

/* =========================
   Mostrar e ocultar senha
========================= */

function alternarVisibilidadeSenha(
  campo,
  botao
) {
  const estaOculta =
    campo.type === "password";

  campo.type = estaOculta
    ? "text"
    : "password";

  botao.textContent = estaOculta
    ? "Ocultar"
    : "Mostrar";
}

btnMostrarNovaSenha.addEventListener(
  "click",
  () => {
    alternarVisibilidadeSenha(
      novaSenha,
      btnMostrarNovaSenha
    );
  }
);

btnMostrarConfirmacao.addEventListener(
  "click",
  () => {
    alternarVisibilidadeSenha(
      confirmarSenha,
      btnMostrarConfirmacao
    );
  }
);

/* =========================
   Dados do usuário
========================= */

function obterNomeDoUsuario(usuario) {
  const metadados = usuario?.user_metadata || {};

  return (
    metadados.nome ||
    metadados.name ||
    "novo usuário"
  );
}

function exibirDadosDoUsuario(usuario) {
  const nome = obterNomeDoUsuario(usuario);
  const email = usuario?.email || "—";

  nomeUsuario.textContent = nome;
  emailUsuario.textContent = email;

  dadosConvite.style.display = "block";
}

/* =========================
   Processamento do convite
========================= */

async function trocarCodigoPorSessao() {
  const parametros = new URLSearchParams(
    window.location.search
  );

  const codigo = parametros.get("code");

  if (!codigo) {
    return null;
  }

  const {
    data,
    error
  } = await supabase.auth.exchangeCodeForSession(
    codigo
  );

  if (error) {
    throw error;
  }

  /*
    Retira o código da barra de endereço depois
    que ele já foi utilizado.
  */
  const urlLimpa =
    `${window.location.origin}${window.location.pathname}`;

  window.history.replaceState(
    {},
    document.title,
    urlLimpa
  );

  return data?.session || null;
}

async function aguardarProcessamentoAutomatico() {
  /*
    Quando o Supabase envia os dados na parte final
    do endereço, a biblioteca pode precisar de um
    pequeno intervalo para processá-los.
  */
  for (let tentativa = 0; tentativa < 12; tentativa += 1) {
    const {
      data,
      error
    } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (data?.session) {
      return data.session;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }

  return null;
}

async function validarConvite() {
  cardCarregando.style.display = "block";

  try {
    let sessao = null;

    /*
      Alguns links utilizam o fluxo PKCE e retornam
      um código na URL.

      Nesse caso, trocamos o código por uma sessão.
    */
    const parametros = new URLSearchParams(
      window.location.search
    );

    if (parametros.has("code")) {
      sessao = await trocarCodigoPorSessao();
    }

    /*
      Outros links são processados automaticamente
      pela biblioteca do Supabase.
    */
    if (!sessao) {
      sessao = await aguardarProcessamentoAutomatico();
    }

    if (!sessao?.user) {
      mostrarCardLinkInvalido();
      return;
    }

    exibirDadosDoUsuario(sessao.user);
    mostrarCardCriarSenha();
  } catch (error) {
    console.error(
      "Erro ao validar o convite:",
      error
    );

    mostrarCardLinkInvalido();
  }
}

/* =========================
   Eventos dos campos
========================= */

novaSenha.addEventListener(
  "input",
  () => {
    esconderMensagem();
    validarCamposSenha();
  }
);

confirmarSenha.addEventListener(
  "input",
  () => {
    esconderMensagem();
    validarCamposSenha();
  }
);

/* =========================
   Salvar a nova senha
========================= */

formDefinirSenha.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    esconderMensagem();

    if (!formularioEstaValido()) {
      mostrarMensagem(
        "Confira os requisitos da senha antes de continuar."
      );

      return;
    }

    const senha = novaSenha.value;

    const textoOriginalBotao =
      btnSalvarSenha.textContent;

    btnSalvarSenha.disabled = true;
    btnSalvarSenha.textContent =
      "Criando senha...";

    try {
      /*
        Confirma novamente que existe uma sessão
        válida antes de alterar a senha.
      */
      const {
        data: dadosSessao,
        error: erroSessao
      } = await supabase.auth.getSession();

      if (
        erroSessao ||
        !dadosSessao?.session
      ) {
        throw new Error(
          "O convite expirou ou não é mais válido."
        );
      }

      /*
        Atualiza a senha do usuário autenticado
        temporariamente pelo link de convite.
      */
      const {
        data,
        error
      } = await supabase.auth.updateUser({
        password: senha
      });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error(
          "Não foi possível confirmar a alteração da senha."
        );
      }

      novaSenha.value = "";
      confirmarSenha.value = "";

      mostrarCardSucesso();

      /*
        Encerra a sessão temporária do convite.

        A pessoa fará o primeiro login normalmente
        usando o e-mail e a senha escolhida.
      */
      await supabase.auth.signOut();

      setTimeout(() => {
        window.location.href = "index.html";
      }, 4000);
    } catch (error) {
      console.error(
        "Erro ao criar senha:",
        error
      );

      const mensagemOriginal =
        String(error?.message || "").toLowerCase();

      let mensagem =
        "Não foi possível criar a senha. Tente novamente.";

      if (
        mensagemOriginal.includes("expired") ||
        mensagemOriginal.includes("invalid") ||
        mensagemOriginal.includes("session")
      ) {
        mensagem =
          "O link de convite expirou ou não é mais válido. Solicite um novo convite à Beehive.";
      }

      if (
        mensagemOriginal.includes("password") &&
        mensagemOriginal.includes("characters")
      ) {
        mensagem =
          "A senha não atende aos requisitos de segurança.";
      }

      mostrarMensagem(
        mensagem,
        "erro"
      );

      btnSalvarSenha.disabled =
        !formularioEstaValido();
    } finally {
      btnSalvarSenha.textContent =
        textoOriginalBotao;
    }
  }
);

/* =========================
   Inicialização
========================= */

validarCamposSenha();
await validarConvite();