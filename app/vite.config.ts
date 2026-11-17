import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base "./": la stessa build funziona alla radice di un dominio o in una sottocartella.
// Le pagine usano il router a cancelletto (#/profumo/24), quindi il server non deve sapere nulla.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "Sillage",
        short_name: "Sillage",
        description: "Collezione privata di profumi",
        lang: "it",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#F1EBE0",
        theme_color: "#F1EBE0",
        icons: [
          { src: "img/icona-192.png", sizes: "192x192", type: "image/png" },
          { src: "img/icona-512.png", sizes: "512x512", type: "image/png" },
          { src: "img/icona-512-maschera.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // tutto quello che serve per aprirla senza rete: codice, foto, icone e caratteri (Cormorant e Jost, inclusi nell'app)
        globPatterns: ["**/*.{js,css,html,webp,png,svg,woff2,json}"],
        // il passaggio dall'app di oggi: prende il posto del suo service worker e ne cancella la cache
        importScripts: ["pulizia-sw.js"],
        // le schermate d'avvio le legge solo l'iPhone quando apre l'app: non servono nella cache
        // lo scontorno delle foto («Aggiungi profumo» ▸ Una tua foto) e il lettore delle scritte (▸ la cartolina) si
        // scaricano solo al primo uso, mai all'installazione
        globIgnores: ["**/img/avvio/**", "**/scontorno-*.js", "**/lettore-*.js"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // i dati del ponte: prima la rete, senza rete l'ultima copia
            urlPattern: ({ url }) => url.pathname.endsWith("/api"),
            handler: "NetworkFirst",
            options: { cacheName: "sillage-dati", networkTimeoutSeconds: 6 }
          },
          {
            // le foto dei profumi aggiunti dall'app (servite dal ponte): non cambiano mai, si tengono per l'uso senza rete
            urlPattern: ({ url }) => url.pathname.includes("/api/foto/"),
            handler: "CacheFirst",
            options: { cacheName: "sillage-foto", expiration: { maxEntries: 300 }, cacheableResponse: { statuses: [0, 200] } }
          },
          {
            // il lettore delle scritte (Tesseract: programma e italiano, da jsdelivr) scaricato al primo uso: si tiene,
            // così la volta dopo legge anche senza rete
            urlPattern: ({ url }) => url.hostname === "cdn.jsdelivr.net" && /^\/npm\/(tesseract\.js|tesseract\.js-core|@tesseract\.js-data)[@/]/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "sillage-lettore", expiration: { maxEntries: 20 }, cacheableResponse: { statuses: [0, 200] } }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // i pezzi dello scontorno (con onnxruntime) e del lettore (Tesseract) col loro nome, per lasciarli fuori dalla
        // cache: si scaricano solo quando servono (l'import dinamico li tiene già a parte; qui cambia solo il nome)
        chunkFileNames: (c) =>
          c.moduleIds.some((id) => /@imgly|onnxruntime/.test(id))
            ? "assets/scontorno-[hash].js"
            : c.moduleIds.some((id) => /tesseract/.test(id))
              ? "assets/lettore-[hash].js"
              : "assets/[name]-[hash].js"
      }
    }
  },
  server: { port: 5173, host: "127.0.0.1" }
});
