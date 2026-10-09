/* Sillage — service worker.
   Rende il sito installabile e lo tiene in piedi senza rete:
   - la pagina: prima la rete, così un aggiornamento si vede subito; senza
     rete, l'ultima copia;
   - CSS, JS, immagini e JSON del repo: subito dalla copia, e intanto si
     scarica la nuova (i link a CSS e JS portano ?v=, quindi una versione
     nuova è un indirizzo nuovo e non resta mai indietro);
   - i font di Google: dalla copia, cambiano di rado;
   - il foglio Google e il meteo passano dritti: sono dati vivi, e l'app ha
     già la sua cache per quando mancano. */
const CASSA = "sillage-v2";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CASSA).then(c => c.addAll(["./", "manifest.webmanifest", "img/icona-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n !== CASSA).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

const dallaCopia = async (req, aggiorna) => {
  const c = await caches.open(CASSA), copia = await c.match(req);
  const rete = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => copia);
  if (copia) { if (aggiorna) rete.catch(() => {}); return copia; }
  return rete;
};

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => {
      const copia = r.clone(); caches.open(CASSA).then(c => c.put("./", copia)); return r;
    }).catch(() => caches.match("./")));
    return;
  }
  // il controllo della versione nuova deve vedere la pagina pubblicata, non la copia
  if (u.searchParams.has("controllo")) return;
  if (u.origin === location.origin) { e.respondWith(dallaCopia(req, true)); return; }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) { e.respondWith(dallaCopia(req, false)); return; }
  // tutto il resto (foglio Google, meteo) non si tocca
});
