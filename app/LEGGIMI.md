# La nuova Sillage (React + TypeScript)

La riscrittura dell'app in React, con lo stile «Boutique di nicchia» (anteprima D, prima versione):
travertino e avorio con fili d'ottone, e lo stesso negozio in penombra quando l'iPhone è in modalità scura.
Vive in questa cartella finché l'utente non decide il passaggio: **l'app di oggi (nella radice del repo)
resta quella pubblicata** e non viene toccata.

Ponte e database sono gli stessi dell'app di oggi: questa app legge da
`https://sillage.danilo-moro96.workers.dev/api` (vedi `ponte/LEGGIMI.md`).

## Avviarla

Serve Node 20 o più recente.

```bash
cd app
npm install
npm run dev
```

poi <http://127.0.0.1:5173>. Per provare la versione finale, con il service worker e senza rete:

```bash
npm run build
npm run anteprima
```

poi <http://127.0.0.1:4173> (dal Claude desktop: configurazione `app-nuova` in `.claude/launch.json`).
`npm run controlla` controlla solo i tipi.

Il service worker tiene in memoria la build: dopo una build nuova, la prima apertura scarica la versione
nuova e la successiva la mostra (si aggiorna da solo, `registerType: "autoUpdate"`).

## Struttura

```
index.html               la pagina; colori della barra di stato chiaro/scuro
vite.config.ts           Vite, React e la PWA (manifest, cache per l'uso senza rete)
public/img/              41 boccette scontornate (webp con trasparenza) e le icone dell'app
strumenti/scontorna.py   rifà le foto scontornate: python scontorna.py <cartella-originali> <cartella-uscita>
strumenti/prima-dopo.mjs confronta la classifica di Consigliami tra l'app di oggi e la nuova (vedi «Prove»)
src/main.tsx             avvio: caratteri, stile, dati, router
src/rotte.tsx            le pagine e i loro indirizzi
src/tipi.ts              com'è fatto un profumo che arriva dal ponte
src/profumo.ts           le regole portate da js/collezione.js e js/dati.js, compreso adesso() col tramonto
src/consiglio.ts         il punteggio di Consigliami, portato da js/consigliami.js (niente React: lo usa anche il prima/dopo)
src/meteo.ts             Open-Meteo: posizione, scaricamento, finestra delle ore sulla pelle (da js/dati.js)
src/dati.tsx             lettura dal ponte, copia in localStorage, contesto React (useDati)
src/meteo-contesto.tsx   il meteo per tutta l'app (useMeteo): Consigliami e il filtro «Adesso»
src/componenti/          Guscio (barra in basso), Icone, Piedistallo, pezzi comuni (Boccetta, meno movimento)
src/pagine/              Collezione, Scheda, Consigliami, Altro, Segnaposto (pagine in arrivo)
src/stile/               token.css (tutti i colori, chiaro e scuro), base, collezione, scheda, consigliami, pagine
```

- **Caratteri**: Cormorant Garamond e Jost sono dentro l'app (pacchetti `@fontsource`, solo l'alfabeto
  latino), così funzionano anche senza rete e senza chiedere nulla a Google.
- **Tema**: tutti i colori sono variabili in `src/stile/token.css`; lo scuro cambia solo i valori e segue
  l'iPhone (`prefers-color-scheme`). Nessun interruttore salvato.
- **Movimento**: chi ha chiesto meno movimento (`prefers-reduced-motion`) non vede cadute, voli né barre
  che si allungano.

## Dati

All'avvio l'app mostra subito l'ultima copia salvata sul telefono (`localStorage`, chiave
`sillage-app:dati`) e intanto chiede i dati al ponte (al massimo 8 secondi). Se il ponte risponde, la
copia si aggiorna; se no, si resta sulla copia. In più il service worker tiene l'ultima risposta del ponte.
Alla prima apertura in assoluto serve la rete. Il diario cifrato che il ponte manda non viene salvato:
arriva con la tappa 3.

## Pagine

Router a cancelletto (`#/…`): funziona su qualunque hosting e senza rete, il server non deve sapere nulla.
Barra in basso con cinque voci: Collezione, Consigliami, Diario, Numeri, Altro.

| indirizzo | pagina | stato |
|---|---|---|
| `#/` | **Collezione**: Boccette / Campioni, cerca, filtri per famiglia e «Adesso», mensole con i cartellini | fatta |
| `#/?v=campioni&f=verde&ora=1&q=vetiver` | i filtri stanno nell'indirizzo: «indietro» li ritrova, una nuova apertura riparte pulita | fatta |
| `#/?vedi=24` | arrivo da un'altra pagina: vetrina giusta, filtri tolti, si scorre alla teca (chiusa) e si illumina | fatta |
| `#/profumo/24` | **Scheda**: piedistallo col faretto, voto/durata/sillage, piramide, accordi con la forza, stagioni (quella di ora in ottone), giorno e sera, uso, note personali, racconto, parentele (copia di…), somiglia a, formato e residuo in sola lettura, link a Fragrantica. La boccetta vola dalla teca al piedistallo (View Transition) | fatta |
| `#/altro` | **Altro**: indice di Layering, Guida, Acquisti, Confronta, Impostazioni, e da dove arrivano i dati | fatta |
| `#/consigliami?quando=domani&occ=ufficio` | **Consigliami**: oggi, stasera o domani e l'occasione (nell'indirizzo); ora, aria, cielo e stagione; la prima scelta sul piedistallo con i motivi (I., II.… a favore, «ma» contro); quattro alternative coi tre motivi più forti; le ore sulla pelle con la curva della temperatura percepita; il pulsante per il meteo di dove sei | fatta (tappa 2) |
| `#/diario` | Diario, con «Lo metto oggi» e il residuo modificabile | segnaposto, tappa 3 |
| `#/numeri`, `#/layering`, `#/guida`, `#/acquisti`, `#/confronta` | | segnaposto, tappa 4 |
| `#/impostazioni` | chiave, posizione per il meteo, origine dei dati | segnaposto, tappe 2 e 3 |

«Collezione» in alto nella scheda: se si arriva dalla vetrina torna indietro (filtri e punto ritrovati);
se si arriva da un'altra scheda dice «Indietro»; se la scheda è stata aperta da un link porta alla vetrina
con `?vedi=`.

## Consigliami e il meteo

Il punteggio è quello dell'app di oggi, riga per riga (`src/consiglio.ts`): prima la stagione (voti per
stagione di Fragrantica contro calendario e temperatura percepita nelle ore sulla pelle), poi l'occasione
(l'ufficio dosa e non esclude), poi giorno o sera; caldo umido e pioggia spostano poco; a parità decide il
rating. Diario e voti personali non entrano. Boccette e campioni insieme.

- **Stasera** è nuovo: lo stesso punteggio con l'inizio alle 19 di oggi (o adesso, se è più tardi).
- **Senza meteo** (posizione mai data o niente rete) conta il calendario, come nell'app di oggi.
- La posizione si chiede solo dal pulsante; resta sul telefono arrotondata a una decina di chilometri
  (`sillage-app:posto`), il meteo in `sillage-app:meteo`, e si rinfresca quando ha più di mezz'ora.
  «non usarlo più» cancella tutti e due.
- Il filtro «Adesso» della Collezione usa lo stesso `adesso()`: con il meteo la sera comincia mezz'ora dopo
  il tramonto (al più tardi alle 19), senza alle 18.
- Mancano ancora, perché dipendono dal Diario o dal Layering: «Lo metto», «Mai indossati, se vuoi
  riscoprirli», la frase «è un campione: buona occasione per provarlo» (solo per i campioni mai indossati) e
  «Se vuoi osare, con…» (la ricetta di layering). Nessuna di queste cambia la classifica.

## Regole portate dall'app di oggi

In `src/profumo.ts`, una per una e con lo stesso risultato: numero di catalogo (posizione nella sua vetrina,
in ordine di id), ricerca senza accenti, famiglie (blu/verde/rosso), piramide, accordi con la forza,
«Adesso» (stagioni a equinozi e solstizi, sera dal tramonto o dalle 18), «Nuovo» per 30 giorni,
livelli del residuo, originale e copie, somiglianza. Finché le due app convivono, una regola cambiata là va
cambiata anche qui.

## Prove

`npm run build` controlla i tipi e costruisce. Le prove automatiche di `.github/workflows/prova.yml`
riguardano ancora l'app di oggi; quelle della nuova arrivano con la tappa 5.

**Prima/dopo di Consigliami** (obbligatorio a ogni modifica del punteggio, regola dell'utente):

```bash
cd app
node strumenti/prima-dopo.mjs            # profumi da data/profumi.json
node strumenti/prima-dopo.mjs --ponte    # profumi letti adesso dal ponte
```

Carica `js/dati.js`, `js/collezione.js` e `js/consigliami.js` dell'app di oggi in una sandbox, e
`src/consiglio.ts` compilato al volo; con un orologio finto e un meteo finto (caldo umido d'estate, pioggia
in primavera e autunno, tramonti veri per la stagione) confronta ordine, punteggio e motivi di ogni profumo
in 224 casi: 4 date × mattina e sera × 7 occasioni × oggi/domani × con e senza meteo. Esce con errore se
trova differenze. Unica differenza voluta: il voto nei motivi con la virgola («★ 4,3»).
