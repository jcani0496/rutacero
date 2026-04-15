self.addEventListener('install', () => {
  console.log('Service Worker installing.');
  // Perform install steps
});

self.addEventListener('activate', () => {
  console.log('Service Worker activating.');
});

self.addEventListener('fetch', (event) => {
  // Basic fetch implementation
  event.respondWith(fetch(event.request));
});
