# Sillage: regole per Claude Code

Vetrina personale di profumi di Danilo (41 profumi), usata soprattutto da iPhone come app installata,
anche senza rete. Repo pubblico GioveAdepto/Sillage. Rispondi in italiano semplice: l'utente non è un
programmatore di mestiere e vuole risposte brevi con una raccomandazione chiara.

## Tieni aggiornati i file .md

A ogni modifica aggiorna il `.md` che la descrive (questo file, `README.md`, `ponte/LEGGIMI.md`,
`apps-script/LEGGIMI.md`). Servono alle sessioni future per capire il progetto leggendo poco,
invece di riscoprirlo dal codice.

## Com'è fatto

- **Frontend statico, senza build**: `index.html`, sei script classici in `js/` caricati in ordine
  (dati, collezione, consigliami, viste, diario, app) con variabili globali condivise e `onclick` inline;
  `css/sillage.css`, `css/transitions.css`; service worker `sw.js`; immagini in `img/`.
  Se cambi un file JS o CSS, alza il `?v=` in `index.html`.
- **Dati**: l'originale è il **database Cloudflare D1** dietro il ponte `ponte/ponte.js` (Worker su
  `https://sillage.danilo-moro96.workers.dev/api`). Il foglio Google `sillage-profumi` ne è una copia
  riscritta dal ponte (Apps Script, `azione=specchio`). `data/*.json` è la copia notturna
  (`.github/workflows/copia-notturna.yml`); `data/diario.enc` è il diario cifrato. Dettagli in `ponte/LEGGIMI.md`.
- **La chiave di Sillage** protegge diario, residuo e modifiche al catalogo. Sta in: proprietà script
  `CHIAVE` (Apps Script), segreto `SILLAGE_CHIAVE` su GitHub e nel Worker (tipo **Secret**, riquadro
  Variables and Secrets in cima a Settings, non in Builds), `localStorage` del telefono,
  `C:\Projects\Sillage\.dev.vars` in locale (ignorato da git). Mai nel repo, mai negli indirizzi.
- **Pubblicazione**: GitHub Pages da `main` (il sito) e Workers Builds da `main` (sito e ponte).
  Controlli: `.github/workflows/prova.yml` (sintassi e Playwright con `prove/prova.mjs`).

## Cambiare i dati del catalogo

Voci in `data/aggiunte.json` (righe e colonne nuove) e `data/correzioni.json` (celle, con il valore `da`
atteso), con i nomi di colonna del foglio. Poi `node ponte/applica.mjs --prova` e `node ponte/applica.mjs`.
I dati dei profumi vengono dalle schede Fragrantica e devono essere precisissimi. Diario e residuo li
scrive solo l'app. Apps Script si aggiorna solo a mano dall'utente: evitalo se puoi.

## Regole dell'app (scelte dell'utente)

- Consigliami: prima la stagione (voti per stagione di Fragrantica, calendario e meteo orario
  Open-Meteo), poi l'occasione, poi giorno/sera. Diario e voti personali non entrano nel punteggio.
  Ogni modifica al punteggio si verifica con un prima/dopo.
- Saltando a un profumo da un'altra sezione, la scheda resta chiusa, ancorata e illuminata.
- Nessuna memoria di stato tra un'apertura e l'altra; niente promemoria; il residuo si sceglie a mano.
- Deve funzionare da iPhone come app installata, anche senza rete (cache, coda locale delle scritture).
- Le rifiniture (boccetta presa in mano, vetrina di apertura, View Transitions, tilt) non si rompono.

## Git

- Lavora su un branch con un nome italiano chiaro (`chiave-del-diario`, `database-d1`), mai il nome
  automatico `claude/...`. Committa e pusha il branch senza chiedere.
- Unisci su `main` solo con il via libera dell'utente in quella conversazione, con `--no-ff` e un
  messaggio che dica cosa cambia per chi usa l'app. Dopo, verifica il sito pubblicato.
- Dopo ogni pubblicazione che tocca il ponte: `azione=sincronizza` con la chiave deve rispondere `ok`.
