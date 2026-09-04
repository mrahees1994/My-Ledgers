// ══════════════════════════════════════════════
//  My Ledger — Service Worker
//  Handles: offline app-shell caching, notification display/clicks,
//  and a best-effort daily reminder via Periodic Background Sync
//  (Chrome/Android installed-PWA only — see notes below).
// ══════════════════════════════════════════════

const SHELL_CACHE = 'ledger-shell-v1';
const SETTINGS_CACHE = 'ledger-settings-v1';
const SHELL_FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// ── Install: pre-cache the app shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

// ── Activate: drop old shell caches from previous versions ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== SETTINGS_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for the shell (so you always get the latest data-
//    entry code when online), falling back to cache when offline. ──
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request).then((res) => res || caches.match('./index.html')))
  );
});

// ── Real Web Push (future-proofing) ──
// There's no push server behind this app yet, so this will never fire on its
// own — but if a backend is added later to send actual Web Push messages
// (the only way to reliably notify while the app/device is fully closed,
// especially on iOS), this handler is already wired up to display them.
self.addEventListener('push', (event) => {
  let data = { title: 'My Ledger', body: "Don't forget to log today's entries 📝" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: 'daily-entry-reminder'
    })
  );
});

// ── Tapping a notification focuses an open tab, or opens a new one ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});

// ── Best-effort daily reminder (Periodic Background Sync) ──
// Only supported on Chrome/Android when the app is installed to the home
// screen, and even then the browser decides when/if it actually runs (based
// on engagement) — it is NOT a guaranteed alarm. iOS Safari does not support
// this API at all. The page writes its reminder settings into SETTINGS_CACHE
// (a Cache Storage entry, since a service worker can't read localStorage
// directly) whenever they change; we read that here to decide whether to fire.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'daily-entry-reminder') {
    event.waitUntil(checkAndNotify());
  }
});

// Some Chromium versions also dispatch one-off syncs this way — harmless no-op
// everywhere else.
self.addEventListener('sync', (event) => {
  if (event.tag === 'daily-entry-reminder-check') {
    event.waitUntil(checkAndNotify());
  }
});

async function checkAndNotify() {
  const cache = await caches.open(SETTINGS_CACHE);
  const resp = await cache.match('/settings-data');
  if (!resp) return;
  let cfg;
  try { cfg = await resp.json(); } catch { return; }
  if (!cfg || !cfg.notifEnabled) return;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  if (cfg.lastNotifiedDate === todayStr) return; // already reminded today

  const [h, m] = (cfg.notifTime || '22:00').split(':').map(Number);
  const due = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
  if (!due) return;

  await self.registration.showNotification('My Ledger', {
    body: "Don't forget to log today's income & expenses 📝",
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'daily-entry-reminder'
  });

  cfg.lastNotifiedDate = todayStr;
  await cache.put('/settings-data', new Response(JSON.stringify(cfg)));
}
