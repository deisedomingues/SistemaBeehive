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

let sessaoDoConvite = null;

/* =========================
   Mensagens
========================= */

function mostrarMensagem(
  texto,
  tipo = "erro"
) {
  msg.style.display = "block";
  msg.textContent = texto;

  if (tipo === "sucesso") {
    msg.className = "msg sucesso";
  } else {
    msg.className = "msg erro";
  }
}

function esconderMensagem() {
  msg.style.display = "none";
  msg.textContent = "";
  msg.className = "";
}

/* =========================
   Cards
========================= */

function esconderTodosOsCards() {
  cardCarregando.style.display =
    "none";

  cardLinkInvalido.style.display =
    "none";

  cardCriarSenha.style.display =
    "none";

  cardSucesso.style.display =
    "none";
}

function mostrarCardCriarSenha() {
  esconderTodosOsCards();
  esconderMensagem();

  cardCriarSenha.style.display =
    "block";
}

function mostrarCardLinkInvalido() {
  esconderTodosOsCards();
  esconderMensagem();

  cardLinkInvalido.style.display =
    "block";
}

function mostrarCardSucesso() {
  esconderTodosOsCards();
  esconderMensagem();

  cardSucesso.style.display =
    "block";
}

/* =========================
   Validação da senha
========================= */

function senhaPossuiTamanhoValido(
  senha
) {
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
    confirmarSenha.value.length > 0 &&
    novaSenha.value ===
      confirmarSenha.value
  );
}

function atualizarAparenciaRegra(
  elemento,
  regraCumprida
) {
  elemento.style.fontWeight =
    regraCumprida
      ? "bold"
      : "normal";

  elemento.setAttribute(
    "data-cumprida",
    regraCumprida
      ? "true"
      : "false"
  );
}

function formularioEstaValido() {
  const senha = novaSenha.value;

  return (
    Boolean(sessaoDoConvite) &&
    senhaPossuiTamanhoValido(senha) &&
    senhaPossuiLetra(senha) &&
    senhaPossuiNumero(senha) &&
    senhasSaoIguais()
  );
}

function validarCamposSenha() {
  const senha = novaSenha.value;

  const confirmacao =
    confirmarSenha.value;

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

  if (
    confirmacao.length > 0 &&
    senha !== confirmacao
  ) {
    mostrarMensagem(
      "As senhas não coincidem. Digite a mesma senha nos dois campos.",
      "erro"
    );
  } else {
    esconderMensagem();
  }

  btnSalvarSenha.disabled =
    !formularioEstaValido();
}

/* =========================
   Mostrar senha
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
  const metadados =
    usuario?.user_metadata || {};

  return (
    metadados.nome ||
    metadados.name ||
    "novo usuário"
  );
}

function exibirDadosDoUsuario(usuario) {
  nomeUsuario.textContent =
    obterNomeDoUsuario(usuario);

  emailUsuario.textContent =
    usuario?.email || "—";

  dadosConvite.style.display =
    "block";
}

/* =========================
   Dados do endereço
========================= */

function obterParametrosDoHash() {
  const hash =
    window.location.hash.replace(
      /^#/,
      ""
    );

  return new URLSearchParams(hash);
}

function enderecoPossuiDadosDeConvite() {
  const parametrosUrl =
    new URLSearchParams(
      window.location.search
    );

  const parametrosHash =
    obterParametrosDoHash();

  const possuiCodigo =
    parametrosUrl.has("code");

  const possuiTokenNoHash =
    parametrosHash.has(
      "access_token"
    ) &&
    parametrosHash.has(
      "refresh_token"
    );

  const tipoDoHash =
    parametrosHash.get("type");

  const tipoPermitido =
    !tipoDoHash ||
    tipoDoHash === "invite" ||
    tipoDoHash === "recovery" ||
    tipoDoHash === "signup" ||
    tipoDoHash === "magiclink";

  return (
    possuiCodigo ||
    (
      possuiTokenNoHash &&
      tipoPermitido
    )
  );
}

function limparEndereco() {
  const urlLimpa =
    `${window.location.origin}${window.location.pathname}`;

  window.history.replaceState(
    {},
    document.title,
    urlLimpa
  );
}

/* =========================
   Processar convite
========================= */

async function processarCodigoPkce() {
  const parametros =
    new URLSearchParams(
      window.location.search
    );

  const codigo =
    parametros.get("code");

  if (!codigo) {
    return null;
  }

  const { data, error } =
    await supabase.auth
      .exchangeCodeForSession(
        codigo
      );

  if (error) {
    throw error;
  }

  return data?.session || null;
}

async function processarTokensDoHash() {
  const parametrosHash =
    obterParametrosDoHash();

  const accessToken =
    parametrosHash.get(
      "access_token"
    );

  const refreshToken =
    parametrosHash.get(
      "refresh_token"
    );

  if (
    !accessToken ||
    !refreshToken
  ) {
    return null;
  }

  const { data, error } =
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

  if (error) {
    throw error;
  }

  return data?.session || null;
}

async function validarConvite() {
  cardCarregando.style.display =
    "block";

  try {
    if (
      !enderecoPossuiDadosDeConvite()
    ) {
      mostrarCardLinkInvalido();
      return;
    }

    let sessao = null;

    const parametrosUrl =
      new URLSearchParams(
        window.location.search
      );

    if (parametrosUrl.has("code")) {
      sessao =
        await processarCodigoPkce();
    } else {
      sessao =
        await processarTokensDoHash();
    }

    if (!sessao?.user) {
      mostrarCardLinkInvalido();
      return;
    }

    sessaoDoConvite = sessao;

    limparEndereco();

    exibirDadosDoUsuario(
      sessaoDoConvite.user
    );

    mostrarCardCriarSenha();
    validarCamposSenha();
  } catch (error) {
    console.error(
      "Erro ao validar convite:",
      error
    );

    sessaoDoConvite = null;
    mostrarCardLinkInvalido();
  }
}

/* =========================
   Eventos dos campos
========================= */

novaSenha.addEventListener(
  "input",
  validarCamposSenha
);

confirmarSenha.addEventListener(
  "input",
  validarCamposSenha
);

/* =========================
   Salvar senha
========================= */

formDefinirSenha.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    if (
      !sessaoDoConvite ||
      !formularioEstaValido()
    ) {
      if (
        confirmarSenha.value.length > 0 &&
        novaSenha.value !==
          confirmarSenha.value
      ) {
        mostrarMensagem(
          "As senhas não coincidem. Digite a mesma senha nos dois campos.",
          "erro"
        );

        confirmarSenha.focus();
        return;
      }

      mostrarMensagem(
        "Confira os requisitos da senha antes de continuar.",
        "erro"
      );

      return;
    }

    esconderMensagem();

    const senha = novaSenha.value;

    const textoOriginalBotao =
      btnSalvarSenha.textContent;

    btnSalvarSenha.disabled = true;

    btnSalvarSenha.textContent =
      "Criando senha...";

    try {
      const { data, error } =
        await supabase.auth.updateUser({
          password: senha
        });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error(
          "Não foi possível confirmar a criação da senha."
        );
      }

      novaSenha.value = "";
      confirmarSenha.value = "";

      sessaoDoConvite = null;

      mostrarCardSucesso();

      await supabase.auth.signOut();

      setTimeout(() => {
        window.location.href =
          "index.html";
      }, 4000);
    } catch (error) {
      console.error(
        "Erro ao criar senha:",
        error
      );

      const mensagemOriginal =
        String(
          error?.message || ""
        ).toLowerCase();

      let mensagem =
        "Não foi possível criar a senha. Tente novamente.";

      if (
        mensagemOriginal.includes(
          "expired"
        ) ||
        mensagemOriginal.includes(
          "invalid"
        ) ||
        mensagemOriginal.includes(
          "session"
        )
      ) {
        mensagem =
          "O link de convite expirou ou não é mais válido. Solicite um novo convite à Beehive.";
      }

      if (
        mensagemOriginal.includes(
          "password"
        ) &&
        mensagemOriginal.includes(
          "characters"
        )
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