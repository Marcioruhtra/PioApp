importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAvAXPmtBZtsHk8mPwSasaQcOSpFN-qyrc",
  authDomain: "aesthetic-scion-xv4kj.firebaseapp.com",
  projectId: "aesthetic-scion-xv4kj",
  storageBucket: "aesthetic-scion-xv4kj.firebasestorage.app",
  messagingSenderId: "523898150283",
  appId: "1:523898150283:web:68b8761addc3fd38b7e38e"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensagem recebida em segundo plano: ', payload);
  const notificationTitle = payload?.notification?.title || payload?.data?.title || "Clube Pioneiros D'Alvorada";
  const notificationOptions = {
    body: payload?.notification?.body || payload?.data?.body || 'Nova notificação oficial do clube.',
    icon: '/assets/aistudio/IMG_3033_9ef579ca.PNG',
    badge: '/assets/aistudio/IMG_3033_9ef579ca.PNG',
    vibrate: [200, 100, 200],
    data: payload?.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Ação de clique na notificação nativa do sistema operativo
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
