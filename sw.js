importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js");

// Configuración de Firebase (mismas credenciales que en firebase-config.js)
firebase.initializeApp({
    apiKey: "AIzaSyD9ol1makDaZ2PuUSzCKz2zbT66HaYoT5o",
    authDomain: "horarios-pwa.firebaseapp.com",
    projectId: "horarios-pwa",
    storageBucket: "horarios-pwa.firebasestorage.app",
    messagingSenderId: "460075202224",
    appId: "1:460075202224:web:f14d769b208ba02986ad75"
});

const messaging = firebase.messaging();


// Manejar notificaciones en segundo plano
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const isGitHubPages = self.location.hostname.includes("github.io");
  const iconPath = isGitHubPages ? '/horarios-pwa/icons/icon-192.png' : '/icons/icon-192.png';

  const notificationOptions = {
    body: payload.notification.body,
    icon: iconPath,
    data: payload.data
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("install", event => {
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    clients.claim();
});