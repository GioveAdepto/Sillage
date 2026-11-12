# DESIGN.md — prontuario dello stile di Sillage

Riassunto di `css/sillage.css` (aspetto) e `css/transitions.css` (movimento). Serve a disegnare
una pagina nuova senza rileggere 2000 righe. I nomi sono quelli esatti del CSS. L'idea: **una
vetrina di notte** — lacca scura, vetro, fili d'ottone, luce calda dall'alto.

## Colori (`:root` in sillage.css)

C'è **solo il tema scuro**: niente tema chiaro, niente `prefers-color-scheme`. `theme-color` = `#12100d`.

| Gruppo | Variabili | Uso |
|---|---|---|
| Fondo | `--lacca` #12100d · `--noce` #1a1611 · `--noce-2` #221d16 | pagina; `--noce*` solo nel foglio filtri |
| Vetro | `--vetro` (bianco 4,5%) · `--vetro-2` (7,5%) | fondo di campi, pillole, bottoni; `-2` per hover/focus |
| Lastra | `--lastra` (sfumatura bianca 168°) | fondo di tutte le "carte": teca, tavola, ricetta, cal… |
| Filo (bordi) | `--filo` 10% · `--filo-2` 20% · `--filo-3` 34% | bordo normale → hover → focus/filo di luce |
| Ottone | `--ottone` #c8a35e · `--ottone-chiaro` #f0d9a4 · `--ottone-scuro` #a8884f · `--ottone-velo` (12%) | accento: attivo, titoli, numeri; `-velo` è il fondo degli elementi scelti |
| Luce | `--luce` #fff3d8 | testo della scelta "ora" accesa |
| Carta (testi) | `--carta` #f3ede1 · `--carta-2` #b9b0a0 · `--carta-3` #9a9081 | testo principale → secondario → etichette e note |
| Famiglie | `--acqua` #7fa8cf · `--bosco` #93b98a · `--ambra` #d9906f + `--*-velo` (13%) | le tre famiglie di vetro; `bosco` = fatto/sì, `ambra` = attenzione/togli |

Raggi: `--r` 14px (carte), `--r-s` 10px (campi, bottoni), `--r-xs` 7px (targhette); `99px` per le pillole.
Altre: `--sicuro-alto` (area sicura in alto, vedi sotto), `--altezza-strumenti` (scritta dal JS),
`--t` (tinta dell'occasione, messa inline dal JS), `--forza`, `--v`, `--freccia-x` (inline dal JS).

Colori **senza variabile** ricorrenti: `rgba(200,163,94,.24–.5)` = ottone a bordo; `#17130b` = testo
scuro su fondo ottone; `#0c0a08` = fondo della nicchia; `#b5d3ab` (bosco chiaro), `#a9c6e2`
(acqua chiaro, campioni); lilla `rgba(190,150,220,…)` / `#e2cdf5` = nota cercata. Ombre: niente
variabili; schema tipico `0 18px 40px -22px #000` (sollevata), bagliore `0 0 34px -6px rgba(255,214,146,.42)`.

## Caratteri e scala

Da Google Fonts (`index.html`): **Marcellus** (serif, solo 400) per titoli, nomi dei profumi, numeri
grandi e racconti; **Manrope** 300–600 per tutto il resto (`body` 16px, 400).

- 68px `.eroe-n` · 40px `.numero-n` · 30px `.marca-app h1`, `.intesta h2` (spaziatura .1–.14em, ottone chiaro)
- 22–26px `.nome`, `.foglio-titolo`, `.oggi-nome`, `.cal-mese` · 16–19px titoli di riga (`.ricetta-nome`, `.pila-nome`)
- 13–15px testo corrente (`.note-riga` 13.5, `.passo-testo` 13.5 → 14.5 da 720px)
- 10–12px dettagli; **`.incisa`** = etichetta incisa: 10.5px, 600, maiuscolo, spaziatura .18em, `--carta-3`
- numeri allineati: `font-variant-numeric:tabular-nums`

## Componenti (classe → scopo)

- **Teca** `.teca` (+ `.acqua/.bosco/.ambra`, `.aperta`, `.presa`, `.ancorata`, `.in-mano`): la card del profumo,
  è anche `.t-acc`. Dentro: `.corpo` > `.esposizione` = `.nicchia` (`.faretto` foto + `.specchio` riflesso + `.ripiano`) + `.cartellino`.
- **Cartellino** `.cartellino`: `.riga-marca` (`.marca`, `.catalogo`), `.nome`, `.targhette` con `.targa` (`.grado`, `.voto`, `.copia`, `.novita`, `.strati-conta`),
  `.note-chiave`/`.nota-c`, `.accordi`/`.accordo`, `.contrassegni`/`.segno` (`.stag`, `.ore`).
- **Scheda aperta** `.scheda-int` (`.t-acc-panel`) > `.scheda-int-int` (padding sempre qui, mai sul binario 0fr):
  `.esame` (boccetta in mano), `.piramide`, `.usi`/`.uso`, `.racconto`, `.residuo`/`.livello`, `.scheda-azioni`, `.simili`, `.strati`.
  Su schermo largo la stessa scheda va in `.pannello-dettaglio` sotto la riga.
- **Gemma** `.gemma` (+ famiglia): tondo di vetro colorato 28px con la lettera; tooltip `.t-tt` sotto.
- **Pillole**: `.scelta` (filtro/scelta, 36px; `.on`, `.zero`, `.oggi`), `.tolgo` (filtro attivo da togliere),
  `.occasione` (con `--t`), `.segno`, `.nota-c`. Gruppo di due schede: `.vetrine`/`.vetrina` con pillola scorrevole.
- **Bottoni**: `.btn-oro` (azione principale, ottone pieno), `.btn-ombra` (secondaria, vetro), `.btn-nudo` (solo icona),
  `.btn-indossa` (pillola ottone-velo, `.fatto` = bosco), `.btn-filtri` (`.acceso`), `.btn-affianca` (tondo 32px del confronto).
- **Collegamento** `.collegamento` (testo ottone sottolineato, è un `<button>`), `.collegamento-esterno` (link con filo sotto), `.torna` (← indietro).
- **Avviso** `.avviso` (+ `.mostra`): messaggio a comparsa in basso al centro, sopra il timone. `.aggiornamento`: barra "versione nuova".
- **Cassetto filtri** (bottom sheet): `.fondale` (`.in-scena` → display, `.aperto` → opacità) > `.foglio.t-modal` >
  `.foglio-testa` (`.maniglia`, `.foglio-titolo`, `.foglio-sotto`, `.foglio-chiudi`), `.foglio-corpo` (`.gruppo`, `.gruppo-eti`, `.ventaglio`, `.altro`), `.foglio-piede`.
- **Navigazione**: `.timone` (barra in basso, fissa) con `.remo` (`.attivo`) e una `.t-tabs-pill` d'oro che scorre;
  in alto `.testata` + `.strumenti` (sticky, solo nella Collezione) con `.riga-cerca`, `.cerca`, `.rapidi`, `.attivi`.
- **Viste** `.vista` (+ `.attiva`); `#vista-collezione` è una griglia. Intestazione di vista: `.intesta` (h2 + p).
- **Viste di lettura** (Guida, Layering, Acquisti, Numeri): carta generica `.tavola` (+ `.tavola-t`), `.mini` (boccetta piccola 40×48),
  `.tessere`/`.tessera`; Guida `.os*`; Layering `.regole`, `.ricetta.strato-ricetta`, `.coppia`, `.pila`; Acquisti `.riepilogo`,
  `.ricetta.lacuna`, `.candidato`, `.chiusi`; Numeri `.eroe`, `.numeri`/`.numero`, `.asta`/`.binario`/`.riempio`, `.cl-riga`, `.clone`, `.mappa*`, `.ruota*`.
- **Diario** `.diario-*`: `.settimana`/`.sett-*` (settimana in cima), `.diario-griglia` con `.cal`/`.cal-g` (calendario) e `.diario-giorno`/`.diario-voce`,
  `.diario-aggiungi`, `.diario-cerca`, `.diario-storia`/`.diario-riga`, `.appunto`/`.appunto-editor`/`.stelle`, `.su-di-te`, `.uso-occ`/`.uso-mom`, `.strato-slot`.
- **Confronto**: `.vassoio` (barra in basso con `.caselle`/`.casella`), `.cf-tabella` > `.cf-griglia.col2/.col3` (`.cf-testa`, `.cf-eti` fissa a sinistra, `.cf-cella`, `.cf-sez`).
- **Consigliami** `.oggi-*`: `.oggi-scelta` (prima proposta, faretto `.acceso`), `.motivi`, `.oggi-alt` (alternative), `.oggi-ore` (meteo orario),
  `.oggi-strato-riga`, `.oggi-azioni`, `.oggi-mai`, `.oggi-campione`.
- **Altro**: `.divisorio` (etichetta + filo), `.deserto`/`.cf-vuoto`/`.os-vuoto` (stato vuoto), `.ricetta` (fisarmonica con testa e corpo), `.profilo`.

## Movimento (transitions.css)

Token: durate `--duration-stagger` 40ms · `-micro` 80 · `-quick` 150 (hover, colori) · `-fast` 250 (teca, cambio vista) ·
`-medium` 350 · `-slow` 400 (comparse) · `-very-slow` 500 (luce del faretto, zoom foto). Curva di casa **`--ease-smooth-out`**
`cubic-bezier(0.22,1,0.36,1)`; anche `--ease-bounce`, distanze `--distance-*`, scale `--scale-*`, sfocature `--blur-*`.
I meccanismi copiati da transitions.dev stanno sopra; gli **adattamenti a Sillage in fondo**, nella sezione dedicata.

- `.t-acc` / `.t-acc-panel` (grid-rows 0fr→1fr, 250ms) apre teca, ricette e pannello; `.t-stagger-line--1…4` fanno entrare le righe a scaglioni.
- `.t-modal` apre il foglio filtri: sotto 900px sale dal basso (`translateY(100%)`), sopra cresce dal centro.
- `.t-badge` pallini contatore (`.bollo`, `.pallino`); `.t-icon-swap` (+ → ✓ del confronto); `.t-digit` numeri; `.t-skel` scheletro d'avvio (`#avvio`, teche fantasma).
- Entrata vista: `entra-vista` (sale 8px + sfocatura 3px, 250ms); la collezione usa `entra-vista-leggera` (senza sfocatura, costa troppo).
- Teca: `sale` (entra dal basso, ritardo 40ms per card), `ancorata` (bagliore d'ottone 2s quando ci si salta da un'altra sezione).
- **Faretto acceso**: con `.aperta`, `:focus-visible` o hover (solo dentro `@media(hover:hover)`, perché sul telefono :hover resta appiccicato).
- **Tilt**: solo la `.nicchia.t-tilt` col mouse (16°, riflesso `.t-tilt-glare`), `touch-action:auto` per non rubare lo scorrimento;
  col dito c'è il `.riflesso` che passa una volta (900ms). `will-change` acceso solo durante `.is-tilting`.
- **Boccetta presa in mano**: il JS (`vola`, 640ms) fa volare una copia `.boccetta-in-volo` dalla nicchia all'`.esame`;
  la teca diventa `.in-mano` (nicchia vuota e accesa), poi `.posata` fa ondeggiare `.esame-vetro` (`in-mano`, 6s).
- **View Transitions**: saltando a un profumo la miniatura vola alla teca con `view-transition-name: boccetta-in-volo` (500ms), il resto sfuma in 250ms.
- **Vetrina di apertura** `.apertura` (due `.anta` che ruotano, 1100ms). Foto: `img.sfuma` → `.su` (dissolvenza 400ms).
- **`prefers-reduced-motion`**: regola globale che porta tutto a 0,01ms, più blocchi dedicati (niente apertura, tilt, volo, ondeggio, entrate).

Da non rompere: vetrina di apertura, boccetta in mano, View Transitions, tilt, faretto, `ancorata`, pillola del timone,
padding dentro `.scheda-int-int`, e i casi ridotti di `prefers-reduced-motion`.

## Misure, punti di rottura, iPhone

- Telefono di base: una colonna, viste con padding `16px 14px 108px` (108 lascia spazio al timone).
- **560** (max): confronto stretto · **680**: collezione 2 colonne, `.numeri` 3 · **720**: Guida/Layering/Acquisti larghe max 560px, testi più grandi ·
  **760**: `.tavole` 2 colonne · **900**: contenitore max 1120px, foglio filtri centrato (640px), diario 2 colonne ·
  **980**: collezione 3 colonne (980 e non 1040: l'**iPad orizzontale** è 1024px); sotto 979 il pannello è più stretto.
- Altezze: campi e bottoni barra 46px, pillole 36px, `.remo` min 52px, tondi 32–36px.
- **Aree sicure** (app dalla schermata Home, `viewport-fit=cover`, barra `black-translucent`):
  `--sicuro-alto: env(safe-area-inset-top)` aggiunto a `.testata`, `.strumenti` (top), `.vista`, `.foglio`, scroll delle teche;
  `body::before` copre la barra di stato col colore di fondo. In basso `env(safe-area-inset-bottom)` su `.timone`, `.foglio-piede`, `.vassoio`, `.avviso`, `.aggiornamento`.
- Livelli (z-index): strumenti 60 · vassoio 59 · timone 100 · fascia stato 150 · fondale 200 · avviso 300 · aggiornamento 310 · volo 400 · apertura 1000.

## Ricetta: una pagina o un modulo nuovo

1. Una vista: `<section id="vista-x" class="vista">` con `.intesta` (h2 + p) in cima; contenuti in carte
   `background:var(--lastra); border:1px solid var(--filo); border-radius:var(--r)`, oppure riusa `.tavola` (+ `.tavola-t` con `.incisa`).
2. Un modulo che si apre sopra (adatto ad «Aggiungi profumo»): copia lo schema del cassetto filtri —
   `.fondale` > `.foglio.t-modal` > `.foglio-testa` / `.foglio-corpo` con `.gruppo` + `.gruppo-eti.incisa` / `.foglio-piede` con `.btn-ombra` (Annulla) + `.btn-oro` (Salva).
3. Scelte: `.scelta` (+ `.on`) per opzioni a pillola, `.uso-mom` per due-tre icone, `.uso-occ` per un `<select>` nascosto dentro una pillola, `.livello` per un livello a tacche.
4. Testi: Marcellus per titoli e nomi, Manrope per il resto, etichette con `.incisa`; colori solo dalle variabili; durate e curve dai token `--duration-*` / `--ease-smooth-out`.
5. Messaggi: `.avviso` per conferme brevi, `.collegamento` per azioni in riga, stato vuoto come `.deserto`.

**Campi di testo: cosa c'è e cosa manca.** C'è lo stile di `input[type=search]` (46px, `--vetro`, bordo `--filo-2`,
focus `--filo-3` + `--vetro-2`, testo 15px) e `.diario-cerca` (campo semplice, fondo `rgba(0,0,0,.25)`, usato anche per l'appunto).
**Manca**: stile generico per `input` text/url/number, `textarea`, etichette dei campi, testo d'aiuto, campo obbligatorio o
errore, caricamento foto. Da aggiungere seguendo `input[type=search]`, con **font-size almeno 16px** (sotto, Safari su iPhone ingrandisce la pagina al tocco).
