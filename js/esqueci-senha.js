import { supabase } from "./supabase.js";

const form = document.getElementById(
  "form-recuperar-senha"
);

const msg = document.getElementById("msg");
const btnEnviar = document.getElementById("btnEnviar");

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
  if (!btnEnviar) return;

  btnEnviar.disabled = carregando;
  btnEnviar.textContent = carregando
    ? "Enviando..."
    : "Enviar link";

  btnEnviar.style.opacity = carregando ? "0.7" : "1";
  btnEnviar.style.cursor = carregando
    ? "not-allowed"
    : "pointer";
}

/* =====================================================
   FORMULÁRIO
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

    /*
      A página atual está publicada em:

      https://www.beehiveidiomas.com/esqueci-senha.html

      Portanto, window.location.origin será:

      https://www.beehiveidiomas.com

      Em desenvolvimento local, ele poderá ser:
      http://127.0.0.1:5500
    */

    const urlRedefinicao =
      `${window.location.origin}/redefinir-senha.html`;

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: urlRedefinicao
        }
      );

    if (error) {
      console.error(
        "Erro ao solicitar recuperação:",
        error
      );

      /*
        Mensagem específica para excesso de tentativas.
      */

      if (
        error.message
          ?.toLowerCase()
          .includes("rate limit")
      ) {
        mostrarMensagem(
          "⚠️ Foram feitas muitas solicitações. Aguarde alguns minutos e tente novamente.",
          false
        );

        return;
      }

      mostrarMensagem(
        "❌ Não foi possível enviar o e-mail. Tente novamente.",
        false
      );

      return;
    }

    /*
      Usamos uma mensagem neutra por segurança.
      Ela não confirma se o e-mail existe no sistema.
    */

    mostrarMensagem(
      "✅ Se este e-mail estiver cadastrado, você receberá um link para criar uma nova senha."
    );

    form.reset();

  } catch (erro) {
    console.error(
      "Erro inesperado na recuperação:",
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