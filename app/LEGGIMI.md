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
strumenti/prova-coda.mjs prove della coda del diario (vedi «Prove»)
strumenti/foglio-finto.mjs un Web App del foglio finto, per il ponte locale (vedi «Provarla col ponte locale»)
strumenti/verifica-viste.mjs confronta Numeri, Guida, Layering, Acquisti, Confronto e somiglianze con l'app di oggi
src/main.tsx             avvio: caratteri, stile, dati, router
src/rotte.tsx            le pagine e i loro indirizzi
src/tipi.ts              com'è fatto un profumo che arriva dal ponte
src/profumo.ts           le regole portate da js/collezione.js e js/dati.js, compreso adesso() col tramonto
src/consiglio.ts         il punteggio di Consigliami, portato da js/consigliami.js (niente React: lo usa anche il prima/dopo)
src/meteo.ts             Open-Meteo: posizione, scaricamento, finestra delle ore sulla pelle (da js/dati.js)
src/dati.tsx             lettura dal ponte (con la chiave anche il diario), copia in localStorage, useDati
src/ponte.ts             l'indirizzo del ponte, la chiave, le scritture, il diario unico dell'app
src/diario/coda.ts       il diario e la coda delle scritture (niente React: lo usano anche le prove)
src/diario/uso.tsx       useDiario, l'invio al ritorno della rete, useSegna
src/diario/pezzi.tsx     «Lo metto oggi», occasione e momento di una voce, «Su di te»
src/meteo-contesto.tsx   il meteo per tutta l'app (useMeteo): Consigliami e il filtro «Adesso»
src/viste/calcoli.ts     i calcoli di Numeri, mappa olfattiva, Guida, Layering, Acquisti, Confronto (da js/viste.js)
src/viste/condividi.ts   l'immagine della scheda da condividere (1080×1350)
src/componenti/          Guscio, Icone, Piedistallo, Avvisi, Ruota (degli accordi), Righe (sezioni, classifiche),
                         Tessera (profumo che porta alla teca), pezzi comuni (Boccetta, Mini, meno movimento)
src/pagine/              Collezione, Scheda, Consigliami, Diario, Numeri, Layering, Guida, Acquisti, Confronta,
                         Impostazioni, Altro, Segnaposto (pagina non trovata)
src/stile/               token.css (tutti i colori, chiaro e scuro), base, collezione, scheda, consigliami, diario,
                         viste, pagine
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
Alla prima apertura in assoluto serve la rete. Con la chiave la lettura è `POST azione=leggi` (chiave nel
corpo) e porta anche il diario; senza, `GET` e niente diario (`diarioChiuso`).

## Pagine

Router a cancelletto (`#/…`): funziona su qualunque hosting e senza rete, il server non deve sapere nulla.
Barra in basso con cinque voci: Collezione, Consigliami, Diario, Numeri, Altro.

| indirizzo | pagina | stato |
|---|---|---|
| `#/` | **Collezione**: Boccette / Campioni, cerca, filtri per famiglia e «Adesso», mensole con i cartellini | fatta |
| `#/?v=campioni&f=verde&ora=1&q=vetiver` | i filtri stanno nell'indirizzo: «indietro» li ritrova, una nuova apertura riparte pulita | fatta |
| `#/?vedi=24` | arrivo da un'altra pagina: vetrina giusta, filtri tolti, si scorre alla teca (chiusa) e si illumina | fatta |
| `#/profumo/24` | **Scheda**: piedistallo col faretto, voto/durata/sillage, «Lo metto oggi» (con occasione e momento, e il link all'appunto), piramide, accordi con la forza, stagioni (quella di ora in ottone), giorno e sera, uso, note personali, «Su di te» (dagli appunti), racconto, parentele (copia di…), somiglia a, formato e residuo da toccare, link a Fragrantica. La boccetta vola dalla teca al piedistallo (View Transition) | fatta |
| `#/altro` | **Altro**: indice di Layering, Guida, Acquisti, Confronta, Impostazioni, e da dove arrivano i dati | fatta |
| `#/consigliami?quando=domani&occ=ufficio` | **Consigliami**: oggi, stasera o domani e l'occasione (nell'indirizzo); ora, aria, cielo e stagione; la prima scelta sul piedistallo con i motivi (I., II.… a favore, «ma» contro) e «Lo metto oggi»; quattro alternative coi tre motivi più forti e «Lo metto»; le ore sulla pelle; «Mai indossati, se vuoi riscoprirli»; il pulsante per il meteo di dove sei | fatta (tappe 2 e 3) |
| `#/diario?mese=2026-11&giorno=2026-11-12` | **Diario**: il mese con le boccette nei giorni, il giorno scelto (aggiungi un profumo o un layering, togli, occasione e momento, appunto con voto), la cronologia | fatta (tappa 3) |
| `#/diario?vista=settimana` | **La settimana**: un suggerimento al giorno da lunedì a domenica, con l'occasione da cambiare e «Lo metto» per oggi; i giorni passati dicono cosa hai messo | fatta (tappa 3) |
| `#/impostazioni` | **Impostazioni**: la chiave di Sillage, la posizione per il meteo, da dove arrivano i dati | fatta (tappa 3) |
| `#/numeri` | **Numeri**: boccette, campioni, marchi, rating e durata medi, mappa olfattiva (anche coi campioni), stagione e famiglia, occasioni d'uso, accordi più presenti, classifiche per rating e durata, cloni e originali, storico delle aggiunte, il diario (questo mese, le più indossate, da riprendere, per stagione, rotazione del mese), profilo Fragrantica | fatta (tappa 4) |
| `#/layering?tipo=app&ricetta=4` | **Layering**: le quattro regole, i filtri per tipo, le ricette da aprire (sopra e sotto con le dosi, come si fa, risultato, perché, quando) e «Lo faccio oggi» | fatta (tappa 4) |
| `#/guida?occ=ufficio` | **Guida**: le sette occasioni; per ognuna le boccette per stagione (quella in corso prima), con moderazione, in ufficio anche le altre (1 spray), e i campioni | fatta (tappa 4) |
| `#/acquisti` | **Acquisti**: le boccette che stanno finendo, lacune aperte con le idee (✓ se già in casa), le lacune chiuse, il profilo Fragrantica | fatta (tappa 4) |
| `#/confronta?ids=3,24,7` | **Confronta**: due o tre profumi affiancati, cosa hanno in comune, la ruota degli accordi, profilo, accordi e note, quando indossarli; si scelgono qui, dalla Collezione («Confronta» e poi si toccano le teche) o dalla Scheda («Confronta con…») | fatta (tappa 4) |

Da Numeri, Guida, Layering, Acquisti e Confronta un profumo porta alla Collezione, sulla sua teca chiusa che si
illumina (`#/?vedi=ID`, regola dell'utente). Da Consigliami, Diario e dalle righe «Somiglia a» e «Parentele» della
Scheda si apre invece la scheda del profumo (che dalla tappa 1 è una pagina): vedi l'inventario.

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
- Dal diario arrivano solo cose che non cambiano la classifica: «Lo metto», «Mai indossati, se vuoi
  riscoprirli» e la frase «è un campione: buona occasione per provarlo». Manca ancora «Se vuoi osare, con…»
  (la ricetta di layering), che arriva con la pagina Layering (tappa 4).

## Diario, chiave e residuo

- **La chiave** si inserisce in Altro ▸ Impostazioni e resta solo nel `localStorage` di questo telefono
  (`sillage-app:chiave`). Viaggia sempre nel corpo della richiesta, mai nell'indirizzo, e non si mostra.
  Senza chiave (o con quella sbagliata) il diario non si legge e la pagina lo dice; quello che segni resta
  in coda sul telefono e parte appena la chiave è giusta.
- **La coda** (`src/diario/coda.ts`, chiave `sillage-app:diario-coda`) è quella dell'app di oggi: ogni voce
  messa, tolta o annotata si vede subito e aspetta lì finché il ponte non la conferma. È salvata prima di
  ogni invio, quindi chiudere l'app con la coda piena non perde niente. Parte a ogni scrittura, all'avvio,
  quando torna la rete e quando l'app torna in primo piano; un invio alla volta, e chi lo chiede mentre
  uno è in corso ottiene un altro giro subito dopo. Una voce tolta prima dell'invio sparisce dalla coda.
  Le voci confermate hanno la loro copia (`sillage-app:diario`).
- **Quando il ponte dice di no**: rete assente, errore HTTP (500), chiave sbagliata o «…sconosciuta:» →
  la voce resta in coda e riparte dopo. Un rifiuto definitivo (voce non valida, troppe voci in un giorno,
  voce non trovata, profumo che il database non ha) la toglie dalla coda, come nell'app di oggi, e l'app lo
  dice con un avviso.
- **Due differenze volute dall'app di oggi**, entrambe per non perdere niente: un errore 500 del ponte lascia
  la voce in coda (prima la toglieva), e un appunto scritto su una voce ancora in coda arriva al ponte subito
  dopo la voce (prima si perdeva se la voce partiva senza).
- **Regole**: al massimo due profumi al giorno, o un layering (sotto e sopra) che prende il giorno intero;
  togliere metà di un layering lo toglie tutto. Niente promemoria. Il diario non entra nel punteggio di
  Consigliami; il piano della settimana evita solo di riproporre lo stesso profumo due volte.
- **Il residuo** si tocca nella scheda (sette tacche) e va subito al database con la chiave, come nell'app di
  oggi: niente coda. Se non riesce torna com'era e lo dice.

## Regole portate dall'app di oggi

In `src/profumo.ts`, una per una e con lo stesso risultato: numero di catalogo (posizione nella sua vetrina,
in ordine di id), ricerca senza accenti, famiglie (blu/verde/rosso), piramide, accordi con la forza,
«Adesso» (stagioni a equinozi e solstizi, sera dal tramonto o dalle 18), «Nuovo» per 30 giorni,
livelli del residuo, originale e copie, somiglianza. Finché le due app convivono, una regola cambiata là va
cambiata anche qui.

## Prove

`npm run build` controlla i tipi e costruisce. Le prove automatiche di `.github/workflows/prova.yml`
riguardano ancora l'app di oggi; quelle della nuova arrivano con la tappa 5.

**Verifica delle viste** (Numeri, Guida, Layering, Acquisti, Confronto, somiglianze):

```bash
cd app
node strumenti/verifica-viste.mjs            # profumi, layering e consigli da data/*.json
node strumenti/verifica-viste.mjs --ponte    # gli stessi letti adesso dal ponte (sola lettura)
```

L'app di oggi gira in una sandbox con un DOM finto: si chiamano le sue funzioni di disegno (`disegnaNumeri`, anche
con la mappa dei campioni; `disegnaGuida` per ogni occasione e per le due stagioni; `disegnaAcquisti`;
`disegnaConfronto` su cinque coppie e terne) e dal loro HTML si leggono numeri e profumi nell'ordine in cui
compaiono; le funzioni pure (`partiRicetta`, `indiceStrati`, `giaInCasa`, `similiA`, `posizioneOlfattiva`,
`rinumera`) si chiamano direttamente. Diario finto uguale per le due app (mesi diversi, confini di stagione, un
layering, una voce futura), orologio fermo. 328 controlli; differenze volute, normalizzate: la virgola nei numeri e
«Nº» invece di «№».

**Prove della coda del diario**:

```bash
cd app
node strumenti/prova-coda.mjs                  # ponte finto in memoria, stesse regole di ponte/ponte.js
node strumenti/prova-coda.mjs --ponte-locale   # in più, contro il ponte locale (vedi sotto)
```

Metti senza rete → voce visibile → torna la rete → un invio solo (anche con tre richiami insieme); app chiusa
con la coda piena; togli prima dell'invio; togli di una voce confermata senza rete; appunto su voce in coda e
su voce confermata; errore 500, chiave sbagliata e «sconosciuta:» → la voce resta; rifiuto definitivo → esce
e l'app lo sa; limite di due al giorno e layering. Mai contro il ponte pubblicato.

**Provarla col ponte locale** (nessuna scrittura arriva al database vero né al foglio):

```bash
cd app
node strumenti/foglio-finto.mjs                       # porta 8899, il catalogo da data/*.json
```
```bash
npx wrangler@4 dev --port 8787 --ip 127.0.0.1 --var FOGLIO_URL:http://127.0.0.1:8899/exec --var SILLAGE_CHIAVE:prova
```
```bash
cd app
VITE_PONTE=http://127.0.0.1:8787/api npm run build
npm run anteprima
```

(il secondo dalla radice del repo). In Impostazioni la chiave è `prova`; Impostazioni ▸ I dati dice
«ponte locale di prova». Prima di pubblicare si ricostruisce senza `VITE_PONTE`. Il database locale sta in
`.wrangler/` (fuori da git).

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

## Inventario: l'app di oggi e la nuova

Per la tappa 5 (il passaggio). «c'è» = stessa funzione; «cambiata» = c'è, ma diversa apposta; «manca» = non c'è
ancora.

### Collezione e scheda

| funzione dell'app di oggi | nella nuova |
|---|---|
| Boccette e campioni in due vetrine, numero di catalogo per vetrina | c'è |
| Ricerca senza accenti (nome, marca, note, famiglia, accordi, dupe) | c'è |
| Scelte rapide: Adesso, Ufficio, Appuntamento, Sera, Cloni, Novità | cambiata: restano Adesso e le tre famiglie; le altre stanno in Guida e Numeri |
| Cassetto dei filtri (stagione, occasione, famiglia, momento, provenienza, note olfattive) e ordinamenti (nome, marchio, rating, famiglia, stagione, longevità, numero, aggiunti di recente) | manca: oggi solo famiglia, «Adesso» e ricerca; ordine fisso per numero di catalogo |
| Filtri ricordati solo finché l'app è aperta | cambiata: stanno nell'indirizzo (`#/?f=verde&ora=1&q=…`), «indietro» li ritrova |
| Teca che si apre sul posto (o nel pannello a destra su schermo largo) | cambiata: la scheda è una pagina (`#/profumo/ID`) |
| Saltando a un profumo da un'altra sezione la teca resta chiusa, ancorata e illuminata | c'è per Numeri, Guida, Layering, Acquisti, Confronta e per i link esterni alla scheda; cambiata per Consigliami, Diario e le righe della Scheda, che aprono la scheda |
| Piramide, accordi con la forza, stagioni, giorno/sera, uso, note personali, racconto | c'è (righe misurate della Boutique) |
| Ruota degli accordi nella scheda | cambiata: nella scheda le righe con la forza; la ruota c'è in Confronta |
| Icone delle note (emoji) | cambiata: tolte nello stile Boutique |
| Parentele (originale e cloni), Somiglia a, Layering del profumo | c'è |
| «Lo metto oggi», appunto, occasione e momento, «Su di te», residuo a sette tacche | c'è |
| Condividi la scheda (immagine 1080×1350) | c'è, nei colori della Boutique in penombra |
| Apri su Fragrantica | c'è |
| Vassoio del confronto (+ su ogni teca, fino a tre) | cambiata: «Confronta» nella Collezione, poi si toccano le teche; vassoio in basso; anche «Confronta con…» dalla scheda |

### Altre pagine

| funzione | nella nuova |
|---|---|
| Consigliami (oggi e domani, occasioni, primo consiglio e alternative, motivi, meteo ora per ora, «Lo metto», mai indossati) | c'è, con lo stesso punteggio (prima/dopo); in più «Stasera»; da foglio è diventata pagina |
| «Se vuoi osare, con…» (ricetta di layering in Consigliami) | manca |
| Diario: mese, giorno, aggiungi un profumo o un layering, togli, appunto, cronologia; piano della settimana | c'è |
| Chiave chiesta dal Diario con un prompt | cambiata: si inserisce in Altro ▸ Impostazioni |
| Numeri, mappa olfattiva, storico, diario nei Numeri | c'è, stessi numeri (verifica-viste); il link «Le N novità →» manca (non c'è il filtro Novità) |
| Layering, Guida, Acquisti, Confronto | c'è, stesse liste (verifica-viste) |
| Profilo Fragrantica | c'è |
| Barra in basso: Collezione, Diario, Layering, Guida, Acquisti, Numeri | cambiata: Collezione, Consigliami, Diario, Numeri, Altro (con Layering, Guida, Acquisti, Confronta, Impostazioni) |

### Rifiniture

| funzione | nella nuova |
|---|---|
| Vetrina di apertura (le due ante di vetro all'avvio) | manca |
| Boccetta presa in mano (l'esame nella teca aperta) | manca; al suo posto la boccetta che vola dalla teca al piedistallo |
| Tilt delle boccette e riflesso che segue il dito | manca |
| View Transitions | c'è: teca → scheda e ritorno, Consigliami → scheda |
| Boccette che si posano sulla mensola, barre che si allungano, faretto che si accende | c'è (prima apertura della vetrina) |
| Scheletro durante l'attesa | cambiata: «Apro la vetrina…» |
| Pillola che scorre sotto la voce attiva della barra | cambiata: filo d'ottone sopra la voce attiva, senza scorrimento |
| Tasto indietro del telefono e link diretti alle sezioni | c'è: ogni pagina ha il suo indirizzo `#/…` |
| Avviso «c'è una versione nuova» | cambiata: il service worker scarica la versione nuova e ricarica l'app da solo, senza avviso |
| App installabile e senza rete (service worker, manifest, icone) | c'è (vite-plugin-pwa) |
| Schermate d'avvio dell'iPhone (`img/avvio/`) | manca |
| Tema | cambiata: Boutique chiara e scura, segue l'iPhone |
| Avvisi brevi in basso | c'è |
| Meno movimento per chi lo chiede | c'è |
