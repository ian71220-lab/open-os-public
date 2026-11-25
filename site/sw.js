/* OPEN OS v1.0.4.45: network-first documents, cache-first versioned static files. */
'use strict';

const CACHE_PREFIX = 'open-os-public-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}1.0.4.45-9d1096a0`;
const OFFLINE_URL = 'offline.html';
const OFFLINE_ICON = 'assets/brand/pwa-icon-192.png';
const STATIC_FILE = /^(?:assets|js)\/.+\.(?:css|js|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf)$/i;
const SCOPE_PATH = new URL(self.registration.scope).pathname;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([OFFLINE_URL, OFFLINE_ICON])));
  // Deliberately wait. The page may activate this worker only after the user confirms.
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_AFTER_CONFIRMATION' && event.source?.id) {
    self.skipWaiting();
  }
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(OFFLINE_URL) || new Response('OPEN OS is offline.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      }
    })());
    return;
  }

  // Only explicit, same-origin release-versioned assets can enter the static cache.
  // Auth, APIs, HTML, and unversioned resources always go to network.
  const relativePath = url.pathname.startsWith(SCOPE_PATH) ? url.pathname.slice(SCOPE_PATH.length) : '';
  if (!STATIC_FILE.test(relativePath) || !url.searchParams.get('v')) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    const type = response.headers.get('Content-Type') || '';
    const cacheControl = response.headers.get('Cache-Control') || '';
    const vary = response.headers.get('Vary') || '';
    if (response.ok && response.type === 'basic' && !/\b(?:private|no-store)\b/i.test(cacheControl) && vary.trim() !== '*' &&
        /^(?:text\/(?:css|javascript)|application\/(?:javascript|font-woff|font-woff2)|image\/)/i.test(type)) {
      try { await cache.put(request, response.clone()); } catch { /* Continue serving the network response. */ }
    }
    return response;
  })());
});
