const CACHE = 'financas-v1';

const STATIC = [
  '/',
  '/lancamentos',
  '/cartoes',
  '/planejamento',
  '/relatorios',
  '/configuracoes',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Instala e faz cache dos recursos estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Limpa caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Estratégia: Network first para API, Cache first para estáticos
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API e blobs: sempre busca da rede, nunca cacheia
  if (url.pathname.startsWith('/api/') || url.hostname.includes('vercel-storage')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Recursos estáticos: tenta rede primeiro, cai no cache se offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Atualiza o cache com a resposta mais recente
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
