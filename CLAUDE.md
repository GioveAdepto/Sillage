# Sillage: regole per Claude Code

Vetrina personale di profumi di Danilo (41 profumi), usata soprattutto da iPhone come app installata,
anche senza rete: un'app in React + TypeScript nella cartella `app/`. Repo pubblico GioveAdepto/Sillage. Rispondi in italiano semplice: l'utente non è un
programmatore di mestiere e vuole risposte brevi con una raccomandazione chiara.

## Quale .md aprire

Questo file si carica a ogni sessione: resta corto. I dettagli stanno qui, da aprire solo quando servono.

| argomento | file |
|---|---|
| struttura dei file, provarla in locale, pubblicazione | `README.md` |
| l'app: avvio, pagine, regole portate, prove, passaggio dall'app di prima e ritorno | `app/LEGGIMI.md` |
| stile Boutique (chiaro e scuro): colori, caratteri, componenti, movimento | `DESIGN.md` |
| database, ponte, indirizzi `/api`, come applicare modifiche, tornare indietro | `ponte/LEGGIMI.md` |
| foglio Google, Apps Script, chiave, diario cifrato (storia e via di ritorno) | `apps-script/LEGGIMI.md` |

A ogni modifica aggiorna, nello stesso commit, il `.md` che la descrive. Se un `.md` dice una cosa non
più vera, correggila subito.

## Com'è fatto, in breve

- **L'app** sta in `app/`: React + TypeScript + Vite, installabile (vite-plugin-pwa), pagine con indirizzo
  a cancelletto (`#/profumo/24`), stile Boutique chiaro e scuro. Si costruisce alla pubblicazione: non c'è
  più nessun `?v=` da alzare.
- **L'app di prima** (`index.html`, `js/`, `css/`, `sw.js` nella radice) non è più pubblicata: resta come
  riferimento dei confronti automatici e per tornare indietro. Non modificarla.
- **Pubblicazione** da `main`, su due indirizzi con la stessa app: Cloudflare Workers Builds
  (`wrangler.jsonc` costruisce `app/` in `sito/`; sotto `/api` c'è il ponte) e GitHub Pages
  (`.github/workflows/pagine.yml`).
- **Dati**: l'originale è il **database Cloudflare D1** dietro il ponte `ponte/ponte.js`
  (`https://sillage.danilo-moro96.workers.dev/api`). Il foglio Google `sillage-profumi` è una copia
  riscritta dal ponte; `data/*.json` è la copia notturna; `data/diario.enc` il diario cifrato.
- **La chiave di Sillage** protegge diario, residuo e modifiche al catalogo. In locale sta in
  `C:\Projects\Sillage\.dev.vars` (ignorato da git). Mai nel repo, nelle risposte o negli indirizzi.
- **Controlli**: `.github/workflows/prova.yml` costruisce l'app, la confronta con quella di prima (punteggio di
  Consigliami, numeri, filtri, coda del diario) e la percorre in un browser con un ponte finto.

## Cambiare i dati del catalogo

Voci in `data/aggiunte.json` e `data/correzioni.json` (nomi di colonna del foglio), poi
`node ponte/applica.mjs --prova` e `node ponte/applica.mjs`: lo lancio io, non l'utente.
I dati vengono dalle schede Fragrantica e devono essere precisissimi: l'utente salva le schermate in
`C:\Projects\Sillage\SchedeProfumiFragrantica` (fuori da git) e le barre si misurano al pixel.
Diario e residuo li scrive solo l'app. Il codice Apps Script lo aggiorna solo l'utente a mano: evitalo.

## Regole dell'app (scelte dell'utente)

- Consigliami: prima la stagione (voti per stagione di Fragrantica, calendario e meteo orario
  Open-Meteo), poi l'occasione, poi giorno/sera. Diario e voti personali non entrano nel punteggio.
  Ogni modifica al punteggio si verifica con un prima/dopo.
- Saltando a un profumo da un'altra sezione, la scheda resta chiusa, ancorata e illuminata.
- Nessuna memoria di stato tra un'apertura e l'altra; niente promemoria; il residuo si sceglie a mano;
  niente campo «stato» sui profumi (rifiutato).
- Deve funzionare da iPhone come app installata, anche senza rete (cache, coda locale delle scritture).
- Le rifiniture (vetrina di apertura, boccetta che vola sul piedistallo e si guarda da vicino, View
  Transitions, tilt) non si rompono.
- Le prove non scrivono mai nel database vero: ponte locale o finto (`app/LEGGIMI.md`, «Prove»).

## Git

- Branch con un nome italiano chiaro (`chiave-del-diario`, `database-d1`), mai `claude/...`: dal worktree
  `git push origin HEAD:refs/heads/<nome>`. Committa e pusha il branch senza chiedere.
- Unisci su `main` solo con il via libera dell'utente in quella conversazione (senza, il push su `main`
  viene bloccato), con `--no-ff` e un messaggio da file (`git merge -F file`) che dica cosa cambia per chi
  usa l'app. Dopo, verifica il sito pubblicato. `gh secret set` lo fa l'utente.
- Dopo ogni pubblicazione che tocca il ponte: `azione=sincronizza` con la chiave deve rispondere `ok`.
