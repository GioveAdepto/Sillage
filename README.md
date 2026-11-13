# Sillage

Vetrina di una collezione privata di profumi: un'app in React + TypeScript (Vite, installabile, funziona anche
senza rete) che parla col database attraverso il ponte. Istruzioni dell'app in [`app/LEGGIMI.md`](app/LEGGIMI.md),
stile in [`DESIGN.md`](DESIGN.md).

## Struttura

```
app/                  l'app (React + TypeScript): sorgenti, foto, strumenti e confronti (app/LEGGIMI.md)
sito/                 l'app costruita, servita da Cloudflare (fuori da git, la rifà wrangler)
ponte/                il Worker con il database (ponte.js, applica.mjs)
data/*.json           copia notturna dei dati: ripiego dell'avvio a freddo, copiata nell'app a ogni build
data/diario.enc       copia cifrata del diario
apps-script/          lo script del foglio Google, oggi una copia
prove/                prove in un browser vero: l'app (prova-nuova), il passaggio dall'app di prima
                      (prova-passaggio), il ponte finto (server-finto)
index.html, js/, css/, img/, sw.js, manifest.webmanifest
                      l'app di prima (statica, senza build): non è più pubblicata su Cloudflare; resta nel
                      repo come riferimento dei confronti (app/strumenti/) e per GitHub Pages finché Pages
                      pubblica «dal branch» (vedi app/LEGGIMI.md, «Il passaggio»)
```

## Da dove arrivano i dati

L'originale è il **database** su Cloudflare, dietro il ponte
[`ponte/ponte.js`](ponte/ponte.js) — istruzioni in [`ponte/LEGGIMI.md`](ponte/LEGGIMI.md).
Il foglio Google **sillage-profumi** ne è una copia da guardare, riscritta
dopo ogni modifica. `data/*.json` è la copia notturna versionata: l'app la usa
all'avvio a freddo quando il ponte non risponde.

Le immagini delle boccette stanno in `app/public/img/` (scontornate); il catalogo contiene solo il percorso,
nella colonna `img`.

## Provarla in locale

```bash
cd app
npm install
npm run dev
```

poi <http://127.0.0.1:5173>. Versione finale e prove: [`app/LEGGIMI.md`](app/LEGGIMI.md).

## Pubblicazione

Due indirizzi, la stessa app:

- **Cloudflare** <https://sillage.danilo-moro96.workers.dev/>: `wrangler.jsonc` costruisce `app/` in `sito/`
  a ogni pubblicazione (Workers Builds) e la serve; sotto `/api` c'è il ponte.
- **GitHub Pages** <https://gioveadepto.github.io/Sillage/>: `.github/workflows/pagine.yml` costruisce `app/` e
  la pubblica a ogni push su `main`, quando Pages è impostato su «GitHub Actions».
