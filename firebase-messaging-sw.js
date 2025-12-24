// Service worker para Firebase Messaging
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js");

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
  console.log('[firebase-messaging-sw.js] Mensaje en background recibido:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/horarios-pwa/icons/icon-192.png', // Ajusta si tus iconos tienen otra ruta
    data: payload.data
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
