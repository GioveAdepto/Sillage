# Sillage

Vetrina di una collezione privata di profumi. Pagina statica, nessuna
compilazione: si apre servendo la cartella così com'è.

## Struttura

```
index.html            solo markup; carica CSS e JS con ?v= per svuotare le cache
css/sillage.css       lo stile (vedi DESIGN.md)
css/transitions.css   animazioni e View Transitions
js/dati.js            da dove arrivano i dati, etichette, stagione, ora e meteo
js/collezione.js      filtri, teca, boccetta presa in mano, dettaglio, coda del diario
js/consigliami.js     scelte rapide, cassetto dei filtri, Consigliami
js/viste.js           confronto, Guida, Layering, Acquisti, Numeri, condivisione
js/diario.js          il diario e il piano della settimana
js/app.js             navigazione, vetrina di apertura, app installabile, avvio
sw.js                 service worker: l'app funziona anche senza rete
data/*.json           copia notturna dei dati (ripiego e avvio a freddo)
data/diario.enc       copia cifrata del diario
img/*.webp            41 flaconi, 176×208, più il segnaposto; img/avvio le schermate d'avvio iPhone
ponte/                il Worker con il database (ponte.js, applica.mjs)
apps-script/          lo script del foglio Google, oggi una copia
prove/prova.mjs       prove Playwright lanciate da .github/workflows/prova.yml
app/                  la nuova app in React + TypeScript, in prova su /nuova/ dell'anteprima del branch (app/LEGGIMI.md)
```

I sei script sono classici (niente moduli): si caricano in quest'ordine e
condividono variabili globali.

## Da dove arrivano i dati

L'originale è il **database** su Cloudflare, dietro il ponte
[`ponte/ponte.js`](ponte/ponte.js) — istruzioni in [`ponte/LEGGIMI.md`](ponte/LEGGIMI.md).
Il foglio Google **sillage-profumi** ne è una copia da guardare, riscritta
dopo ogni modifica. `data/*.json` è la copia notturna versionata: l'app la usa
quando il ponte non risponde.

Le immagini restano file nel repo, non passano dal foglio: il foglio contiene
solo il percorso, nella colonna `img`.

## Provarla in locale

Serve un server, perché i dati si caricano con `fetch`:

```bash
python -m http.server 8765
```

poi <http://127.0.0.1:8765>. Aprire `index.html` con doppio clic non funziona.

## Pubblicazione

GitHub Pages sul ramo `main`. `wrangler.jsonc` tiene in piedi in parallelo la
distribuzione Cloudflare Workers, che serve la stessa cartella e, sotto `/api`,
il ponte verso il database: vedi [`ponte/LEGGIMI.md`](ponte/LEGGIMI.md).

Per disegnare una pagina nuova: colori, caratteri, componenti e movimento sono riassunti in [`DESIGN.md`](DESIGN.md).
