const CACHE_NAME = 'strong-spoon-v88';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/products.js',
  '/cart.html',
  '/cart-page.js',
  '/checkout.html',
  '/checkout-page.js',
  '/customise-page.js',
  '/Customise.html',
  '/Brown issues.html',
  '/power-mix.html',
  '/golden-scoop.html',
  '/spoon-crumble.html',
  '/orders.html',
  '/delivery.html',
  '/feedback.html',
  '/order-success.html',
  '/contact.html',
  '/manage-order.html',
  '/strongspoon-logo.jpeg',
  '/Chocolate.png',
  '/Peanut.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});
