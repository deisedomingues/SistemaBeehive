import { supabase } from "./supabase.js";

const form = document.getElementById(
  "form-nova-senha"
);

const msg = document.getElementById("msg");

const carregandoLink = document.getElementById(
  "carregandoLink"
);

const textoOrientacao = document.getElementById(
  "textoOrientacao"
);

const btnSalvar = document.getElementById(
  "btnSalvar"
);

const btnVoltarLogin = document.getElementById(
  "btnVoltarLogin"
);

let linkValido = false;

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
}

/* =====================================================
   BOTÃO
===================================================== */

function definirCarregamento(carregando) {
  if (!btnSalvar) return;

  btnSalvar.disabled = carregando;
  btnSalvar.textContent = carregando
    ? "Salvando..."
    : "Salvar nova senha";

  btnSalvar.style.opacity = carregando ? "0.7" : "1";
  btnSalvar.style.cursor = carregando
    ? "not-allowed"
    : "pointer";
}

/* =====================================================
   EXIBIR FORMULÁRIO
===================================================== */

function liberarFormulario() {
  linkValido = true;

  carregandoLink.style.display = "none";
  form.style.display = "block";
}

/* =====================================================
   LINK INVÁLIDO OU EXPIRADO
===================================================== */

function informarLinkInvalido() {
  linkValido = false;

  carregandoLink.style.display = "none";
  form.style.display = "none";
  btnVoltarLogin.style.display = "block";

  textoOrientacao.textContent =
    "Não foi possível validar este link.";

  mostrarMensagem(
    "❌ Este link é inválido ou expirou. Solicite uma nova recuperação de senha.",
    false
  );
}

/* =====================================================
   VERIFICAR SESSÃO CRIADA PELO LINK
===================================================== */

async function verificarSessao() {
  try {
    const {
      data,
      error
    } = await supabase.auth.getSession();

    if (error) {
      console.error(
        "Erro ao verificar sessão:",
        error
      );

      informarLinkInvalido();
      return;
    }

    if (data?.session?.user) {
      liberarFormulario();
      return;
    }

    /*
      Algumas vezes o Supabase ainda está processando
      os dados do link quando a página abre.

      O evento PASSWORD_RECOVERY abaixo também poderá
      liberar o formulário.
    */

    setTimeout(async () => {
      const {
        data: novaVerificacao
      } = await supabase.auth.getSession();

      if (novaVerificacao?.session?.user) {
        liberarFormulario();
      } else if (!linkValido) {
        informarLinkInvalido();
      }
    }, 1200);

  } catch (erro) {
    console.error(
      "Erro inesperado ao validar link:",
      erro
    );

    informarLinkInvalido();
  }
}

/* =====================================================
   EVENTOS DO SUPABASE AUTH
===================================================== */

supabase.auth.onAuthStateChange(
  (evento, sessao) => {
    console.log(
      "Evento de recuperação:",
      evento
    );

    if (
      evento === "PASSWORD_RECOVERY" &&
      sessao
    ) {
      liberarFormulario();
    }

    if (
      evento === "SIGNED_IN" &&
      sessao &&
      !linkValido
    ) {
      liberarFormulario();
    }
  }
);

/* =====================================================
   SALVAR NOVA SENHA
===================================================== */

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!linkValido) {
    mostrarMensagem(
      "❌ O link de recuperação não é válido.",
      false
    );

    return;
  }

  const novaSenha = document.getElementById(
    "novaSenha"
  ).value;

  const confirmarSenha = document.getElementById(
    "confirmarSenha"
  ).value;

  if (novaSenha.length < 8) {
    mostrarMensagem(
      "⚠️ A senha deve possuir pelo menos 8 caracteres.",
      false
    );

    return;
  }

  if (novaSenha !== confirmarSenha) {
    mostrarMensagem(
      "⚠️ As senhas digitadas não são iguais.",
      false
    );

    return;
  }

  definirCarregamento(true);

  try {
    const {
      error
    } = await supabase.auth.updateUser({
      password: novaSenha
    });

    if (error) {
      console.error(
        "Erro ao atualizar senha:",
        error
      );

      mostrarMensagem(
        "❌ Não foi possível alterar a senha. Solicite um novo link e tente novamente.",
        false
      );

      return;
    }

    /*
      Encerra a sessão temporária de recuperação.
      Depois disso, o usuário fará login normalmente.
    */

    await supabase.auth.signOut();

    form.style.display = "none";
    btnVoltarLogin.style.display = "block";

    textoOrientacao.textContent =
      "Sua senha foi alterada.";

    mostrarMensagem(
      "✅ Senha alterada com sucesso. Agora você já pode entrar no sistema."
    );

  } catch (erro) {
    console.error(
      "Erro inesperado ao alterar senha:",
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

/* =====================================================
   INICIAR VALIDAÇÃO
===================================================== */

await verificarSessao();