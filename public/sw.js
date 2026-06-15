self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    data = event.data.json();
  }

  const title = data.title || 'Benachrichtigung';
  const options = {
    body: data.body || 'Du hast eine neue Nachricht.',
    icon: '/Bestellung/favicon.svg',
    badge: '/Bestellung/favicon.svg',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/Bestellung/')
  );
});
