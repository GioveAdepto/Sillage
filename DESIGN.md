# DESIGN.md — prontuario dello stile di Sillage

Lo stile **Boutique di nicchia** (anteprima D, prima versione, scelta dall'utente): una maison a Milano.
Di giorno travertino e avorio, la sera la stessa pietra in penombra; fili d'ottone sottili; le boccette su
mensole e piedistalli di pietra, sotto un faretto, con la loro ombra vera. Serve a disegnare una pagina nuova
senza rileggere il CSS: i nomi sono quelli esatti di `app/src/stile/`. (Lo stile dell'app di prima, «una
vetrina di notte», è nella storia di git e in `css/`, che resta solo come riferimento.)

## Colori (`app/src/stile/token.css`)

Tutti i colori sono variabili su `:root`; **il tema scuro cambia solo i valori** (`prefers-color-scheme: dark`,
segue l'iPhone, nessun interruttore). Nessun componente diverso tra i temi. `theme-color`: #F1EBE0 / #1A1714.

| Gruppo | Chiaro | Scuro | Uso |
|---|---|---|---|
| Parete | `--parete` #F1EBE0 · `--fondo-pagina` #E9E1D3 | #1A1714 · #110F0C | fondo della pagina, con le venature (`--vena`, `--vena-2`) |
| Carta | `--avorio` #F9F6EF · `--bordo-carta` #DDD2C0 · `--cornice` #D3C7B3 | #24201B · #3A332B | cartellini, carte d'avorio, bordi |
| Testo | `--inchiostro` #2A241D · `--seppia` #55493B · `--cenere` #6E6151 | #EFE7D8 · #C7BBA8 · #A3978A | testo → secondario → etichette |
| Su inchiostro | `--su-inchiostro` · `--su-inchiostro-2` | | testo sui bottoni pieni e sulle pillole scelte |
| Ottone | `--ottone` #A88748 (filo) · `--ottone-pieno` #8A6A31 · `--ottone-testo` #6B5226 | #B8975A · #C9A866 · #D9BC7E | fili, barre attuali, numeri di catalogo |
| Famiglie | `--acqua` #3F5F78 · `--bosco` #56663F · `--ambra` #8C4F2C | #8FB2CF · #A3BC8E · #D9A07C | la gemma delle tre famiglie; bosco = giusto, ambra = attenzione |
| Fili | `--filo` 22% · `--filo-2` 11% · `--filo-3` 35% | 20 · 9 · 30% | righe sottili: normale, tenue, tacche |
| Luce | `--faro*`, `--fascio`, `--alone` | caldi e bassi | faretti, fascio del piedistallo |
| Pietra | `--mensola-*`, `--plinto-*` | | mensole e piedistallo |
| Ombre | `--ombra`, `--ombra-lunga`, `--ombra-tel`, `--bordo-luce` | più scure; `--bordo-luce` 1px | `drop-shadow` delle boccette scontornate |
| Materiali | `--metallo` (lastra d'ottone), `--metallo-filo` (filo lucido), `--ottone-chiaro/-scuro`, `--su-ottone` | stessi ottoni, un po' più caldi | ottone vero: pillola scelta, fili, bordi di mensole e piedistallo |
| Rilievo | `--rilievo-carta`, `--rilievo-basso`, `--rilievo-premuto`, `--luce-bordo`, `--ombra-morbida`, `--avorio-alto`, `--lucido` | luce sul bordo quasi spenta, ombre nere | carte staccate dalla parete, pillole e bottoni in rilievo, premuti |
| Incavo | `--incavo`, `--incavo-ombra` | pietra più scura della parete | scanalature delle barre, lastre incise delle misure |
| Piastra | `--piastra`, `--su-piastra`, `--piastra-filo`, `--piastra-incisione` | **d'ottone** col testo inciso (di giorno d'inchiostro col testo d'ottone) | bottoni pieni, «Lo metto oggi», avviso |
| Grana | `--grana` (travertino), `--grana-parete` (più tenue), `--grana-carta` | pori scuri, striature chiare | texture SVG generate (nessun file), riquadri che si ripetono |

Contrasti verificati ≥ 5:1 sui fondi; il testo inciso sulla lastra d'ottone (`--su-ottone`) resta sopra 4,5:1
anche nel punto più scuro di `--metallo`. Nessun colore scritto a mano nei componenti: si usa un token.

## Caratteri e scala

- **Cormorant Garamond** (`--f-maison`): nomi, titoli, numeri di catalogo (corsivo 500, `Nº 024`), valori grandi.
- **Jost** (`--f-dati`): dati, etichette, bottoni. Etichette «incise»: `.incisa`, 10,5px, maiuscolo, spaziatura .22em.
- Dentro l'app (`@fontsource`, solo latino): niente Google, funzionano senza rete.
- Scala tipica: marchio 36px spaziato .26em · titolo di pagina 44px · nome nella scheda 46px · nome sul
  cartellino 20px · dati 12–14px · valori delle misure 29px.

## Componenti (classe → scopo)

| Classe | Dove | Cosa |
|---|---|---|
| `.foglio` | base.css | colonna della pagina (max 1120px), margini con le aree sicure dell'iPhone |
| `.timone`, `.remo` | base.css | barra in basso, cinque voci; filo d'ottone sopra la voce attiva |
| `.chip` (`aria-pressed`) | base.css | pillole: scelta = fondo inchiostro; `.zero` = nessun risultato |
| `.btn-filo` (`.pieno`) | base.css | bottone di maison a filo; pieno con doppio bordo d'ottone |
| `.filo-ottone`, `.sez-testa` | base, scheda.css | titoli di sezione con la linea d'ottone |
| `.scaffale`, `.voce`, `.nicchia`, `.mensola`, `.cartellino` | collezione.css | le mensole: nicchia col faretto, ripiano di pietra, cartellino d'avorio appeso a un filo |
| `.scena`, `.posa`, `.piedistallo` | scheda.css | il piedistallo col faretto e il fascio (`Piedistallo.tsx`) |
| `.misure`, `.righe`, `.traccia`, `.asta` | scheda.css | righe sottili misurate: filo, tacche ogni 25, barretta d'inchiostro (ottone = attuale) |
| `.alt`, `.alt-riga`, `.mini` | scheda.css | righe con la boccetta piccola |
| `.carta-avorio`, `.scelta` | viste, consigliami.css | carte d'avorio |
| `.tessera`, `.classifica`, `.aste`, `.segmenti` | viste.css | tessere, classifiche, barre di Numeri |
| `.cassetto`, `.fondale`, `.tolgo` | rifiniture.css | cassetto dei filtri, filtri attivi |
| `.avviso`, `.aggiornamento` | diario, rifiniture.css | avvisi brevi, «versione nuova» |
| `.ingresso`, `.ingresso-carta`, `.ingresso-cambio` | rifiniture.css | l'ingresso di chi non è entrato: le ante chiuse e un cartoncino d'avorio con doppio filo d'ottone; il bottone spento resta a filo |
| `.aggiungi`, `.ag-*` | aggiungi.css | Aggiungi profumo: `.ag-passi` (cinque passi, filo d'ottone su quelli fatti, d'inchiostro su quello di ora), `.ag-rullino` (riquadro tratteggiato d'ottone per scegliere un'immagine), `.ag-campo` (etichetta incisa e riga sotto; `.dubbio` = riga **ambra** + `.ag-perche`), `.ag-righe` (le righe misurate con il valore modificabile), `.ag-scena` (piedistallo semplice), `.ag-opzione` (due scelte affiancate), `.ag-nota` (pillola da togliere), `.ag-avviso`, `.ag-in-attesa` (puntino d'ottone che pulsa: aspetta la rete) |
| (i materiali) | materiali.css | si carica per ultimo e dà spessore ai pezzi qui sopra: vedi «Materiali» |
| `.senza-foto` | aggiungi.css | un profumo senza foto: la sagoma di una boccetta di pietra |

## Materiali: pietra e ottone (`materiali.css`)

Direzione B scelta dall'utente il 20/11/2026 («meno piatta»). Gli altri fogli disegnano forma e misure;
`materiali.css` (ultimo import di `main.tsx`) aggiunge la materia, solo con i token qui sopra. Toglierlo riporta
la grafica piatta di prima.

- **Parete**: venature di prima + `--grana-parete`. **Mensole e piedistallo**: lastra di travertino con
  `--grana`, la luce del faretto sul piano, il bordo d'ottone lucido (luce sopra, `--metallo-filo`, ombra sotto).
  Le nicchie hanno i lati in penombra.
- **Cartellini** e **carte d'avorio** (`.scelta`, `.carta-avorio`): carta con la grana, cornice d'ottone interna
  (`outline` a −5/−7px), `--rilievo-carta`. Il cartellino è appeso a un occhiello d'ottone (`::before`: il
  `::after` resta alla casella del Confronta). Il bagliore d'arrivo si somma al rilievo.
- **Pillole**: avorio in rilievo; quella scelta è una targhetta `--metallo` con la scritta incisa, e una luce ci
  passa sopra una volta (`lucida`). **Bottoni**: a filo su carta in rilievo; pieni come `--piastra` con il filo
  interno (`outline`, mai sopra il fuoco della tastiera). Premuti scendono di 1px.
- **Barre** (`.traccia`, `.asta-barra`, `.cl-barra`): scanalatura `--incavo` con l'asta arrotondata dentro;
  le tacche ogni 25 restano sopra e sotto; l'asta «ora» è d'ottone.
- **Lastre incise**: le misure della scheda e di Numeri, gli strumenti di Consigliami (pietra scavata col filo
  d'ottone in cima, valori d'ottone).
- **Fili**: 2px di `--metallo-filo`; i titoli di sezione finiscono con una losanga d'ottone.
- **Barra in basso**: binario d'ottone sopra, ombra sulla pagina, losanga e bagliore sulla voce attiva.
- **Altro**: ogni voce è una lastra d'avorio, la freccia in un tondo d'ottone.

## Movimento

- Curva `--curva` cubic-bezier(.22,1,.36,1); durate 250ms (colori), 450–900ms (barre, boccette), 1200ms (ante).
- Le boccette si posano sulla mensola alla prima apertura (`posa`, a cascata); le barre si allungano (`misura`).
- Teca → scheda: View Transition della boccetta (`boccetta-ID`); nella scheda la boccetta ondeggia (`in-mano`),
  toccata si guarda da vicino (`.esame`).
- Vetrina d'apertura: due ante di travertino che ruotano verso l'esterno (`.apertura`); la schermata d'avvio
  dell'iPhone è la stessa vetrina chiusa. Per chi non è entrato le ante restano chiuse sotto il cartoncino
  d'ingresso (`.ingresso`) e si aprono quando entra; con «meno movimento» l'ingresso resta, senza animazione.
- Luce sul vetro: col mouse la nicchia si inclina (`--rx`, `--ry`) e un riflesso la segue; col dito un riflesso
  passa una volta (`.riflesso.passa`), senza toccare lo scorrimento.
- La luce che passa sulla pillola appena scelta (`lucida`, 900ms) e il bottone che scende di 1px quando si preme.
- **`prefers-reduced-motion`** spegne tutto: animazioni, voli, inclinazioni, riflessi, vetrina.

## Misure, punti di rottura, iPhone

- Quello che non torna (da controllare) è **ambra** (`--ambra`), quello che va bene **bosco** (`--bosco`).
- Margini 20px (`--margine`); barra in basso 64px + area sicura.
- 600px: le mensole passano da 2 colonne a quante ne stanno (min 184px). 960px: Scheda, Consigliami, Diario e
  Numeri su due colonne.
- Prove a 390px (iPhone) e 1440px, in chiaro e in scuro: nessuno scorrimento orizzontale.

## Ricetta: una pagina nuova

1. Un file in `app/src/pagine/`, un indirizzo in `app/src/rotte.tsx` (nessuna memoria: le scelte nell'indirizzo).
2. In testa `Testata` (incisa, titolo, testo) da `componenti/Righe.tsx`; le parti in `Sezione`.
3. Profumi nominati: `Tessera` o righe con `Mini`, che portano alla teca (`#/?vedi=ID`).
4. Solo token di `token.css`; provare in chiaro e in scuro, a 390px e largo, con «meno movimento».
