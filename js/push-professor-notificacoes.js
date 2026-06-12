import { supabase } from "./supabase.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";

import {
  getMessaging,
  getToken,
  onMessage,
  isSupported
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging.js";

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

let messaging = null;
let mensagemForegroundConfigurada = false;

function criarCardNotificacaoProfessor() {
  if (document.getElementById("cardPushProfessor")) return;

  const container =
    document.querySelector(".grid-cards") ||
    document.querySelector(".cards-admin") ||
    document.querySelector(".container") ||
    document.body;

  const card = document.createElement("section");
  card.id = "cardPushProfessor";
  card.className = "card-admin";
  card.style.marginBottom = "16px";

  card.innerHTML = `
    <div class="card-admin-conteudo">
      <h2>Notificações para professor</h2>

      <p id="textoStatusPushProfessor">
        Ative as notificações para receber avisos quando alunos agendarem reposições, plantões ou aulas instrumentais.
      </p>

      <button
        id="btnAtivarPushProfessor"
        type="button"
        class="btn-principal"
        style="margin-top: 10px;"
      >
        Ativar notificações
      </button>
    </div>
  `;

  container.prepend(card);
}

function removerCardNotificacaoProfessor() {
  const card = document.getElementById("cardPushProfessor");

  if (card) {
    card.remove();
  }
}

function atualizarStatusPushProfessor(texto, tipo = "info") {
  const status = document.getElementById("textoStatusPushProfessor");

  if (!status) return;

  status.textContent = texto;

  if (tipo === "erro") {
    status.style.color = "#9b1c1c";
  } else if (tipo === "sucesso") {
    status.style.color = "#1d6b34";
  } else {
    status.style.color = "";
  }
}

function atualizarBotaoPushProfessor(texto, desabilitado = false) {
  const botao = document.getElementById("btnAtivarPushProfessor");

  if (!botao) return;

  botao.textContent = texto;
  botao.disabled = desabilitado;
}

async function buscarProfessorLogado() {
  const {
    data: { user },
    error: erroUser
  } = await supabase.auth.getUser();

  if (erroUser || !user) {
    throw new Error("Usuário não está logado.");
  }

  const { data: perfil, error: erroPerfil } = await supabase
    .from("perfil")
    .select("role, professor_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (erroPerfil) {
    console.error("Erro ao buscar perfil:", erroPerfil);
    throw new Error("Não foi possível buscar o perfil do professor.");
  }

  const professorId =
    perfil?.professor_id ||
    localStorage.getItem("professorId") ||
    localStorage.getItem("professor_id") ||
    localStorage.getItem("idProfessor");

  if (!professorId) {
    throw new Error("Professor não encontrado para este login.");
  }

  return {
    user,
    professorId: Number(professorId)
  };
}

async function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Este navegador não suporta Service Worker.");
  }

  const registration = await navigator.serviceWorker.register(
    "./firebase-messaging-sw.js",
    {
      scope: "./"
    }
  );

  await navigator.serviceWorker.ready;

  return registration;
}

function configurarMensagemEmPrimeiroPlano() {
  if (!messaging || mensagemForegroundConfigurada) return;

  mensagemForegroundConfigurada = true;

  onMessage(messaging, async (payload) => {
    const titulo =
      payload.notification?.title ||
      payload.data?.title ||
      "Beehive Idiomas";

    const corpo =
      payload.notification?.body ||
      payload.data?.body ||
      "Você tem uma nova notificação.";

    const url =
      payload.data?.url ||
      `${window.location.origin}${window.location.pathname}`;

    if (Notification.permission === "granted") {
      const registration = await navigator.serviceWorker.ready;

      registration.showNotification(titulo, {
        body: corpo,
        icon: "./css/images/logo-beehive.png",
        badge: "./css/images/logo-beehive.png",
        data: { url }
      });
    }
  });
}

async function salvarTokenPushProfessor() {
  atualizarBotaoPushProfessor("Ativando...", true);
  atualizarStatusPushProfessor("Preparando as notificações...");

  const suportado = await isSupported();

  if (!suportado) {
    throw new Error("Firebase Messaging não é suportado neste navegador.");
  }

  if (!("Notification" in window)) {
    throw new Error("Este navegador não suporta notificações.");
  }

  const permissao = await Notification.requestPermission();

  if (permissao !== "granted") {
    atualizarBotaoPushProfessor("Ativar notificações", false);
    throw new Error("A permissão de notificação não foi liberada.");
  }

  const { professorId } = await buscarProfessorLogado();

  const registration = await registrarServiceWorker();

  messaging = getMessaging(firebaseApp);

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error("O Firebase não retornou um token de notificação.");
  }

  const { error: erroSalvar } = await supabase.rpc(
    "salvar_professor_push_token",
    {
      p_professor_id: professorId,
      p_fcm_token: token,
      p_plataforma: "web"
    }
  );

  if (erroSalvar) {
    console.error("Erro ao salvar token push do professor:", erroSalvar);
    throw new Error("Erro ao salvar o token no Supabase.");
  }

  configurarMensagemEmPrimeiroPlano();

  atualizarStatusPushProfessor(
    "Notificações ativadas! Este dispositivo já pode receber avisos.",
    "sucesso"
  );

  atualizarBotaoPushProfessor("Notificações ativadas", true);

  setTimeout(() => {
    removerCardNotificacaoProfessor();
  }, 1200);
}

async function verificarEstadoInicial() {
  if (!("Notification" in window)) {
    criarCardNotificacaoProfessor();

    atualizarStatusPushProfessor(
      "Este navegador não permite notificações push.",
      "erro"
    );

    atualizarBotaoPushProfessor("Indisponível", true);
    return;
  }

  if (Notification.permission === "granted") {
    try {
      await salvarTokenPushProfessor();
      removerCardNotificacaoProfessor();
    } catch (erro) {
      console.error("Erro ao atualizar token push do professor:", erro);
    }

    return;
  }

  if (Notification.permission === "denied") {
    criarCardNotificacaoProfessor();

    atualizarStatusPushProfessor(
      "As notificações estão bloqueadas neste navegador. Para usar, libere nas configurações do site.",
      "erro"
    );

    atualizarBotaoPushProfessor("Bloqueado", true);
    return;
  }

  criarCardNotificacaoProfessor();

  const botao = document.getElementById("btnAtivarPushProfessor");

  if (!botao) return;

  botao.addEventListener("click", async () => {
    try {
      await salvarTokenPushProfessor();
    } catch (erro) {
      console.error(erro);
      atualizarStatusPushProfessor(erro.message, "erro");
      atualizarBotaoPushProfessor("Tentar novamente", false);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", verificarEstadoInicial);
} else {
  verificarEstadoInicial();
}