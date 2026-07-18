import { supabase } from "./supabase.js";
import { exigirProfessor } from "./guard.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";

import {
  getMessaging,
  getToken,
  isSupported
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging.js";

await exigirProfessor();

/* =========================================
   FIREBASE
========================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCM2sBZDCDA17LKnupbQij8kX052KQocJo",
  authDomain: "beehive-notificacoes.firebaseapp.com",
  projectId: "beehive-notificacoes",
  storageBucket: "beehive-notificacoes.firebasestorage.app",
  messagingSenderId: "1041444077868",
  appId: "1:1041444077868:web:3590a33dc9bd8eb1a1ac89"
};

const VAPID_KEY =
  "BDBjfhqqw7-8p2XAVoRgl2SsYOBJOE5VZBUkKnZQd7t8kpPzfxU662qWyEPzbkNkhk5Mk2MAkCOfKJ3YDBb2_g8";

const firebaseApp = initializeApp(firebaseConfig);

/* =========================================
   ELEMENTOS
========================================= */

const mensagemPagina = document.getElementById(
  "mensagemPagina"
);

const nomeProfessor = document.getElementById(
  "nomeProfessor"
);

const emailProfessor = document.getElementById(
  "emailProfessor"
);

const blocoStatusNotificacoes = document.getElementById(
  "blocoStatusNotificacoes"
);

const iconeStatusNotificacoes = document.getElementById(
  "iconeStatusNotificacoes"
);

const tituloStatusNotificacoes = document.getElementById(
  "tituloStatusNotificacoes"
);

const textoStatusNotificacoes = document.getElementById(
  "textoStatusNotificacoes"
);

const btnAtivarNotificacoes = document.getElementById(
  "btnAtivarNotificacoes"
);

const btnVerificarNotificacoes = document.getElementById(
  "btnVerificarNotificacoes"
);

const instrucoesNotificacoes = document.getElementById(
  "instrucoesNotificacoes"
);

const formAlterarSenha = document.getElementById(
  "formAlterarSenha"
);

const novaSenha = document.getElementById(
  "novaSenha"
);

const confirmarNovaSenha = document.getElementById(
  "confirmarNovaSenha"
);

const btnAlterarSenha = document.getElementById(
  "btnAlterarSenha"
);

const preenchimentoForcaSenha = document.getElementById(
  "preenchimentoForcaSenha"
);

const textoForcaSenha = document.getElementById(
  "textoForcaSenha"
);

const btnSair = document.getElementById(
  "btnSair"
);

const botoesMostrarSenha = document.querySelectorAll(
  "[data-campo-senha]"
);

/* =========================================
   IDENTIFICAÇÃO DO PROFESSOR
========================================= */

const professorId = Number(
  localStorage.getItem("professorId") ||
  localStorage.getItem("professor_id") ||
  localStorage.getItem("idProfessor")
);

if (!professorId) {
  window.location.href = "index.html";
}

/* =========================================
   MENSAGENS
========================================= */

let temporizadorMensagem = null;

function esconderMensagem() {
  if (!mensagemPagina) return;

  mensagemPagina.style.display = "none";
  mensagemPagina.textContent = "";

  mensagemPagina.classList.remove(
    "mensagem-sucesso",
    "mensagem-erro",
    "mensagem-aviso"
  );
}

function mostrarMensagem(
  texto,
  tipo = "aviso"
) {
  if (!mensagemPagina) return;

  if (temporizadorMensagem) {
    clearTimeout(temporizadorMensagem);
  }

  esconderMensagem();

  mensagemPagina.textContent = texto;
  mensagemPagina.style.display = "block";

  if (tipo === "sucesso") {
    mensagemPagina.classList.add(
      "mensagem-sucesso"
    );
  } else if (tipo === "erro") {
    mensagemPagina.classList.add(
      "mensagem-erro"
    );
  } else {
    mensagemPagina.classList.add(
      "mensagem-aviso"
    );
  }

  mensagemPagina.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  temporizadorMensagem = setTimeout(() => {
    esconderMensagem();
  }, 9000);
}

/* =========================================
   BOTÕES
========================================= */

function alterarEstadoBotao(
  botao,
  carregando,
  textoCarregando,
  textoNormal
) {
  if (!botao) return;

  botao.disabled = carregando;

  botao.textContent = carregando
    ? textoCarregando
    : textoNormal;
}

/* =========================================
   CARREGAR CONTA
========================================= */

async function carregarDadosDaConta() {
  try {
    const {
      data: dadosUsuario,
      error: erroUsuario
    } = await supabase.auth.getUser();

    if (erroUsuario) {
      console.error(
        "Erro ao carregar usuário autenticado:",
        erroUsuario
      );
    }

    const usuario = dadosUsuario?.user || null;

    if (emailProfessor) {
      emailProfessor.textContent =
        usuario?.email ||
        "E-mail não identificado";

      emailProfessor.classList.remove(
        "texto-carregando"
      );
    }

    const {
      data: professor,
      error: erroProfessor
    } = await supabase
      .from("professor")
      .select("id, nome, email")
      .eq("id", professorId)
      .maybeSingle();

    if (erroProfessor) {
      console.error(
        "Erro ao carregar professor:",
        erroProfessor
      );
    }

    if (nomeProfessor) {
      nomeProfessor.textContent =
        professor?.nome ||
        "Nome não identificado";

      nomeProfessor.classList.remove(
        "texto-carregando"
      );
    }

    if (
      emailProfessor &&
      !usuario?.email &&
      professor?.email
    ) {
      emailProfessor.textContent =
        professor.email;
    }
  } catch (erro) {
    console.error(
      "Erro inesperado ao carregar conta:",
      erro
    );

    if (nomeProfessor) {
      nomeProfessor.textContent =
        "Não foi possível carregar";

      nomeProfessor.classList.remove(
        "texto-carregando"
      );
    }

    if (emailProfessor) {
      emailProfessor.textContent =
        "Não foi possível carregar";

      emailProfessor.classList.remove(
        "texto-carregando"
      );
    }

    mostrarMensagem(
      "Não foi possível carregar todos os dados da sua conta.",
      "erro"
    );
  }
}

/* =========================================
   INTERFACE DAS NOTIFICAÇÕES
========================================= */

function removerClassesDeStatus() {
  if (!blocoStatusNotificacoes) return;

  blocoStatusNotificacoes.classList.remove(
    "status-professor-ativo",
    "status-professor-pendente",
    "status-professor-bloqueado",
    "status-professor-indisponivel"
  );
}

function exibirStatusNotificacoes({
  classe,
  icone,
  titulo,
  texto,
  mostrarBotaoAtivar,
  textoBotaoAtivar,
  mostrarInstrucoes
}) {
  removerClassesDeStatus();

  if (classe && blocoStatusNotificacoes) {
    blocoStatusNotificacoes.classList.add(
      classe
    );
  }

  if (iconeStatusNotificacoes) {
    iconeStatusNotificacoes.textContent =
      icone;
  }

  if (tituloStatusNotificacoes) {
    tituloStatusNotificacoes.textContent =
      titulo;
  }

  if (textoStatusNotificacoes) {
    textoStatusNotificacoes.textContent =
      texto;
  }

  if (btnAtivarNotificacoes) {
    btnAtivarNotificacoes.style.display =
      mostrarBotaoAtivar
        ? "inline-flex"
        : "none";

    btnAtivarNotificacoes.textContent =
      textoBotaoAtivar ||
      "Ativar notificações";
  }

  if (instrucoesNotificacoes) {
    instrucoesNotificacoes.style.display =
      mostrarInstrucoes
        ? "block"
        : "none";
  }
}

/* =========================================
   SERVICE WORKER
========================================= */

async function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "Este navegador não suporta Service Worker."
    );
  }

  const registro =
    await navigator.serviceWorker.register(
      "./firebase-messaging-sw.js",
      {
        scope: "./"
      }
    );

  await navigator.serviceWorker.ready;

  return registro;
}

/* =========================================
   VERIFICAR INSCRIÇÃO
========================================= */

async function verificarInscricaoExistente() {
  try {
    if (!("serviceWorker" in navigator)) {
      return false;
    }

    const registro =
      await navigator.serviceWorker.getRegistration(
        "./"
      );

    if (!registro) {
      return false;
    }

    return true;
  } catch (erro) {
    console.warn(
      "Não foi possível verificar o Service Worker:",
      erro
    );

    return false;
  }
}

/* =========================================
   VERIFICAR ESTADO
========================================= */

async function verificarStatusNotificacoes() {
  if (!("Notification" in window)) {
    exibirStatusNotificacoes({
      classe: "status-professor-indisponivel",
      icone: "⚠️",
      titulo: "Notificações indisponíveis",
      texto:
        "Este navegador não oferece suporte às notificações do sistema.",
      mostrarBotaoAtivar: false,
      textoBotaoAtivar: "",
      mostrarInstrucoes: false
    });

    return;
  }

  const suportado = await isSupported();

  if (!suportado) {
    exibirStatusNotificacoes({
      classe: "status-professor-indisponivel",
      icone: "⚠️",
      titulo: "Notificações indisponíveis",
      texto:
        "O Firebase Messaging não é compatível com este navegador.",
      mostrarBotaoAtivar: false,
      textoBotaoAtivar: "",
      mostrarInstrucoes: false
    });

    return;
  }

  const permissao = Notification.permission;

  if (permissao === "granted") {
    const possuiRegistro =
      await verificarInscricaoExistente();

    exibirStatusNotificacoes({
      classe: "status-professor-ativo",
      icone: "✅",
      titulo: "Notificações permitidas",
      texto: possuiRegistro
        ? "Este navegador está autorizado a receber notificações."
        : "A permissão foi concedida. Clique em concluir ativação para registrar este aparelho.",
      mostrarBotaoAtivar: !possuiRegistro,
      textoBotaoAtivar: "Concluir ativação",
      mostrarInstrucoes: false
    });

    return;
  }

  if (permissao === "denied") {
    exibirStatusNotificacoes({
      classe: "status-professor-bloqueado",
      icone: "🔕",
      titulo: "Notificações bloqueadas",
      texto:
        "O navegador está impedindo o Beehive de enviar notificações neste aparelho.",
      mostrarBotaoAtivar: false,
      textoBotaoAtivar: "",
      mostrarInstrucoes: true
    });

    return;
  }

  exibirStatusNotificacoes({
    classe: "status-professor-pendente",
    icone: "🔔",
    titulo: "Notificações desativadas",
    texto:
      "Você ainda não autorizou o recebimento de notificações neste navegador.",
    mostrarBotaoAtivar: true,
    textoBotaoAtivar: "Ativar notificações",
    mostrarInstrucoes: false
  });
}

/* =========================================
   SALVAR TOKEN DO PROFESSOR
========================================= */

async function salvarTokenPushProfessor() {
  const suportado = await isSupported();

  if (!suportado) {
    throw new Error(
      "As notificações não são compatíveis com este navegador."
    );
  }

  if (!("Notification" in window)) {
    throw new Error(
      "Este navegador não suporta notificações."
    );
  }

  let permissao = Notification.permission;

  if (permissao === "default") {
    permissao =
      await Notification.requestPermission();
  }

  if (permissao !== "granted") {
    throw new Error(
      "A permissão de notificação não foi liberada."
    );
  }

  const registro =
    await registrarServiceWorker();

  const messaging =
    getMessaging(firebaseApp);

  const token = await getToken(
    messaging,
    {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registro
    }
  );

  if (!token) {
    throw new Error(
      "O Firebase não retornou um token de notificação."
    );
  }

  const {
    error: erroSalvar
  } = await supabase.rpc(
    "salvar_professor_push_token",
    {
      p_professor_id: professorId,
      p_fcm_token: token,
      p_plataforma: "web"
    }
  );

  if (erroSalvar) {
    console.error(
      "Erro ao salvar token push:",
      erroSalvar
    );

    throw new Error(
      "Não foi possível salvar o dispositivo no sistema."
    );
  }

  return token;
}

/* =========================================
   ATIVAR NOTIFICAÇÕES
========================================= */

async function ativarNotificacoes() {
  if (
    "Notification" in window &&
    Notification.permission === "denied"
  ) {
    mostrarMensagem(
      "As notificações estão bloqueadas. Siga as instruções exibidas na página para liberar a permissão.",
      "aviso"
    );

    await verificarStatusNotificacoes();
    return;
  }

  alterarEstadoBotao(
    btnAtivarNotificacoes,
    true,
    "Ativando...",
    "Ativar notificações"
  );

  try {
    await salvarTokenPushProfessor();

    await verificarStatusNotificacoes();

    mostrarMensagem(
      "Notificações ativadas com sucesso neste aparelho!",
      "sucesso"
    );
  } catch (erro) {
    console.error(
      "Erro ao ativar notificações:",
      erro
    );

    mostrarMensagem(
      erro?.message ||
        "Não foi possível ativar as notificações.",
      "erro"
    );

    await verificarStatusNotificacoes();
  } finally {
    alterarEstadoBotao(
      btnAtivarNotificacoes,
      false,
      "Ativando...",
      "Ativar notificações"
    );
  }
}

/* =========================================
   VERIFICAR NOVAMENTE
========================================= */

async function verificarNovamente() {
  alterarEstadoBotao(
    btnVerificarNotificacoes,
    true,
    "Verificando...",
    "Verificar novamente"
  );

  try {
    await verificarStatusNotificacoes();

    if (
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      await salvarTokenPushProfessor();

      await verificarStatusNotificacoes();

      mostrarMensagem(
        "As notificações estão ativas neste aparelho.",
        "sucesso"
      );

      return;
    }

    if (
      "Notification" in window &&
      Notification.permission === "denied"
    ) {
      mostrarMensagem(
        "As notificações continuam bloqueadas nas configurações do navegador.",
        "aviso"
      );

      return;
    }

    mostrarMensagem(
      "As notificações ainda não foram autorizadas.",
      "aviso"
    );
  } catch (erro) {
    console.error(
      "Erro ao verificar notificações:",
      erro
    );

    mostrarMensagem(
      erro?.message ||
        "Não foi possível verificar as notificações.",
      "erro"
    );
  } finally {
    alterarEstadoBotao(
      btnVerificarNotificacoes,
      false,
      "Verificando...",
      "Verificar novamente"
    );
  }
}

/* =========================================
   FORÇA DA SENHA
========================================= */

function calcularForcaSenha(senha) {
  let pontos = 0;

  if (senha.length >= 8) {
    pontos += 1;
  }

  if (senha.length >= 12) {
    pontos += 1;
  }

  if (/[a-z]/.test(senha)) {
    pontos += 1;
  }

  if (/[A-Z]/.test(senha)) {
    pontos += 1;
  }

  if (/[0-9]/.test(senha)) {
    pontos += 1;
  }

  if (/[^a-zA-Z0-9]/.test(senha)) {
    pontos += 1;
  }

  return pontos;
}

function atualizarIndicadorForcaSenha() {
  if (
    !novaSenha ||
    !preenchimentoForcaSenha ||
    !textoForcaSenha
  ) {
    return;
  }

  const senha = novaSenha.value;

  if (!senha) {
    preenchimentoForcaSenha.style.width =
      "0%";

    preenchimentoForcaSenha.style.background =
      "#b9b9b9";

    textoForcaSenha.textContent =
      "Digite uma senha para verificar a segurança.";

    return;
  }

  const pontos = calcularForcaSenha(senha);

  if (pontos <= 2) {
    preenchimentoForcaSenha.style.width =
      "33%";

    preenchimentoForcaSenha.style.background =
      "#c65f50";

    textoForcaSenha.textContent =
      "Senha fraca. Acrescente números, letras maiúsculas ou símbolos.";

    return;
  }

  if (pontos <= 4) {
    preenchimentoForcaSenha.style.width =
      "66%";

    preenchimentoForcaSenha.style.background =
      "#d3a92b";

    textoForcaSenha.textContent =
      "Senha razoável. Você pode deixá-la ainda mais segura.";

    return;
  }

  preenchimentoForcaSenha.style.width =
    "100%";

  preenchimentoForcaSenha.style.background =
    "#4d9858";

  textoForcaSenha.textContent =
    "Senha forte.";
}

/* =========================================
   VALIDAR SENHA
========================================= */

function validarNovaSenha() {
  const senha = novaSenha?.value || "";

  const confirmacao =
    confirmarNovaSenha?.value || "";

  if (!senha || !confirmacao) {
    mostrarMensagem(
      "Preencha a nova senha e a confirmação.",
      "aviso"
    );

    return false;
  }

  if (senha.length < 8) {
    mostrarMensagem(
      "A nova senha precisa ter pelo menos 8 caracteres.",
      "aviso"
    );

    novaSenha.focus();
    return false;
  }

  if (senha.length > 72) {
    mostrarMensagem(
      "A senha não pode ter mais de 72 caracteres.",
      "aviso"
    );

    novaSenha.focus();
    return false;
  }

  if (senha !== confirmacao) {
    mostrarMensagem(
      "A nova senha e a confirmação não são iguais.",
      "aviso"
    );

    confirmarNovaSenha.focus();
    return false;
  }

  const senhasMuitoFaceis = [
    "12345678",
    "123456789",
    "password",
    "senha123",
    "beehive1",
    "abcdefgh"
  ];

  if (
    senhasMuitoFaceis.includes(
      senha.toLowerCase()
    )
  ) {
    mostrarMensagem(
      "Essa senha é muito fácil. Escolha uma senha mais segura.",
      "aviso"
    );

    novaSenha.focus();
    return false;
  }

  return true;
}

/* =========================================
   ALTERAR SENHA
========================================= */

async function alterarSenha(evento) {
  evento.preventDefault();

  esconderMensagem();

  if (!validarNovaSenha()) {
    return;
  }

  alterarEstadoBotao(
    btnAlterarSenha,
    true,
    "Salvando...",
    "Salvar nova senha"
  );

  try {
    const {
      data,
      error
    } = await supabase.auth.updateUser({
      password: novaSenha.value
    });

    if (error) {
      const mensagemErro = String(
        error.message || ""
      ).toLowerCase();

      if (
        mensagemErro.includes("same password") ||
        mensagemErro.includes(
          "different from the old password"
        )
      ) {
        throw new Error(
          "A nova senha precisa ser diferente da senha atual."
        );
      }

      if (
        mensagemErro.includes("session") ||
        mensagemErro.includes("jwt")
      ) {
        throw new Error(
          "Sua sessão expirou. Entre novamente no sistema e tente alterar a senha."
        );
      }

      throw error;
    }

    if (!data?.user) {
      throw new Error(
        "O sistema não confirmou a alteração da senha."
      );
    }

    formAlterarSenha.reset();

    atualizarIndicadorForcaSenha();

    mostrarMensagem(
      "Senha alterada com sucesso! Use a nova senha no próximo acesso.",
      "sucesso"
    );
  } catch (erro) {
    console.error(
      "Erro ao alterar senha:",
      erro
    );

    mostrarMensagem(
      erro?.message ||
        "Não foi possível alterar a senha.",
      "erro"
    );
  } finally {
    alterarEstadoBotao(
      btnAlterarSenha,
      false,
      "Salvando...",
      "Salvar nova senha"
    );
  }
}

/* =========================================
   MOSTRAR E ESCONDER SENHA
========================================= */

function alternarVisibilidadeSenha(botao) {
  const campoId =
    botao.dataset.campoSenha;

  const campo =
    document.getElementById(campoId);

  if (!campo) return;

  const estaEscondida =
    campo.type === "password";

  campo.type = estaEscondida
    ? "text"
    : "password";

  botao.textContent = estaEscondida
    ? "🙈"
    : "👁️";

  botao.setAttribute(
    "aria-label",
    estaEscondida
      ? "Esconder senha"
      : "Mostrar senha"
  );
}

/* =========================================
   LIMPAR DADOS LOCAIS
========================================= */

function limparDadosLocaisProfessor() {
  const chaves = [
    "role",
    "professorId",
    "professor_id",
    "idProfessor",
    "professorNome",
    "professorEmail",
    "matriculaSelecionada",
    "alunoIdVisualizacao",
    "matriculaSelecionadaId",
    "materiaSelecionadaId",
    "moduloSelecionadoId",
    "nomeCursoSelecionado"
  ];

  chaves.forEach((chave) => {
    localStorage.removeItem(chave);
    sessionStorage.removeItem(chave);
  });
}

/* =========================================
   SAIR
========================================= */

async function sairDaConta() {
  if (btnSair) {
    btnSair.disabled = true;
    btnSair.textContent = "Saindo...";
  }

  try {
    const {
      error
    } = await supabase.auth.signOut();

    if (error) {
      console.warn(
        "Erro retornado ao sair:",
        error
      );
    }
  } catch (erro) {
    console.warn(
      "Erro inesperado ao sair:",
      erro
    );
  } finally {
    limparDadosLocaisProfessor();

    window.location.href = "index.html";
  }
}

/* =========================================
   EVENTOS
========================================= */

btnAtivarNotificacoes?.addEventListener(
  "click",
  ativarNotificacoes
);

btnVerificarNotificacoes?.addEventListener(
  "click",
  verificarNovamente
);

formAlterarSenha?.addEventListener(
  "submit",
  alterarSenha
);

novaSenha?.addEventListener(
  "input",
  atualizarIndicadorForcaSenha
);

botoesMostrarSenha.forEach((botao) => {
  botao.addEventListener(
    "click",
    () => {
      alternarVisibilidadeSenha(botao);
    }
  );
});

btnSair?.addEventListener(
  "click",
  sairDaConta
);

window.addEventListener(
  "focus",
  async () => {
    await verificarStatusNotificacoes();
  }
);

document.addEventListener(
  "visibilitychange",
  async () => {
    if (
      document.visibilityState === "visible"
    ) {
      await verificarStatusNotificacoes();
    }
  }
);

/* =========================================
   INICIAR
========================================= */

async function iniciarPagina() {
  await Promise.all([
    carregarDadosDaConta(),
    verificarStatusNotificacoes()
  ]);
}

await iniciarPagina();