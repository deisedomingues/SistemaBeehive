import { supabase } from "./supabase.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";

import {
  getMessaging,
  getToken,
  onMessage,
  isSupported
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging.js";

/* =====================================================
   FIREBASE - BEEHIVE NOTIFICAÇÕES
===================================================== */

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

/* =====================================================
   FUNÇÕES VISUAIS DO CARD
===================================================== */

function criarCardNotificacao() {
  if (document.getElementById("cardPushNotificacao")) return;

  const container =
    document.querySelector(".grid-cards") ||
    document.querySelector(".cards-admin") ||
    document.querySelector(".container") ||
    document.body;

  const card = document.createElement("section");
  card.id = "cardPushNotificacao";
  card.className = "card-admin";
  card.style.marginBottom = "16px";

  card.innerHTML = `
    <div class="card-admin-conteudo">
      <h2>Lembretes de aulas e eventos</h2>

      <p id="textoStatusPush">
        Ative as notificações para receber lembretes antes das aulas e eventos.
      </p>

      <button
        id="btnAtivarPush"
        type="button"
        class="btn-principal"
        style="margin-top: 10px;"
      >
        Ativar lembretes
      </button>
    </div>
  `;

  container.prepend(card);
}

function removerCardNotificacao() {
  const card = document.getElementById("cardPushNotificacao");

  if (card) {
    card.remove();
  }
}

function atualizarStatusPush(texto, tipo = "info") {
  const status = document.getElementById("textoStatusPush");

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

function atualizarBotaoPush(texto, desabilitado = false) {
  const botao = document.getElementById("btnAtivarPush");

  if (!botao) return;

  botao.textContent = texto;
  botao.disabled = desabilitado;
}

/* =====================================================
   BUSCAR ALUNO LOGADO
===================================================== */

async function buscarAlunoLogado() {
  const {
    data: { user },
    error: erroUser
  } = await supabase.auth.getUser();

  if (erroUser || !user) {
    throw new Error("Usuário não está logado.");
  }

  const { data: perfil, error: erroPerfil } = await supabase
    .from("perfil")
    .select("role, aluno_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (erroPerfil) {
    console.error("Erro ao buscar perfil:", erroPerfil);
    throw new Error("Não foi possível buscar o perfil do aluno.");
  }

  const alunoId =
    perfil?.aluno_id ||
    localStorage.getItem("alunoId") ||
    localStorage.getItem("aluno_id") ||
    localStorage.getItem("idAluno");

  if (!alunoId) {
    throw new Error("Aluno não encontrado para este login.");
  }

  return {
    user,
    alunoId: Number(alunoId)
  };
}

/* =====================================================
   SERVICE WORKER
   Service Worker = arquivo que permite receber push
   mesmo quando o site não está aberto.
===================================================== */

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

/* =====================================================
   NOTIFICAÇÃO COM O SITE ABERTO
   Foreground = quando o aluno está com o site aberto.
===================================================== */

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
      "Você tem um novo lembrete.";

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

/* =====================================================
   ATIVAR PUSH E SALVAR TOKEN NO SUPABASE
===================================================== */

async function salvarTokenPush() {
  atualizarBotaoPush("Ativando...", true);
  atualizarStatusPush("Preparando as notificações...");

  const suportado = await isSupported();

  if (!suportado) {
    throw new Error("Firebase Messaging não é suportado neste navegador.");
  }

  if (!("Notification" in window)) {
    throw new Error("Este navegador não suporta notificações.");
  }

  const permissao = await Notification.requestPermission();

  if (permissao !== "granted") {
    atualizarBotaoPush("Ativar lembretes", false);
    throw new Error("A permissão de notificação não foi liberada.");
  }

  const { user, alunoId } = await buscarAlunoLogado();

  const registration = await registrarServiceWorker();

  messaging = getMessaging(firebaseApp);

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error("O Firebase não retornou um token de notificação.");
  }

  const { error: erroSalvar } = await supabase.rpc("salvar_push_token", {
  p_aluno_id: alunoId,
  p_fcm_token: token,
  p_plataforma: "web"
});

if (erroSalvar) {
  console.error("Erro ao salvar token push:", erroSalvar);
  throw new Error("Erro ao salvar o token no Supabase.");
}
  if (erroSalvar) {
    console.error("Erro ao salvar token push:", erroSalvar);
    throw new Error("Erro ao salvar o token no Supabase.");
  }

  configurarMensagemEmPrimeiroPlano();

  atualizarStatusPush(
    "Lembretes ativados! Este dispositivo já pode receber notificações.",
    "sucesso"
  );

  atualizarBotaoPush("Lembretes ativados", true);

  setTimeout(() => {
    removerCardNotificacao();
  }, 1200);
}

/* =====================================================
   INICIAR NA HOME DO ALUNO
===================================================== */

async function verificarEstadoInicial() {
  if (!("Notification" in window)) {
    criarCardNotificacao();

    atualizarStatusPush(
      "Este navegador não permite notificações push.",
      "erro"
    );

    atualizarBotaoPush("Indisponível", true);
    return;
  }

  /*
    Se o aluno já aceitou antes neste navegador,
    não mostramos o card de novo.
    Apenas atualizamos/salvamos o token silenciosamente.
  */
  if (Notification.permission === "granted") {
    try {
      await salvarTokenPush();
      removerCardNotificacao();
    } catch (erro) {
      console.error("Erro ao atualizar token push:", erro);
    }

    return;
  }

  /*
    Se o aluno bloqueou as notificações,
    mostramos o card com aviso.
  */
  if (Notification.permission === "denied") {
    criarCardNotificacao();

    atualizarStatusPush(
      "As notificações estão bloqueadas neste navegador. Para usar, libere nas configurações do site.",
      "erro"
    );

    atualizarBotaoPush("Bloqueado", true);
    return;
  }

  /*
    Se ainda está como default, ou seja,
    o aluno ainda não escolheu, mostramos o card.
  */
  criarCardNotificacao();

  const botao = document.getElementById("btnAtivarPush");

  if (!botao) return;

  botao.addEventListener("click", async () => {
    try {
      await salvarTokenPush();
    } catch (erro) {
      console.error(erro);
      atualizarStatusPush(erro.message, "erro");
      atualizarBotaoPush("Tentar novamente", false);
    }
  });
}

/* =====================================================
   EXECUTAR
===================================================== */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", verificarEstadoInicial);
} else {
  verificarEstadoInicial();
}