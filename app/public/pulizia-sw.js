/* Il passaggio dall'app di oggi: questo pezzo entra nel service worker nuovo (vite.config.ts, importScripts).
   Il service worker di oggi stava allo stesso indirizzo (sw.js) con la sua cache «sillage-v3». Se quella cache
   c'è, è la prima volta dopo il passaggio: il nuovo non aspetta che si chiudano le pagine vecchie (prende
   subito il posto) e cancella le cache di oggi. Dalla volta dopo vale la regola normale: le versioni nuove
   aspettano «Aggiorna», così un appunto in scrittura non si perde. */
const DI_OGGI = (n) => /^sillage-v\d+$/.test(n);

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.keys().then((k) => {
      if (k.some(DI_OGGI)) return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(async (k) => {
      const vecchie = k.filter(DI_OGGI);
      if (!vecchie.length) return;
      await Promise.all(vecchie.map((n) => caches.delete(n)));
      await self.clients.claim();
    })
  );
});
