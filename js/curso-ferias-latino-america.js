import { supabase } from "./supabase.js";

const NUMERO_WHATSAPP = "5511956177084";

const form = document.getElementById("formCursoFerias");
const nomeInput = document.getElementById("nome");
const telefoneInput = document.getElementById("telefone");
const autorizaWhatsappInput = document.getElementById("autorizaWhatsapp");
const campoSiteInput = document.getElementById("campoSite");
const btnEnviar = document.getElementById("btnEnviar");
const mensagemFormulario = document.getElementById("mensagemFormulario");

const menuToggle = document.getElementById("menuToggle");
const menuNav = document.getElementById("menuNav");

if (menuToggle && menuNav) {
  menuToggle.addEventListener("click", () => {
    menuNav.classList.toggle("ativo");
  });

  menuNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menuNav.classList.remove("ativo");
    });
  });
}

function mostrarMensagem(texto, tipo) {
  if (!mensagemFormulario) return;

  mensagemFormulario.textContent = texto;
  mensagemFormulario.className = `mensagem ${tipo}`;
  mensagemFormulario.style.display = "block";
}

function limparMensagem() {
  if (!mensagemFormulario) return;

  mensagemFormulario.textContent = "";
  mensagemFormulario.className = "mensagem";
  mensagemFormulario.style.display = "none";
}

function limparTelefone(valor) {
  return valor.replace(/\D/g, "");
}

function formatarTelefone(valor) {
  const numeros = limparTelefone(valor).slice(0, 11);

  if (numeros.length <= 2) {
    return numeros;
  }

  if (numeros.length <= 6) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  }

  if (numeros.length <= 10) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 6)}-${numeros.slice(6)}`;
  }

  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
}

function ehCelular() {
  return /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
}

function montarLinkWhatsapp(nome, telefoneFormatado) {
  const mensagemWhatsapp =
    `Olá, meu nome é ${nome} e quero me inscrever no Curso de Férias Latino América.`;

  const baseWhatsapp = ehCelular()
    ? "https://api.whatsapp.com/send"
    : "https://web.whatsapp.com/send";

  return `${baseWhatsapp}?phone=${NUMERO_WHATSAPP}&text=${encodeURIComponent(mensagemWhatsapp)}`;
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function salvarLeadNoSupabase(dados) {
  const { error } = await supabase
    .from("curso_ferias_latam_inscricoes")
    .insert(dados);

  if (error) {
    console.error("Erro ao salvar no Supabase:", error);
  }
}

if (telefoneInput) {
  telefoneInput.addEventListener("input", () => {
    telefoneInput.value = formatarTelefone(telefoneInput.value);
  });
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    limparMensagem();

    const nome = nomeInput.value.trim();
    const telefoneFormatado = telefoneInput.value.trim();
    const telefoneNumeros = limparTelefone(telefoneFormatado);
    const querReceberNovidades = autorizaWhatsappInput.checked;

    const parametrosUrl = new URLSearchParams(window.location.search);
    const origem = parametrosUrl.get("origem") || "site";
    const paginaOrigem = window.location.href;

    if (campoSiteInput.value.trim() !== "") {
      return;
    }

    if (nome.length < 2) {
      mostrarMensagem("Digite seu nome para continuar.", "erro");
      return;
    }

    if (telefoneNumeros.length < 10 || telefoneNumeros.length > 11) {
      mostrarMensagem("Digite um telefone válido com DDD.", "erro");
      return;
    }

    const linkWhatsapp = montarLinkWhatsapp(nome, telefoneFormatado);

    btnEnviar.disabled = true;
    btnEnviar.innerHTML = `
      <i class="fa-brands fa-whatsapp"></i>
      Abrindo WhatsApp...
    `;

    mostrarMensagem(
      "Tudo certo! Estamos abrindo o WhatsApp para finalizar sua inscrição.",
      "sucesso"
    );

    const dadosLead = {
      nome: nome,
      telefone: telefoneNumeros,
      autoriza_whatsapp: querReceberNovidades,
      origem: origem,
      pagina_origem: paginaOrigem
    };

    try {
      await Promise.race([
        salvarLeadNoSupabase(dadosLead),
        esperar(1200)
      ]);
    } catch (erro) {
      console.error("Erro inesperado ao tentar salvar lead:", erro);
    }

    window.location.href = linkWhatsapp;
  });
}