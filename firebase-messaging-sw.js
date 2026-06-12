/* global firebase */

importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCM2sBZDCDA17LKnupbQij8kX052KQocJo",
  authDomain: "beehive-notificacoes.firebaseapp.com",
  projectId: "beehive-notificacoes",
  storageBucket: "beehive-notificacoes.firebasestorage.app",
  messagingSenderId: "1041444077868",
  appId: "1:1041444077868:web:3590a33dc9bd8eb1a1ac89"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
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
    `${self.registration.scope}home-aluno.html`;

  self.registration.showNotification(titulo, {
    body: corpo,
    icon: `${self.registration.scope}css/images/logo-beehive.png`,
    badge: `${self.registration.scope}css/images/logo-beehive.png`,
    data: { url }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url =
    event.notification?.data?.url ||
    `${self.registration.scope}home-aluno.html`;

  event.waitUntil(clients.openWindow(url));
});