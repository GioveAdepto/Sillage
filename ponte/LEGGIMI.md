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

Nel database il catalogo sta con **le stesse colonne del foglio** (tab
Profumi, Layering, Consigli, ConsigliVoci, Note): una riga di database per
tab, con dentro tutte le sue righe. Il piano gratuito concede 50 operazioni
per richiesta, e così ne bastano poche. Da lì il ponte ricava il JSON per
l'app con le stesse regole di `apps-script/Codice.gs` e lo tiene pronto.
Il diario è una tabella a sé, una riga per voce.

La copia nel foglio passa dal Web App (`azione=specchio`, con la chiave): il
ponte manda tutte le tab, lo script le riscrive come testo semplice, con le
colonne dove sono. Se il foglio non risponde, il ponte riprova ogni 5 minuti;
una volta al giorno (verso le 3 UTC) la copia si rifà comunque.

## Indirizzi

`https://sillage.danilo-moro96.workers.dev/api`

| richiesta | cosa fa |
|---|---|
| `GET /api` | tutto, senza il diario |
| `POST /api?azione=leggi` | tutto, diario compreso, con la chiave |
| `POST /api?azione=diario&op=metti\|togli\|nota&…` | il diario, con la chiave |
| `POST /api?azione=residuo&id=…&valore=…` | il residuo, con la chiave |
| `POST /api?azione=modifica` (`dati` = `{aggiunte, correzioni}`, `prova=1` per provare) | il catalogo, con la chiave |
| `POST /api?azione=sincronizza` | riscrive subito la copia nel foglio, con la chiave |
| `POST /api?azione=importa&conferma=si` | ricopia il catalogo **dal** foglio: solo per rimediare, con la chiave |
| `GET /api?stato=1` | quanti profumi, ultima copia nel foglio, se una copia è in attesa |

La chiave viaggia nel corpo della richiesta (`chiave=…`), mai nell'indirizzo.

## Messa in opera

- Il database `sillage` l'ha creato Cloudflare alla prima pubblicazione. Le
  tabelle le crea il ponte; la prima volta che parte senza catalogo lo copia
  dal foglio da solo (`azione=grezzo` del Web App).
- La chiave di Sillage sta nel Worker come **Secret**: Cloudflare ▸ Workers ▸
  sillage ▸ Settings ▸ **Variables and Secrets** (il riquadro in cima, *non*
  quello dentro Builds) ▸ Add ▸ tipo *Secret*, nome `SILLAGE_CHIAVE`.
- Ogni unione su `main` ripubblica il ponte da sola, insieme all'app (`sito/`, costruita da `wrangler.jsonc`). Dopo, un controllo:
  `azione=sincronizza` con la chiave deve rispondere `ok`.

## Per tornare indietro

Il foglio ha sempre tutto, perché ogni modifica gli viene copiata. Prima di
tornare indietro: `GET /api?stato=1` deve dire `copiaInAttesa: false`.

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
scrittura arriva al foglio vero): `node app/strumenti/foglio-finto.mjs`.

`wrangler dev` (come ogni pubblicazione) prima costruisce l'app in `sito/` e la serve alla radice: la prima
volta installa i pacchetti di `app/`. Attenzione: costruita così l'app parla col ponte **pubblicato**; per farle
usare il ponte locale va lanciato con `VITE_PONTE=http://127.0.0.1:8787/api` davanti (vedi `app/LEGGIMI.md`). `curl "http://127.0.0.1:8787/__scheduled?cron=*/5+*+*+*+*"`
lancia un giro. Il database locale sta in `.wrangler/` (fuori da git).
