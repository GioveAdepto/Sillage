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
        globIgnores: ["**/img/avvio/**"],
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // i dati del ponte: prima la rete, senza rete l'ultima copia
            urlPattern: ({ url }) => url.pathname.endsWith("/api"),
            handler: "NetworkFirst",
            options: { cacheName: "sillage-dati", networkTimeoutSeconds: 6 }
          }
        ]
      }
    })
  ],
  server: { port: 5173, host: "127.0.0.1" }
});
