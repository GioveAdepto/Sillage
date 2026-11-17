# Sillage, l'app: storia del passaggio

Parti di `app/LEGGIMI.md` che servono solo per capire com'è andato il passaggio dall'app di prima (13 novembre
2026, unione `985e662`) o per tornare indietro. Non servono per lavorare sull'app di oggi.

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
