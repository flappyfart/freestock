/* Push-only worker. No page caching or interception of wallet/API requests. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    /* Generic notification below. */
  }
  const id =
    typeof data.id === 'string' && /^[a-f0-9-]{36}$/.test(data.id)
      ? data.id
      : 'plan-update';
  const expired =
    typeof data.expiresAt !== 'number' || data.expiresAt * 1000 < Date.now();
  event.waitUntil(
    self.registration.showNotification('Freestock alert', {
      body: expired
        ? 'Open Freestock to check your latest plan status.'
        : 'Your lending plan has an update. Open Freestock for a fresh purchase check.',
      icon: '/brand/fs-icon.png',
      tag: `freestock-${id}`,
      renotify: false,
      data: { alertId: id },
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL('/dashboard?view=agentic&alerts=1', self.location.origin)
    .href;
  // A fixed same-origin destination; no transaction or third-party URL comes from the payload.
  event.waitUntil(self.clients.openWindow(url));
});
