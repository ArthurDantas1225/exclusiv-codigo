'use strict';
const CACHE='exclusiv-shell-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/offline.html','/icon-192.png','/icon-512.png'])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('exclusiv-')&&key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));}else if(['/icon-192.png','/icon-512.png'].includes(new URL(event.request.url).pathname)){event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));}});

self.addEventListener('push', event => {
  let data;
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  event.waitUntil(Promise.all([self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => { for (const client of windows) client.postMessage({ type: 'catalog-order-updated' }); }), self.registration.showNotification(data.title || 'EXCLUSIV · Pedidos', {
    body: data.body || 'Há uma atualização nos pedidos da loja.',
    icon: '/icon-192.png', badge: '/icon-192.png',
    tag: typeof data.tag === 'string' ? data.tag : 'exclusiv-orders',
    data: { url: '/app/pedidos' },
  })]));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL('/app/pedidos', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async windows => {
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        await client.navigate(url); return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
