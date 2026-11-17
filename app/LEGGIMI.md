# Sillage, l'app (React + TypeScript)

L'app di Sillage riscritta in React, con lo stile «Boutique di nicchia» (anteprima D, prima versione):
travertino e avorio con fili d'ottone, e lo stesso negozio in penombra quando l'iPhone è in modalità scura.
Dal passaggio (tappa 5) è lei l'app pubblicata, agli stessi due indirizzi di prima. L'app di prima
(`index.html`, `js/`, `css/` nella radice del repo) resta come riferimento dei confronti in `strumenti/`.

Ponte e database sono gli stessi: l'app legge da `https://sillage.danilo-moro96.workers.dev/api`
(vedi `ponte/LEGGIMI.md`). Qui sotto «l'app di oggi» vuol dire l'app di prima del passaggio.

## Il passaggio

**Fatto il 13 novembre 2026** (unione `985e662` su `main`). Da quel giorno GitHub Pages è impostato su
«GitHub Actions» e i due indirizzi pubblicano l'app nuova. Quello che segue resta come spiegazione e per tornare indietro.

Stessi due indirizzi di prima, con l'app nuova alla radice: chi ha l'icona sulla schermata Home non la reinstalla.

| indirizzo | come si pubblica |
|---|---|
| <https://sillage.danilo-moro96.workers.dev/> | Cloudflare Workers Builds a ogni push su `main`: `wrangler.jsonc` costruisce `app/` in `sito/` (`"build"`: `node app/strumenti/costruisci-sito.mjs`) e serve quella cartella (`"assets"`: `./sito`); `/api` resta il ponte. Ponte, database, cron e `keep_vars` non cambiano. |
| <https://gioveadepto.github.io/Sillage/> | `.github/workflows/pagine.yml` a ogni push su `main`: costruisce `app/` e la pubblica, **solo** se Pages è impostato su «GitHub Actions». Finché pubblica «dal branch», il workflow salta senza errori e Pages continua a servire l'app di prima dalla radice del repo. |

Le anteprime dei branch su Cloudflare (`https://<branch>-sillage.danilo-moro96.workers.dev/`) mostrano
anch'esse l'app nuova alla radice.

**Cosa succede sul telefono di chi ha già l'app di prima** (stesso indirizzo, stesso `localStorage`), provato
in `prove/prova-passaggio.mjs`, alla radice e in `/Sillage/`:

1. Il service worker di prima chiede la pagina alla rete (per lui viene sempre prima la rete): arriva la nuova.
2. L'app nuova registra `sw.js` allo stesso indirizzo. Il suo pezzo di passaggio (`public/pulizia-sw.js`) vede la
   cache di prima (`sillage-v3`): prende subito il posto del vecchio e la cancella. Dalla volta dopo le versioni
   nuove aspettano «Aggiorna», come sempre.
3. Prima di leggere qualunque cosa, l'app riprende quello che l'altra aveva salvato (`src/migrazione.ts`): la
   chiave (`sillage:chiave`), la coda del diario (`sillage:diario-coda`, passata una volta sola e poi cancellata),
   la copia dei dati e del diario, la posizione e il meteo.
4. Se l'app di prima è rimasta aperta, il suo controllo della versione trova la pagina nuova (una riga apposta
   in `index.html`) e propone «Aggiorna».

### I passi all'unione (li fa chi unisce, nell'ordine)

1. Controllare che sul branch siano verdi la prova (`Prova del sito`) e la build di Cloudflare, e aprire
   l'anteprima del branch alla radice.
2. Unire su `main` con `--no-ff` (un'unione sola: per tornare indietro si annulla quella).
3. Cloudflare: la build di `main` parte da sola (Workers Builds); controllare che sia verde e aprire
   <https://sillage.danilo-moro96.workers.dev/>: deve esserci l'app nuova. Poi, come dopo ogni pubblicazione
   che tocca il ponte, `azione=sincronizza` con la chiave deve rispondere `ok`.
4. GitHub Pages, col sì dell'utente: Settings ▸ Pages ▸ Build and deployment ▸ Source → «GitHub Actions».
   Poi Actions ▸ «Pubblica su GitHub Pages» ▸ Run workflow (o il prossimo push su `main`) e aprire
   <https://gioveadepto.github.io/Sillage/>. Finché questo passo non è fatto, Pages serve l'app di prima.
5. Sull'iPhone: aprire l'app dalla Home. La prima volta arriva la nuova (con la chiave e il diario di prima);
   se l'app di prima era rimasta aperta in sottofondo, toccare «Aggiorna».

### Per tornare indietro

- **Tutto**: annullare l'unione su `main` (`git revert -m 1 <commit dell'unione>`) e pushare. Cloudflare torna a
  servire la radice del repo con l'app di prima; per Pages, rimettere Source su «Deploy from a branch» (`main`,
  `/`). Sul telefono l'app di prima ritrova la sua chiave (`sillage:chiave` non viene cancellata); le voci del
  diario passate alla coda nuova sono già arrivate al database, o partono alla prossima apertura dell'app nuova.
- **Solo Pages**: rimettere Source su «Deploy from a branch»: torna l'app di prima su GitHub Pages, Cloudflare
  resta con la nuova.
- Il service worker nuovo resta registrato sul telefono finché il vecchio non lo sostituisce (alla prima
  apertura dopo il ritorno, perché `sw.js` cambia): niente da fare a mano.

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

Il service worker tiene in memoria la build. Quando ne trova una nuova (all'avvio, quando l'app torna in primo
piano, ogni mezz'ora) non ricarica da solo: compare l'avviso «Versione nuova di Sillage» con «Aggiorna»
(`registerType: "prompt"`, `src/componenti/VersioneNuova.tsx`), così un appunto in scrittura non si perde.
Durante le prove, dopo ogni build: «Aggiorna», oppure deregistrare il service worker e svuotare la cache.

## Struttura

```
index.html               la pagina; colori della barra di stato chiaro/scuro
vite.config.ts           Vite, React e la PWA (manifest, cache per l'uso senza rete)
public/img/              41 boccette scontornate (webp con trasparenza) e le icone dell'app
public/img/avvio/        le schermate d'avvio dell'iPhone, chiare e scure (fuori dalla cache del service worker)
strumenti/scontorna.py   rifà le foto scontornate (vedi «Le foto delle boccette»)
strumenti/prima-dopo.mjs confronta la classifica di Consigliami tra l'app di oggi e la nuova (vedi «Prove»)
strumenti/prova-coda.mjs prove della coda del diario (vedi «Prove»)
strumenti/foglio-finto.mjs un Web App del foglio finto, per il ponte locale (vedi «Provarla col ponte locale»)
strumenti/supabase-finto.mjs un Supabase Auth finto, per provare gli account (vedi «Provare gli account»)
strumenti/tara-cartoline.mjs taratura della misura delle barre sulle cartoline vere (fuori da git) contro il database
strumenti/tara-scritte.mjs taratura della lettura delle scritte (Tesseract vero, in Node) sulle stesse cartoline
strumenti/tara-piramide.mjs prova della lettura della piramide su schermate vere (fuori da git)
strumenti/cartolina-finta.mjs disegna le cartoline sintetiche delle prove (prove/cartoline/)
strumenti/prova-cartolina.mjs prova della misura, del ritaglio e di come si capiscono le scritte (cartoline sintetiche)
strumenti/prova-aggiungi.mjs prove di «Aggiungi profumo» sul ponte locale
strumenti/cartolina-node.mjs per le prove: legge PNG/JPEG, carica src/cartolina/ in Node e il lettore Tesseract per la taratura
strumenti/prova-accesso.mjs prove degli account sul ponte locale col Supabase finto
strumenti/prova-persone.mjs prove della seconda persona e dell'isolamento sul ponte locale
strumenti/prova-outfit.mjs prova del profumo per l'outfit di CheMetto (ponte/outfit.ts): con outfit neutro = Consigliami
strumenti/verifica-viste.mjs confronta Numeri, Guida, Layering, Acquisti, Confronto e somiglianze con l'app di oggi
strumenti/verifica-filtri.mjs confronta filtri, scelte rapide e ordinamenti della Collezione con l'app di oggi
strumenti/schermate-avvio.py rifà le schermate d'avvio (la vetrina chiusa, chiara e scura)
strumenti/costruisci-sito.mjs costruisce l'app in sito/ (la lancia wrangler prima di ogni pubblicazione)
strumenti/copia-dati.mjs copia data/*.json in public/data/ prima di ogni build (ripiego senza rete)
src/main.tsx             avvio: caratteri, stile, dati, router
src/migrazione.ts        il passaggio: riprende chiave, coda del diario e copie lasciate dall'app di prima
public/pulizia-sw.js     il passaggio: il service worker nuovo prende il posto del vecchio e ne cancella la cache
src/rotte.tsx            le pagine e i loro indirizzi
src/tipi.ts              com'è fatto un profumo che arriva dal ponte
src/profumo.ts           le regole portate da js/collezione.js e js/dati.js, compreso adesso() col tramonto
src/consiglio.ts         il punteggio di Consigliami, portato da js/consigliami.js (niente React: lo usa anche il prima/dopo)
src/meteo.ts             Open-Meteo: posizione, scaricamento, finestra delle ore sulla pelle (da js/dati.js)
src/dati.tsx             lettura dal ponte (con la chiave anche il diario), copia in localStorage, useDati
src/ponte.ts             l'indirizzo del ponte, la chiave, le credenziali (chiave e accesso), le scritture, il diario unico dell'app
src/accesso.ts           l'account: entrare, rinnovare e uscire con Supabase Auth (quello di CheMetto), il token per il ponte
src/diario/coda.ts       il diario e la coda delle scritture (niente React: lo usano anche le prove)
src/diario/uso.tsx       useDiario, l'invio al ritorno della rete, useSegna
src/diario/pezzi.tsx     «Lo metto oggi», occasione e momento di una voce, «Su di te»
src/aggiunte.ts          «Aggiungi profumo»: le chiamate al ponte e la coda delle aggiunte senza rete
src/cartolina/           misura.ts (le barre della cartolina), boccetta.ts (il ritaglio scontornato), immagini.ts
                         (aprire e rimpicciolire nel telefono), scontorna.ts (una foto propria, @imgly), proposte.ts
                         (dal modulo alle colonne del catalogo, stagione/momento/colore/occasioni proposti),
                         scritte.ts (le zone da leggere e come capire il testo letto), lettore.ts (Tesseract,
                         scaricato al primo uso; finto con VITE_LETTORE=finto)
src/meteo-contesto.tsx   il meteo per tutta l'app (useMeteo): Consigliami e il filtro «Adesso»
src/viste/calcoli.ts     i calcoli di Numeri, mappa olfattiva, Guida, Layering, Acquisti, Confronto (da js/viste.js)
src/viste/condividi.ts   l'immagine della scheda da condividere (1080×1350)
src/viste/filtri.ts      filtri, scelte rapide e ordinamenti della Collezione (da js/collezione.js e js/dati.js)
src/viste/osare.ts       «Se vuoi osare, con…»: la ricetta di layering in Consigliami (da js/consigliami.js)
src/componenti/          Guscio, Icone, Piedistallo (con la boccetta presa in mano), Apertura (la vetrina che si apre),
                         Ingresso (la prima schermata di chi non è entrato) e ModuloAccesso (entra / registrati),
                         VersioneNuova, Avvisi, Ruota (degli accordi), Righe (sezioni, classifiche),
                         Tessera (profumo che porta alla teca), pezzi comuni (Boccetta, Mini, meno movimento),
                         dalPonte (le letture dal ponte delle vetrine degli altri)
src/pagine/              Collezione, Scheda, Consigliami, Diario, Numeri, Layering, Guida, Acquisti, Confronta,
                         Vetrine (e la vetrina di un altro), Impostazioni, Altro, Segnaposto (pagina non trovata)
src/stile/               token.css (tutti i colori, chiaro e scuro), base, collezione, scheda, consigliami, diario,
                         viste, rifiniture (vetrina, luce sul vetro, esame, avviso, cassetto), pagine
```

- **Caratteri**: Cormorant Garamond e Jost sono dentro l'app (pacchetti `@fontsource`, solo l'alfabeto
  latino), così funzionano anche senza rete e senza chiedere nulla a Google.
- **Tema**: tutti i colori sono variabili in `src/stile/token.css`; lo scuro cambia solo i valori e segue
  l'iPhone (`prefers-color-scheme`). Nessun interruttore salvato.
- **Movimento**: chi ha chiesto meno movimento (`prefers-reduced-motion`) non vede la vetrina che si apre,
  cadute, voli, inclinazioni, riflessi, ondeggiamenti né barre che si allungano.

## Le foto delle boccette

Le 41 foto in `public/img/` sono scontornate (webp con trasparenza, ritagliate sulla boccetta, non
ridimensionate) partendo da quelle col fondo dell'app di prima, in `img/` alla radice del repo, che non si
toccano. Le rifà `strumenti/scontorna.py` (serve Python 3 con numpy, Pillow e opencv-python):

```bash
python app/strumenti/scontorna.py img app/public/img                         # tutte
python app/strumenti/scontorna.py img app/public/img nasomatto-black-afgano  # solo alcune (nome senza .webp)
```

Due modi:
- **netto** (quasi tutte): è boccetta ciò che si stacca dal bianco di almeno 20 livelli su 255, con un bordo
  semitrasparente. Pulito sulle boccette scure o colorate, ma perde vetro chiaro, tappi argento ed etichette
  bianche che toccano il fondo.
- **fine** (le foto elencate in `FINI` nello script, con le loro eccezioni): soglia appena sopra il rumore del
  fondo e contorni ricuciti, poi un pixel di bordo rifilato. Prende il vetro chiaro; non va bene per tutte perché
  attorno alle boccette scure lascerebbe una riga chiara (disturbi di compressione dell'originale). Dove il vetro
  tocca il bianco senza nessun contorno (Nasomatto Black Afgano) c'è una **maschera a mano**: un poligono sulle
  coordinate dell'originale, preso dai bordi del vetro, senza inventare parti.

Rifare tutte le foto lascia identiche quelle in modo netto. Dopo ogni cambio, guardarle a occhio su fondo chiaro
e scuro (Collezione, Scheda, vista da vicino), in tema chiaro e scuro. Il 2026-11-14 sono state rifatte in modo
fine Nasomatto Black Afgano, Xerjoff Naxos, Lalique Ombre Noire, Armaf Club de Nuit Sillage, Lattafa Atlas,
L'Erbolario Ginepro Nero, YSL Muse e Acqua di Giò EDP.

## Dati

All'avvio l'app mostra subito l'ultima copia salvata sul telefono (`localStorage`, chiave
`sillage-app:dati`) e intanto chiede i dati al ponte (al massimo 8 secondi). Se il ponte risponde, la
copia si aggiorna; se no, si resta sulla copia. In più il service worker tiene l'ultima risposta del ponte.
All'avvio a freddo, senza copia e col ponte che non risponde, l'app legge la copia notturna del repo
(`data/*.json`, copiata in `public/data/` prima di ogni build da `strumenti/copia-dati.mjs` e tenuta in cache
dal service worker), come faceva l'app di prima. Con la chiave la lettura è `POST azione=leggi` (chiave nel
corpo) e porta anche il diario; senza, `GET` e niente diario (`diarioChiuso`).

## Pagine

Router a cancelletto (`#/…`): funziona su qualunque hosting e senza rete, il server non deve sapere nulla.
Barra in basso con cinque voci: Collezione, Consigliami, Diario, Numeri, Altro.

| indirizzo | pagina | stato |
|---|---|---|
| `#/` | **Collezione**: Boccette / Campioni, cerca, famiglie e scelte rapide (Adesso, Ufficio, Appuntamento, Sera, Cloni, Novità) con i contatori, i filtri attivi da togliere, il cassetto dei filtri (stagione, occasione, famiglia, momento, provenienza, note olfattive) e degli ordinamenti, «Anche tra i campioni», mensole con i cartellini; col mouse le nicchie si inclinano e un riflesso le segue, col dito un riflesso passa una volta | fatta |
| `#/?v=campioni&f=verde,ufficio&n=vetiver&o=rating&q=…` | filtri (`f`), note (`n`), ordine (`o`) e ricerca stanno nell'indirizzo: «indietro» li ritrova, una nuova apertura riparte pulita. Il cassetto (`cassetto=1`) si chiude anche con «indietro», senza perdere le scelte | fatta |
| `#/?vedi=24` | arrivo da un'altra pagina: vetrina giusta, filtri tolti, si scorre alla teca (chiusa) e si illumina | fatta |
| `#/profumo/24` | **Scheda**: piedistallo col faretto, voto/durata/sillage, «Lo metto oggi» (con occasione e momento, e il link all'appunto), piramide, accordi con la forza, stagioni (quella di ora in ottone), giorno e sera, uso, note personali, «Su di te» (dagli appunti), racconto, parentele (copia di…), somiglia a, layering, formato e residuo da toccare, link a Fragrantica, «Confronta con…», «Condividi la scheda». La boccetta vola dalla teca al piedistallo (View Transition), ci ondeggia come presa in mano e, toccata, si guarda da vicino | fatta |
| `#/aggiungi` | **Aggiungi profumo**: cerca per nome tra le schede di Sillage (se c'è: boccetta o campione, ml, note, «Metti in vetrina»); se no, la cartolina di Fragrantica ▸ dati da controllare (in ambra quello che non torna) ▸ foto ▸ piramide facoltativa ▸ Salva. Vedi «Aggiungi profumo» | fatta |
| `#/altro` | **Altro**: indice di Aggiungi profumo, Layering, Guida, Acquisti, Confronta, Le vetrine, Impostazioni, e da dove arrivano i dati | fatta |
| `#/vetrine`, `#/vetrina/p…` | **Le vetrine**: le altre persone di Sillage e la collezione di ciascuna, in sola lettura | fatta (account, tappa 4) |
| `#/consigliami?quando=domani&occ=ufficio` | **Consigliami**: oggi, stasera o domani e l'occasione (nell'indirizzo); ora, aria, cielo e stagione; la prima scelta sul piedistallo con i motivi (I., II.… a favore, «ma» contro), «Se vuoi osare, con…» (la ricetta di layering, con «Lo faccio») e «Lo metto oggi»; quattro alternative coi tre motivi più forti e «Lo metto»; le ore sulla pelle; «Mai indossati, se vuoi riscoprirli»; il pulsante per il meteo di dove sei | fatta (tappe 2 e 3) |
| `#/diario?mese=2026-11&giorno=2026-11-12` | **Diario**: il mese con le boccette nei giorni, il giorno scelto (aggiungi un profumo o un layering, togli, occasione e momento, appunto con voto), la cronologia | fatta (tappa 3) |
| `#/diario?vista=settimana` | **La settimana**: un suggerimento al giorno da lunedì a domenica, con l'occasione da cambiare e «Lo metto» per oggi; i giorni passati dicono cosa hai messo | fatta (tappa 3) |
| (qualunque indirizzo, senza account) | **L'ingresso**: la vetrina chiusa con il cartoncino «Entra con il tuo account di CheMetto» (email, password) e «Non hai un account? Registrati»; per chi è entrato ma non ha ancora una vetrina, «Ancora un passo» (il nome in Sillage). Entrando, le ante si aprono sulla Collezione | fatta (accesso iniziale) |
| `#/impostazioni` | **Impostazioni**: il tuo account (entra, registrati, collega al diario, esci), la posizione per il meteo, da dove arrivano i dati | fatta (tappa 3; account dalla tappa 3 degli account) |
| `#/numeri` | **Numeri**: boccette, campioni, marchi, rating e durata medi, mappa olfattiva (anche coi campioni), stagione e famiglia, occasioni d'uso, accordi più presenti, classifiche per rating e durata, cloni e originali, storico delle aggiunte, il diario (questo mese, le più indossate, da riprendere, per stagione, rotazione del mese), profilo Fragrantica | fatta (tappa 4) |
| `#/layering?tipo=app&ricetta=4` | **Layering**: le quattro regole, i filtri per tipo, le ricette da aprire (sopra e sotto con le dosi, come si fa, risultato, perché, quando) e «Lo faccio oggi» | fatta (tappa 4) |
| `#/guida?occ=ufficio` | **Guida**: le sette occasioni; per ognuna le boccette per stagione (quella in corso prima), con moderazione, in ufficio anche le altre (1 spray), e i campioni | fatta (tappa 4) |
| `#/acquisti` | **Acquisti**: le boccette che stanno finendo, lacune aperte con le idee (✓ se già in casa), le lacune chiuse, il profilo Fragrantica | fatta (tappa 4) |
| `#/confronta?ids=3,24,7` | **Confronta**: due o tre profumi affiancati, cosa hanno in comune, la ruota degli accordi, profilo, accordi e note, quando indossarli; si scelgono qui, dalla Collezione («Confronta» e poi si toccano le teche) o dalla Scheda («Confronta con…») | fatta (tappa 4) |

Da ogni altra pagina (Consigliami, Diario, Numeri, Guida, Layering, Acquisti, Confronta, e le righe «Parentele» e
«Somiglia a» della Scheda) un profumo porta alla Collezione, sulla sua teca chiusa che si illumina (`#/?vedi=ID`,
regola dell'utente): aprirla resta una scelta. «Indietro» riporta alla pagina di partenza, con le sue scelte.

«Collezione» in alto nella scheda: se si arriva dalla vetrina torna indietro (filtri e punto ritrovati); se la
scheda è stata aperta da un link porta alla vetrina con `?vedi=`.

## Aggiungi profumo

Altro ▸ Aggiungi profumo (anche dalla vetrina vuota). Scelte dell'utente (2026-11-14/16): un solo modo per
aggiungere; il profumo va nella vetrina di chi lo aggiunge e la scheda nell'anagrafica comune, subito; i dati dalla
**cartolina** di Fragrantica (app Fragrantica ▸ scheda ▸ Condividi ▸ salva l'immagine). Disegno approvato
dall'utente il 2026-11-16 (tela «Aggiungi profumo · anteprima»).

1. **Cerca**: le schede di tutti (`azione=catalogo`). Se il profumo c'è già: «Già nella tua vetrina», oppure
   «Prendi» ▸ boccetta o campione, ml, note ▸ «Metti in vetrina» (nessuna lettura). Se no: «Profumo nuovo».
2. **La cartolina** scelta dal rullino: **le barre le misura il telefono** (`src/cartolina/misura.ts`, su canvas,
   niente IA): accordi con la forza, stagioni riportate a 100, giorno/notte. Ritaglia anche la boccetta e le toglie lo
   sfondo (`boccetta.ts`). **Le scritte** (nome, marchio, genere, voto, voti, durata, scia, nomi di accordi e note) le
   legge **anche loro il telefono**, gratis: un lettore di testo, Tesseract (`tesseract.js`, `src/cartolina/lettore.ts`),
   su zone ritagliate e ripulite (`scritte.ts`: ancorate alla prima barra degli accordi, perché la cartolina scende
   quando il nome va a capo; la testata riga per riga; dentro le barre conta come scritta solo ciò che si stacca dal
   colore della barra; il voto senza le stelle gialle). Poi si corregge con le parole note: accordi di Fragrantica e
   del catalogo, note e marchi del catalogo («Khadlaj Perfumes» ▸ «Khadlaj»; un marchio solo simile non si tocca), scia
   al maschile come nel catalogo; dal titolo si tolgono il marchio e la concentrazione («Eros Eau de Parfum» ▸ «Eros»,
   EDP). Il lettore **si scarica solo al primo uso** (da cdn.jsdelivr.net: il programma ~3 MB e l'italiano ~3 MB;
   il pezzo `assets/lettore-*.js` è fuori dalla cache dell'installazione, il service worker tiene i file scaricati
   in `sillage-lettore`): dopo legge anche senza rete. Se non riesce (al primo uso senza rete) la pagina lo dice, si
   scrive a mano e c'è «Riprova». Nessuna AI a pagamento, nessuna chiave. «Non ho la cartolina» porta ai campi vuoti.
3. **Dati da controllare**, tutti modificabili. In ambra: la concentrazione (non è nella cartolina), le stagioni che
   non fanno 100, il voto fuori da 1-5, accordi misurati e nomi letti in numero diverso, e i dubbi della misura (una
   stagione sotto il 10%: la cartolina la disegna sempre al minimo, «potrebbe essere meno»). Proposti e da cambiare:
   occasioni (dai 3 profumi più simili della propria vetrina, per accordi; se è vuota, regole semplici), carattere
   (Fresco/Aromatico/Caldo = colore blu/verde/rosso), e in silenzio stagione (`ai` se autunno+inverno ≥ 60, `pe` se
   primavera+estate ≥ 60) e momento (giorno ≥ 64, sera ≤ 44): tarate sui 41 profumi.
4. **Foto**: di partenza quella ritagliata dalla cartolina; «Una tua foto» la scontorna nel telefono con
   `@imgly/background-removal` (come CheMetto), che si scarica **solo al primo uso** (~44 MB dal server di img.ly; il
   pezzo di codice `assets/scontorno-*.js` è fuori dalla cache dell'installazione). Va al ponte come webp (PNG dove
   Safari non sa fare webp) alto al più 600 px; la serve `GET /api/foto/<id>` e la tiene il service worker.
5. **Piramide** facoltativa da una schermata, letta dallo stesso lettore. Prima `preparaSchermata` porta lo sfondo
   a bianco (anche in tema scuro) e **cancella le icone delle note** (macchie più alte di una riga di testo: se no il
   lettore ci vede lettere); poi `capisciPiramide`: i titoli dicono il livello («Note di apertura / centrali / di
   base» come sul sito in italiano, o «testa / cuore / fondo», Top / Middle / Base), le righe dei titoli non sono note,
   e sulla stessa riga **ogni parola va con l'icona più vicina sopra di lei** (il nome sta centrato sotto la sua), così
   «Muschio Vegetale» e «Patchouli» restano due note anche se vicine; un nome lungo su due righe si riunisce. Le note
   si tolgono e si aggiungono a mano. Provata il 2026-11-17 sulla schermata di Danilo (tema scuro; anche invertita e
   rimpicciolita): 12 note su 12 al loro livello. Per provarne altre: `node strumenti/tara-piramide.mjs <schermata o
   cartella>` (le schermate restano fuori da git).
6. **Salva**: `azione=aggiungi` (ponte/LEGGIMI.md). **Senza rete** va nella coda `sillage-app:aggiunte-coda` (con la
   foto), la Collezione lo dice («aspetta la rete») e parte da sola al ritorno della rete, all'avvio o tornando
   all'app; il codice `cliente` evita i doppioni.

Un profumo senza stagioni (scritto a mano) **Consigliami lo salta** (`haStagioni` in `consiglio.ts`; per Danilo
cambia niente: prima/dopo 224 casi, 0 differenze); Numeri, filtri e scheda reggono i campi vuoti; senza foto la
boccetta è una sagoma di pietra (`.senza-foto`). Niente campo «stato» (rifiutato).

**La misura, tarata** sulle 38 cartoline di Danilo (`C:\Projects\Sillage\SchedeProfumiFragrantica`, fuori da git)
contro il database: `node strumenti/tara-cartoline.mjs [cartella] [--dettagli]`. Il 2026-11-16: accordi 189 su 190
entro un punto (uno a 2), giorno/notte entro 2, stagioni quasi tutte entro 2-3 (dove il database viene da un'altra
fonte, come La Yuqawam, la cartolina dice altro; sotto il 10% vedi sopra). Le barre si cercano davvero (anche
quelle chiarissime, per il passo fisso), e la cartolina da 1200 px è quella da 1092 ingrandita.

**La lettura delle scritte, tarata** sulle stesse 38 cartoline col lettore vero: `node strumenti/tara-scritte.mjs`
(la prima volta scarica l'italiano). Il 2026-11-17: genere, voto, durata, scia e concentrazione 38 su 38, accordi
189 su 190, note del catalogo ritrovate 220 su 225, marchio 34 e nome 32 su 38; quasi tutti gli scarti sono
differenze vere fra cartolina e catalogo (voti più recenti nel catalogo, «Al Haramain Perfumes», la cartolina di
Kilian per il clone di DoDo's), i veri errori sono lettere scambiate in un titolo («NJ 1861» per «XJ 1861»). In un
browser vero: la prima lettura ~3 s (col download), le altre ~2 s.

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
  riscoprirli» e la frase «è un campione: buona occasione per provarlo».
- «Se vuoi osare, con…» (`src/viste/osare.ts`): la ricetta di layering col primo consiglio, la più adatta
  all'occasione e alla stagione; non tocca la classifica e il prima/dopo la confronta con l'app di oggi.

## Diario, account, chiave e residuo

- **L'ingresso** (16 novembre 2026, scelta dell'utente: «la prima pagina deve essere una pagina di login»):
  chi apre Sillage senza account (né chiave di prima) vede solo `src/componenti/Ingresso.tsx`, a qualunque
  indirizzo: la vetrina chiusa dell'apertura, con un cartoncino d'avorio «Entra con il tuo account di CheMetto»
  e, sotto, «Non hai un account? Registrati». Dietro non c'è niente (né pagine né barra), e l'app **non chiede
  niente al ponte**: niente `GET /api`, che darebbe la vetrina di Danilo. Prima degli account era così che chi
  apriva il sito si trovava la collezione di Danilo. Entrando le ante si aprono sulla propria Collezione (`#/`).
  Senza rete il cartoncino dice «Serve la rete per entrare» e il bottone resta spento. Chi è già entrato apre
  diretto la sua vetrina, anche senza rete, come prima. L'ingresso copre anche chi è entrato ma il ponte non
  riconosce (`chi` senza `persona`): un account CheMetto senza vetrina sceglie il nome («Ancora un passo»,
  `azione=registrati`), un accesso scaduto o una chiave sbagliata rientrano. In quei casi il ponte risponde con la
  vetrina di Danilo e `src/dati.tsx` la scarta, senza tenerne copia; la copia sul telefono vale solo se è di una
  persona riconosciuta (`sillage-app:persona`), e il ripiego su `data/*.json` solo per Danilo. Le collezioni di
  tutti restano visibili, a chi è entrato, da Altro ▸ Le vetrine (scelta dell'utente).
- **L'account** (tappa 3): quello di CheMetto, email e password, in Altro ▸ Impostazioni ▸ Il tuo account
  (`src/accesso.ts`, senza librerie: entrare, rinnovare, uscire con tre richieste a Supabase Auth). La sessione
  resta nel `localStorage` di questo telefono (`sillage-app:accesso`) finché non si esce: dice chi sei, non
  dove eri. Il token dura un'ora e si rinnova da solo quando serve; senza rete resta quello che c'è. Viaggia nel
  corpo della richiesta (`accesso=…`), come la chiave. La prima volta Danilo lo collega al suo diario con
  «Collega l'account al mio diario», sul telefono che ha già la chiave (`azione=collega`, `ponte/LEGGIMI.md`);
  da lì diario e residuo funzionano col solo account. Il ponte dice chi ha riconosciuto (`chi`, in `useDati`).
- **Le altre persone** (tappa 4, registrazione libera come CheMetto): Impostazioni ▸ Il tuo account ▸ Registrati
  (nome in Sillage, email, password di almeno 8 caratteri), oppure Entra con un account CheMetto e «Crea la mia
  vetrina». Si arriva alla **vetrina vuota** (Collezione): dice solo che i profumi si potranno aggiungere da
  Altro ▸ Aggiungi profumo, l'unico modo per aggiungere (scelta dell'utente: «Ce l'ho» e la pagina del catalogo
  sono stati tolti; «Aggiungi profumo» non c'è ancora). «Togli dalla vetrina» sta in fondo alla scheda.
  **Le vetrine degli altri** (Altro ▸ Le vetrine, `#/vetrine`, `#/vetrina/<persona>`): solo la collezione, in
  sola lettura. **Uscendo** il telefono scorda la vetrina e il diario
  di chi c'era (`scordaCopie`); prima devono partire le scritture in coda. Il ripiego della copia notturna del
  repo, senza rete, vale solo per Danilo.
- **La chiave** (tappa 5): l'app non la chiede più, si entra solo con l'account. Il telefono che ha ancora la
  chiave di prima (`sillage-app:chiave`) continua a mandarla, nel corpo della richiesta, finché non entra con
  l'account collegato: da lì, appena la coda del diario è vuota, l'app la toglie da sola (`scordaChiave` in
  `src/ponte.ts`), e Impostazioni smette di dirlo. La chiave resta solo di servizio (`ponte/LEGGIMI.md`).
  Senza account (o se il ponte non lo riconosce) si vede l'ingresso; quello che è rimasto da segnare
  resta in coda sul telefono e parte appena il ponte sa chi sei (i rifiuti «chiave…» e «accesso…» lasciano la
  voce in coda).
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

`npm run build` controlla i tipi e costruisce. `.github/workflows/prova.yml`, a ogni push: la sintassi del
ponte e dell'app di prima, la build come la fa Cloudflare, i quattro confronti qui sotto e la misura delle
cartoline sintetiche, poi tre giri in Chromium col ponte finto (`prove/server-finto.mjs`, nessuna richiesta al
ponte pubblicato né ad Anthropic):

- `prove/prova-nuova.mjs`: l'ingresso senza account (dice CheMetto, offre «Registrati», nessuna vetrina dietro,
  nessuna richiesta al ponte) e con una chiave che il ponte non riconosce (ancora l'ingresso, nessuna copia); poi, con
  la chiave di prova, Collezione con 41 profumi, Scheda, Consigliami, una voce messa senza rete (resta in
  coda, si vede, parte una volta sola al ritorno), il Diario, la riapertura senza rete, l'avvio a freddo col
  ponte giù (data/*.json);
- `prove/prova-aggiunta.mjs`: Aggiungi profumo (vedi sotto);
- `prove/prova-passaggio.mjs`: il passaggio dall'app di prima, alla radice e in `/Sillage/` (vedi «Il passaggio»).

In locale, dalla radice del repo (serve Playwright: `npm install --no-save playwright@1` e
`npx playwright install chromium`):

```bash
cd app
VITE_PONTE=http://127.0.0.1:8800/api VITE_LETTORE=finto npm run build
cd ..
node prove/prova-nuova.mjs
node prove/prova-passaggio.mjs
```

**Verifica di filtri, scelte rapide e ordinamenti** della Collezione:

```bash
cd app
node strumenti/verifica-filtri.mjs            # profumi da data/*.json
node strumenti/verifica-filtri.mjs --ponte    # profumi letti adesso dal ponte (sola lettura)
```

Per ogni combinazione (2 vetrine × 8 ordinamenti × 38 insiemi di filtri, note e ricerche, a mezzogiorno e la sera
per «Adatti adesso») chiama `disegna()` dell'app di oggi e ne legge l'ordine delle teche, quante «Anche tra i
campioni» e i contatori delle scelte rapide; poi chiede lo stesso alla nuova. 1600 controlli, nessuna differenza.

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

(il secondo dalla radice del repo). La chiave di prova è `prova` (si mette a mano: `localStorage.setItem("sillage-app:chiave", "prova")`, oppure si entra con il Supabase finto); Impostazioni ▸ I dati dice
«ponte locale di prova». Prima di pubblicare si ricostruisce senza `VITE_PONTE`. Il database locale sta in
`.wrangler/` (fuori da git).

**Provare gli account** (nessuna richiesta al progetto Supabase vero): in più un Supabase finto,

```bash
cd app
node strumenti/supabase-finto.mjs                     # porta 8898; password di ogni email: prova1234
```

il ponte locale con `--var SUPABASE_URL:http://127.0.0.1:8898` e l'app costruita anche con
`VITE_SUPABASE_URL=http://127.0.0.1:8898`. Poi `node strumenti/prova-accesso.mjs` (31 controlli, su un database
locale nuovo): collegamento solo con chiave e accesso insieme, diario e residuo col solo accesso, token scaduti,
falsi o di un altro progetto rifiutati, catalogo solo con la chiave. Nell'app: Impostazioni ▸ Il tuo account ▸
Entra, poi «Collega l'account al mio diario» (con la chiave `prova` salvata), poi si può togliere la chiave.

Poi `node strumenti/prova-persone.mjs` (67 controlli, **obbligatoria a ogni cambio di ponte o account**): una
seconda persona si registra, ha la vetrina vuota, legge il catalogo comune e aggiunge e toglie schede dal ponte, scrive diario e residuo
suoi; non legge né tocca niente di Danilo; vede la sua vetrina senza note personali né residuo; non può fare i
lavori di Claude; la vetrina pubblica di Danilo resta identica. In più il profumo per CheMetto (`azione=consiglio`):
chi non è in Sillage (o ha un accesso falso) riceve `nessuno` senza errore, chi non ha profumi nessun consiglio,
ognuno solo i suoi profumi e il suo «Oggi ho messo»; un «Oggi ho messo» segnato nell'app di Sillage va nella
Bacheca di CheMetto (il Supabase finto registra `segna_profumo` e `togli_profumo`; ponte locale con
`--var CHEMETTO_CHIAVE_PUBBLICA:finta`), quelli di CheMetto (`da=chemetto`), della chiave o di giorni lontani no. Nell'app: Impostazioni ▸ Registrati (password
di ogni email nel Supabase finto: `prova1234`), vetrina vuota, Altro ▸ Le vetrine, «Togli dalla vetrina».
(Per riempire la vetrina della persona di prova: Altro ▸ Aggiungi profumo.) Le pagine con la vetrina vuota (Consigliami, Diario, Numeri, Guida, Layering, Acquisti, Confronta)
devono aprirsi senza errori.

**Aggiungi profumo**: `node strumenti/prova-cartolina.mjs` (83 controlli sulla misura, sul ritaglio e su come si
capiscono le scritte lette; cartoline sintetiche disegnate da `strumenti/cartolina-finta.mjs`: nessuna immagine di
Fragrantica nel repo) e `node prove/prova-aggiunta.mjs` dalla radice (nel browser, col ponte finto e l'app costruita
con **`VITE_LETTORE=finto`**, che risponde scritte fisse senza scaricare niente: ricerca, cartolina, ambra, foto,
piramide, Salva, il profumo nuovo in Collezione, Scheda, Numeri e Consigliami, il lettore che non riesce e «Riprova»,
senza rete in coda e un invio solo). Sul ponte locale: `node strumenti/prova-aggiungi.mjs` (scheda comune + vetrina
propria e non degli altri, id dal ponte, foto servita, reinvio senza doppioni, scheda già esistente per nome o per
link, `leggi-cartolina` che non c'è più). Se sulla 8787 gira già un altro ponte locale: `--port 8788` e
`PONTE_LOCALE=http://127.0.0.1:8788/api` davanti alle prove (vale anche per `prova-accesso` e `prova-persone`).
Il lettore vero si prova solo a mano: `tara-scritte.mjs`, o una build senza `VITE_LETTORE` (sempre col ponte finto).

**Prima/dopo di Consigliami** (obbligatorio a ogni modifica del punteggio, regola dell'utente):

```bash
cd app
node strumenti/prima-dopo.mjs            # profumi da data/profumi.json
node strumenti/prima-dopo.mjs --ponte    # profumi letti adesso dal ponte
```

Carica `js/dati.js`, `js/collezione.js` e `js/consigliami.js` dell'app di oggi in una sandbox, e
`src/consiglio.ts` compilato al volo; con un orologio finto e un meteo finto (caldo umido d'estate, pioggia
in primavera e autunno, tramonti veri per la stagione) confronta ordine, punteggio e motivi di ogni profumo
in 224 casi: 4 date × mattina e sera × 7 occasioni × oggi/domani × con e senza meteo, e con loro la ricetta
«Se vuoi osare, con…» proposta col primo consiglio (presente in 189 casi). Esce con errore se trova differenze. Unica differenza voluta: il voto nei motivi con la virgola («★ 4,3»).

**Il profumo per l'outfit di CheMetto** usa lo stesso `src/consiglio.ts` dal ponte (`ponte/outfit.ts`): una
modifica al punteggio cambia anche quello. `node strumenti/prova-outfit.mjs` (gira anche su GitHub) controlla che
con un outfit neutro la classifica sia identica a Consigliami (1656 casi, tutte le situazioni di CheMetto), che i
colori dell'outfit spostino un profumo solo a pari merito (meno di 0,25 punti) e le ore col fuso del telefono.

## Inventario: l'app di oggi e la nuova

Per la tappa 5 (il passaggio). «c'è» = stessa funzione, stesse regole; «cambiata» = c'è, ma diversa apposta, con
il perché. Non resta nessun «manca».

### Collezione e scheda

| funzione dell'app di oggi | nella nuova |
|---|---|
| Boccette e campioni in due vetrine, numero di catalogo per vetrina | c'è |
| Ricerca senza accenti (nome, marca, note, famiglia, accordi, dupe) | c'è |
| Scelte rapide Adesso, Ufficio, Appuntamento, Sera, Cloni, Novità con i contatori | c'è (verifica-filtri) |
| Cassetto dei filtri (stagione, occasione, famiglia, momento, provenienza, note olfattive) con i contatori | c'è (verifica-filtri) |
| Ordinamenti (nome, marchio, rating, famiglia, stagione, longevità, numero, aggiunti di recente) | c'è (verifica-filtri) |
| Ordine di partenza: nome A → Z | cambiata: numero di catalogo, perché è l'ordine della tavola dell'anteprima scelta dall'utente (le mensole numerate); gli altri otto ordini restano a un tocco nel cassetto |
| Famiglie nel cassetto | cambiata: anche come pillole sotto la ricerca, perché l'anteprima scelta le mostra lì; nel cassetto restano |
| «Anche tra i campioni» sotto le boccette filtrate | c'è |
| Filtri ricordati finché l'app è aperta | cambiata: stanno nell'indirizzo (`#/?f=…&n=…&o=…`), perché la regola «nessuna memoria tra un'apertura e l'altra» e il tasto indietro li vogliono lì; durante l'uso si comportano uguali |
| Teca che si apre sul posto (o nel pannello a destra su schermo largo) | cambiata: la scheda è una pagina (`#/profumo/ID`), perché il piano delle pagine approvato dall'utente dà alla scheda un indirizzo proprio |
| Saltando a un profumo da un'altra sezione la teca resta chiusa, ancorata e illuminata | c'è, da tutte le pagine (`#/?vedi=ID`) |
| Piramide, accordi con la forza, stagioni, giorno/sera, uso, note personali, racconto | c'è |
| Ruota degli accordi nella scheda | cambiata: nella scheda gli accordi sono righe sottili misurate con la forza, come nella tavola dell'anteprima scelta; la ruota c'è in Confronta |
| Icone delle note (emoji) | cambiata: tolte, perché lo stile Boutique non usa emoji; le note restano scritte |
| Parentele (originale e cloni), Somiglia a, Layering del profumo | c'è |
| «Lo metto oggi», appunto, occasione e momento, «Su di te», residuo a sette tacche | c'è |
| Condividi la scheda (immagine 1080×1350) | c'è, nei colori della Boutique in penombra |
| Apri su Fragrantica | c'è |
| Vassoio del confronto (+ su ogni teca, fino a tre) | cambiata: «Confronta» nella Collezione e poi si toccano le teche, perché un + su ogni cartellino ingombrava le mensole dell'anteprima; il vassoio in basso c'è, e in più «Confronta con…» dalla scheda |

### Altre pagine

| funzione | nella nuova |
|---|---|
| Consigliami (oggi e domani, occasioni, primo consiglio e alternative, motivi, meteo ora per ora, «Lo metto», mai indossati, «Se vuoi osare, con…») | c'è, stesso punteggio e stessa ricetta (prima/dopo) |
| Consigliami come foglio sopra la collezione | cambiata: è una pagina della barra in basso, perché il piano delle pagine approvato lo vuole; in più «Stasera» |
| «Scheda» dal primo consiglio | cambiata nel nome: «Trovalo in collezione», perché porta alla teca illuminata (la regola dell'utente) |
| Diario: mese, giorno, aggiungi un profumo o un layering, togli, appunto, cronologia; piano della settimana | c'è |
| Chiave chiesta dal Diario con un prompt | cambiata: si inserisce in Altro ▸ Impostazioni, perché il prompt del browser sull'iPhone installato è scomodo e una pagina dice anche se la chiave è giusta |
| Numeri, mappa olfattiva, storico con «Le N novità →», diario nei Numeri | c'è (verifica-viste) |
| Layering, Guida, Acquisti, Confronto, profilo Fragrantica | c'è (verifica-viste) |
| Barra in basso: Collezione, Diario, Layering, Guida, Acquisti, Numeri | cambiata: Collezione, Consigliami, Diario, Numeri, Altro (con Layering, Guida, Acquisti, Confronta, Impostazioni), come nel piano delle pagine approvato |

### Rifiniture

| funzione | nella nuova |
|---|---|
| Vetrina di apertura (le due ante all'avvio, da mezzo secondo a due e mezzo) | c'è, con ante di travertino e filo d'ottone |
| Schermate d'avvio dell'iPhone (`img/avvio/`) | c'è (`public/img/avvio/`, stesse dieci misure), uguali alla vetrina chiusa; in più la versione scura |
| Boccetta presa in mano: si stacca, si posa in grande e ondeggia | cambiata nel gesto: la boccetta vola dalla teca al piedistallo della scheda (View Transition), lì ondeggia; toccandola si guarda da vicino, a tutto schermo, sotto il faretto. Perché la teca non si apre più sul posto ma è una pagina |
| Tilt delle nicchie col mouse e riflesso che segue | c'è |
| Riflesso che attraversa il vetro una volta | c'è: col dito su una teca, e all'arrivo nella scheda |
| View Transitions | c'è: teca → scheda e ritorno |
| Boccette che si posano sulla mensola, barre che si allungano, faretto che si accende | c'è (prima apertura della vetrina) |
| Scheletro durante l'attesa | cambiata: «Apro la vetrina…» sotto la vetrina d'apertura, perché la vetrina copre già l'attesa |
| Pillola che scorre sotto la voce attiva della barra | cambiata: filo d'ottone sopra la voce attiva, come nella tavola dell'anteprima scelta |
| Tasto indietro del telefono e link diretti alle sezioni | c'è: ogni pagina ha il suo indirizzo `#/…` |
| Avviso «c'è una versione nuova» con «Aggiorna» | c'è (`registerType: "prompt"`): niente ricaricamento automatico |
| App installabile e senza rete (service worker, manifest, icone) | c'è (vite-plugin-pwa) |
| Tema | cambiata: Boutique chiara e scura che segue l'iPhone, lo stile scelto dall'utente |
| Avvisi brevi in basso | c'è |
| Meno movimento per chi lo chiede | c'è: spegne vetrina, tilt, riflessi, ondeggiamento, voli |
