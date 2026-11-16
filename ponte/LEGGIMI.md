# Il ponte: Sillage sul database

`ponte.js` è un piccolo programma su Cloudflare (un Worker) con dietro un
database (Cloudflare D1). **Il database è l'originale di tutto**: catalogo dei
profumi, layering, consigli, note, diario e residuo. Il foglio Google
`sillage-profumi` ne è una **copia da guardare**, riscritta dal ponte dopo ogni
modifica: quello che cambi a mano nel foglio viene sovrascritto.

L'app parla con il ponte come parlava con il Web App di Apps Script: stesse
richieste, stesse risposte.

## Come si cambiano i dati

- **Diario e residuo**: dall'app, come sempre.
- **Catalogo** (profumi nuovi, correzioni, layering, consigli, note): li
  prepara Claude nel repo, in `data/aggiunte.json` e `data/correzioni.json`,
  nello stesso formato di sempre, e li applica al database con

  ```bash
  node ponte/applica.mjs --prova
  node ponte/applica.mjs
  ```

  Una riga che c'è già non viene duplicata; una correzione si applica solo se
  la cella contiene ancora il valore `da`. Rilanciare non fa danni. La chiave
  si prende da `SILLAGE_CHIAVE` o dal file `.dev.vars` nella cartella del repo
  (riga `SILLAGE_CHIAVE=...`, ignorato da git).
- I decimali si scrivono semplici (`"3.78"`); l'apostrofo che serviva nel
  foglio (`"'3.78"`) viene tolto da solo.

## Come è fatto

Dalla tappa 2 degli account (ognuno con collezione e diario suoi) i dati stanno nelle **tabelle per
persona**. Per ora c'è una persona sola, `danilo`: la chiave, e chi legge senza chiave, vuol dire lui.

| tabella | cosa contiene |
|---|---|
| `persone` | chi usa Sillage: per ora solo `danilo` (curatore); `account` sarà l'id dell'account di CheMetto |
| `schede` | un profumo per riga, uguale per tutti: le colonne di Profumi che descrivono il profumo, in `dati` (JSON) |
| `possessi` | chi ha quale profumo: `tipo_possesso`, `formato_ml`, `num_flaconi`, `residuo_pct`, `note_personali`, `aggiunto`, `attivo`, `nuovo`, e `posto` (l'ordine delle righe nel catalogo) |
| `foto` | le foto dei profumi aggiunti dall'app (una riga per scheda: tipo e immagine in base64), servite da `GET /api/foto/<id>` |
| `voci` | il diario, con la colonna `persona` |
| `tab_persona` | Layering, Consigli e ConsigliVoci di ciascuno (la tab Note resta comune, in `tabelle`) |
| `stato` | `vista:<persona>` (il catalogo pronto per l'app), `ids:<persona>`, `colonne-profumi` (l'ordine delle colonne del foglio), la copia nel foglio |

Il ponte lavora ancora con le **tab del foglio**, con le stesse colonne: per leggere ricompone schede e
possessi di una persona nella tab Profumi; per scrivere (residuo, modifiche del catalogo) la divide di
nuovo. Ne ricava il JSON per l'app con le stesse regole di `apps-script/Codice.gs` e lo tiene pronto. Il
piano gratuito concede 50 operazioni per richiesta: una lettura ne usa due o tre, una scrittura meno di dieci.
Una scheda non si cancella mai (un'altra persona potrebbe averla); i possessi di una persona si riscrivono.

**Il passaggio** dalle tabelle di prima (`tabelle` con una riga per tab, `diario`) è fatto da solo, alla
prima richiesta dopo la pubblicazione della tappa 2: il ponte vede che manca `vista:danilo` e copia tutto,
diario compreso, in un colpo solo. Se arrivano più richieste insieme, solo la prima scrive. Lo fa solo il
ponte pubblicato (o quello locale delle prove): le anteprime dei branch usano lo stesso database, e
un'anteprima che lo facesse prima dell'unione lascerebbe indietro le scritture arrivate nel frattempo. Le tabelle di
prima restano com'erano in quel momento: `azione=confronta` (con la chiave) le confronta con le nuove,
e subito dopo il passaggio deve dire `identiche: true`; poi le differenze sono le scritture nuove.

La copia nel foglio passa dal Web App (`azione=specchio`, con la chiave): il
ponte manda tutte le tab, lo script le riscrive come testo semplice, con le
colonne dove sono. Se il foglio non risponde, il ponte riprova ogni 5 minuti;
una volta al giorno (verso le 3 UTC) la copia si rifà comunque.

### Gli account (tappa 3)

Si entra con l'account di **CheMetto** (Supabase Auth del progetto `cnjzhksnhkyezocjejyy`, `SUPABASE_URL` in
`wrangler.jsonc`): email e password, nell'app in Altro ▸ Impostazioni. Non serve usare CheMetto: è solo la
stessa «portineria». I dati di Sillage restano tutti qui, in D1.

- L'app manda il token dell'account nel corpo della richiesta (`accesso=…`), come la chiave. Il ponte ne
  controlla la firma con le **chiavi pubbliche** del progetto (`/auth/v1/.well-known/jwks.json`, ES256: nessun
  segreto da custodire), poi che non sia scaduto e che venga da quel progetto.
- Il token dice quale account è; a quale persona corrisponde lo dice `persone.account`. Un account non
  collegato non vede né scrive niente di nessuno (`chi.daCollegare`).
- **Collegare l'account a Danilo**: `azione=collega` con la chiave **e** l'accesso insieme (dall'app:
  Impostazioni ▸ «Collega l'account al mio diario», sul telefono che ha già la chiave). Così solo chi ha la
  chiave può dire «questo account sono io». `scollega=si` (solo la chiave) toglie il collegamento.
- Chi sei, per ogni richiesta: un accesso buono collegato → quella persona; altrimenti la chiave giusta →
  Danilo; niente → nessuno. Dalla tappa 5 l'app non chiede più la chiave (si entra con l'account e la
  vecchia chiave sparisce da sola dal telefono collegato): il ponte la accetta ancora perché è la **chiave
  di servizio** di Claude (`applica.mjs`, `confronta`, `riporta`), della copia notturna (che legge il diario
  di Danilo per `data/diario.enc`) e di `sincronizza`. `azione=leggi` lo dice all'app nel campo `chi`.
- Diario e residuo: con l'accesso o con la chiave. Catalogo (`modifica`), `sincronizza`, `importa`,
  `confronta`, `riporta`: **solo con la chiave**, sono lavori di Claude.
- Gli errori di chi non è riconosciuto cominciano con «chiave…» o «accesso…»: l'app tiene in coda le voci e
  riprova (per esempio dopo aver rinnovato un token scaduto).

### Le altre persone (tappa 4)

Registrazione libera, come CheMetto (scelta dell'utente).

- **Registrarsi**: `azione=registrati&nome=…` con un accesso buono che non è ancora nessuno → una persona
  nuova (`persone`, id `p` + 6 caratteri), col nome scelto (al più 30 caratteri) e la vetrina vuota. Una
  persona per account: rifarlo restituisce la stessa.
- **Il catalogo comune**: `azione=catalogo` → tutte le schede (id, marca, nome, concentrazione, famiglia,
  immagine, tre accordi, stagioni, voto), senza dire chi le ha. Serve essere qualcuno (accesso o chiave).
  Lo usa «Aggiungi profumo» per cercare per nome un profumo già schedato.
- **Aggiungere una scheda già in Sillage / «Togli dalla vetrina»**: `azione=possesso&op=aggiungi&id=…&tipo=full|campione[&ml=…]` aggiunge
  una scheda ai propri possessi (in fondo all'ordine, `aggiunto` = oggi); `op=togli` la mette `attivo=no` (le
  voci del diario che la nominano restano leggibili; aggiungerla di nuovo la riaccende). Nell'app «Togli dalla
  vetrina» sta in fondo alla scheda; per aggiungere l'app usa `azione=aggiungi` (sotto), che per una scheda già in
  Sillage fa lo stesso. La vista della persona si ricalcola subito.
- **Le vetrine degli altri** (decisione dell'utente: agli altri si mostra solo la collezione):
  `azione=vetrine` (chi c'è e quanti profumi ha) e `azione=vetrina&di=<persona>` (i suoi profumi, **senza**
  note personali e residuo; niente diario, layering né consigli). Le vede solo chi è entrato.
- Ognuno scrive solo sul suo: diario, residuo e possessi vanno sempre alla persona riconosciuta, mai a
  un'altra. Il foglio Google, `data/*.json` e `data/diario.enc` restano solo di Danilo; `GET /api` (senza
  account) resta la vetrina di Danilo, come prima, ma l'app non lo chiama più: chi non è entrato vede solo
  l'ingresso (`app/LEGGIMI.md`, «L'ingresso»). Lo usano gli strumenti di verifica (`--ponte`).
- Prova di isolamento obbligatoria a ogni cambio: `app/strumenti/prova-persone.mjs` (50 controlli).

### Aggiungi profumo

Scelte dell'utente: chi aggiunge un profumo lo mette **nella sua vetrina** e la scheda va **subito nell'anagrafica
comune** (senza approvazione); mai nella vetrina degli altri.

- **`azione=aggiungi`** (accesso o chiave), `dati` = JSON `{cliente, scheda, possesso, foto}`:
  - `scheda`: colonne del foglio (`marchio`, `profumo`, `concentrazione`, `accordi` «a|b», `accordi_forza`,
    `inverno`…`autunno`, `giorno_pct`, `rating`, `voti`, `longevita_h`, `sillage`, `piramide`, le occasioni «si/no»,
    `stagione`, `momento`, `colore`, `fragrantica`…). Passano solo le colonne che il catalogo ha (non `id`, `img` e
    quelle del possesso); servono almeno marchio e nome. Le vuote restano vuote: un profumo senza stagioni ha
    `stagioni: null` nell'app e Consigliami lo salta.
  - **se la scheda c'è già** (stesso numero di profumo nel link Fragrantica, in qualunque lingua del sito, oppure
    stessi marchio, nome e concentrazione) non se ne fa un'altra: si aggiunge il possesso a quella (come
    `azione=possesso`), con le note. Risponde `{ok, id, esistente: true, giaInVetrina}`.
  - **se è nuova**: l'id lo dà il ponte (il più alto + 1, riprova se due aggiunte arrivano insieme); il possesso va
    in fondo alla vetrina di chi aggiunge con `aggiunto` = oggi e `nuovo` = si. Risponde `{ok, id, nuovo: true}`.
  - `possesso`: `{tipo: "full"|"campione", ml, note}`.
  - `foto` (facoltativa): `{tipo: "image/webp"|"image/png"|"image/jpeg", dati: base64}`, al più ~1 MB; va nella
    tabella **`foto`** (una riga per scheda, base64) e la colonna `img` diventa `api/foto/<id>.<ext>?v=<ora>`.
    Le 41 foto di prima restano in `app/public/img/`.
  - `cliente`: un codice fatto dall'app; la stessa aggiunta arrivata due volte (la coda senza rete che ritenta)
    risponde `{ok, gia: true, id}` con lo stesso id (`stato.aggiunta:<cliente>`).
- **`GET /api/foto/<id>.<ext>`**: la foto, con `Cache-Control: immutable` e CORS aperto (la usa anche l'app su
  GitHub Pages, che chiede la foto all'indirizzo del ponte).
- **`azione=leggi-cartolina`** (accesso o chiave), `tipo=cartolina|piramide`, `media`, `immagine` (base64, nel corpo):
  manda l'immagine a **Claude Haiku 5.5** (`claude-haiku-5-5`, effort basso, risposta in JSON con uno schema) e
  restituisce le scritte: per la cartolina nome, marchio, genere, voto, voti, durata, scia, nomi degli accordi e
  note; per la piramide testa, cuore, fondo. **Le barre no**: quelle le misura il telefono
  (`app/src/cartolina/misura.ts`). Al più **20 letture al giorno per persona** (`stato.letture:<persona>:<data>`).
  Serve il segreto **`ANTHROPIC_API_KEY`** nel Worker (sotto, «Messa in opera»); senza, risponde
  `{nonDisponibile: true}` e l'app lascia scrivere a mano. Per le prove `ANTHROPIC_URL` porta a un modello finto.
  Costo: una cartolina ~1.600 token in entrata, meno di un decimo di centesimo.
- Prova: `app/strumenti/prova-aggiungi.mjs` sul ponte locale col modello finto (sotto, «Provarlo in locale»).

## Indirizzi

`https://sillage.danilo-moro96.workers.dev/api`

| richiesta | cosa fa |
|---|---|
| `GET /api` | tutto, senza il diario |
| `POST /api?azione=leggi` | tutto, diario compreso, con la chiave o l'accesso; `chi` dice chi ha riconosciuto |
| `POST /api?azione=diario&op=metti\|togli\|nota&…` | il diario, con la chiave o l'accesso |
| `POST /api?azione=residuo&id=…&valore=…` | il residuo, con la chiave o l'accesso |
| `POST /api?azione=collega` (`scollega=si` per togliere) | collega l'account dell'accesso a Danilo, con la chiave |
| `POST /api?azione=registrati&nome=…` | un account nuovo diventa una persona con la vetrina vuota, con l'accesso |
| `POST /api?azione=catalogo` | tutte le schede (per «Aggiungi profumo»), con l'accesso o la chiave |
| `POST /api?azione=possesso&op=aggiungi\|togli&id=…` (`tipo`, `ml`) | aggiunge una scheda già in Sillage o la toglie («Togli dalla vetrina») dalla propria vetrina |
| `POST /api?azione=aggiungi` (`dati` = JSON) | un profumo: scheda comune (nuova o già in Sillage) + nella propria vetrina |
| `POST /api?azione=leggi-cartolina` (`tipo`, `media`, `immagine`) | le scritte della cartolina o della piramide, lette da Claude Haiku |
| `GET /api/foto/<id>.<ext>` | la foto di un profumo aggiunto dall'app |
| `POST /api?azione=vetrine` · `azione=vetrina&di=…` | chi c'è in Sillage · la sua collezione senza dati privati, per chi è entrato |
| `POST /api?azione=modifica` (`dati` = `{aggiunte, correzioni}`, `prova=1` per provare) | il catalogo, con la chiave |
| `POST /api?azione=sincronizza` | riscrive subito la copia nel foglio, con la chiave |
| `POST /api?azione=importa&conferma=si` | ricopia il catalogo **dal** foglio: solo per rimediare, con la chiave |
| `POST /api?azione=confronta` | le tabelle per persona danno lo stesso di quelle di prima?, con la chiave |
| `POST /api?azione=riporta&conferma=si` | riscrive le tabelle di prima con quelle per persona (per tornare indietro), con la chiave |
| `GET /api?stato=1` | quanti profumi, ultima copia nel foglio, se una copia è in attesa, da quando ci sono le tabelle per persona |

La chiave (`chiave=…`) e l'accesso (`accesso=…`) viaggiano nel corpo della richiesta, mai nell'indirizzo.

## Messa in opera

- Il database `sillage` l'ha creato Cloudflare alla prima pubblicazione. Le
  tabelle le crea il ponte; la prima volta che parte senza catalogo lo copia
  dal foglio da solo (`azione=grezzo` del Web App) e lo dà a `danilo`.
- La chiave di Sillage sta nel Worker come **Secret**: Cloudflare ▸ Workers ▸
  sillage ▸ Settings ▸ **Variables and Secrets** (il riquadro in cima, *non*
  quello dentro Builds) ▸ Add ▸ tipo *Secret*, nome `SILLAGE_CHIAVE`.
- La chiave dell'API di Anthropic (per leggere le scritte delle cartoline) è un altro **Secret**, nello stesso
  posto, nome `ANTHROPIC_API_KEY`. La crea Danilo su console.anthropic.com ▸ API Keys; mai nel repo né nei
  messaggi. Senza, «Aggiungi profumo» funziona lo stesso, scrivendo a mano nome e numeri.
- Ogni unione su `main` ripubblica il ponte da sola, insieme all'app (`sito/`, costruita da `wrangler.jsonc`). Dopo, un controllo:
  `azione=sincronizza` con la chiave deve rispondere `ok`.

## Per tornare indietro

Il foglio ha sempre tutto, perché ogni modifica gli viene copiata. Prima di
tornare indietro: `GET /api?stato=1` deve dire `copiaInAttesa: false`.

- **Dalle tabelle per persona** (tappa 2) **alle tabelle di prima**: prima `azione=riporta&conferma=si`
  con la chiave (riscrive `tabelle` e `diario` con tutto quello che c'è nelle nuove, poi le confronta:
  deve dire `identiche: true`), poi annullare l'unione della tappa 2. Il ponte di prima riparte senza
  perdere niente; provato in locale.
- **Tappa 5** (la chiave fuori dall'app): annullare l'unione. Un telefono a cui l'app ha già tolto la
  chiave continua a funzionare con l'account; per rimetterla serve l'app di prima della tappa 5.
- **Tappa 4** (le altre persone): annullare l'unione. Le persone registrate e i loro possessi restano nel
  database, inutilizzati; Danilo e le copie non cambiano.
- **Tappa 3** (gli account): annullare l'unione. La chiave ha sempre continuato a funzionare, quindi l'app
  di prima riparte da sola; `persone.account` resta scritto ma nessuno lo usa.
- **Tappa 1**: annullare il commit; le tabelle nuove restano nel database, inutilizzate.

- **Al foglio come originale del catalogo** (diario e residuo restano al
  database): annullare il commit che ha portato questa versione del ponte.
- **Al foglio per tutto, senza ponte**: in più, in `js/dati.js`
  `ORIGINE_DATI.appsScript` torna all'URL `.../exec` del Web App, e la copia
  notturna torna a leggere da lì.

## Provarlo in locale

```bash
npx wrangler@4 dev --test-scheduled --var FOGLIO_URL:http://127.0.0.1:8899/exec --var SILLAGE_CHIAVE:prova
```

con un Web App finto su 8899 che risponde a `grezzo` e `specchio` (nessuna
scrittura arriva al foglio vero): `node app/strumenti/foglio-finto.mjs`. Per provare gli account senza
toccare il progetto Supabase vero: un Supabase finto che dà le sue chiavi pubbliche e i suoi token, e
`--var SUPABASE_URL:http://127.0.0.1:8898` (vedi `app/LEGGIMI.md`, «Prove»).

**Aggiungi profumo** in locale, senza chiamate vere ad Anthropic: un modello finto su 8897
(`node app/strumenti/modello-finto.mjs`) e in più `--var ANTHROPIC_API_KEY:finta --var
ANTHROPIC_URL:http://127.0.0.1:8897/v1/messages`; poi `node app/strumenti/prova-aggiungi.mjs` (con
`PONTE_LOCALE=http://127.0.0.1:8788/api` davanti se il ponte locale gira su un'altra porta, con `--port 8788`).
Meglio su un database locale a parte: `--persist-to <cartella temporanea>`.

`wrangler dev` (come ogni pubblicazione) prima costruisce l'app in `sito/` e la serve alla radice: la prima
volta installa i pacchetti di `app/`. Attenzione: costruita così l'app parla col ponte **pubblicato**; per farle
usare il ponte locale va lanciato con `VITE_PONTE=http://127.0.0.1:8787/api` davanti (vedi `app/LEGGIMI.md`). `curl "http://127.0.0.1:8787/__scheduled?cron=*/5+*+*+*+*"`
lancia un giro. Il database locale sta in `.wrangler/` (fuori da git).
