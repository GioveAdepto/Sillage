# Il ponte: l'app sul database

`ponte.js` è un piccolo programma su Cloudflare (un Worker) che collega l'app a
un database (Cloudflare D1). Il foglio Google resta il posto dove modifichi il
catalogo dei profumi; l'app legge e scrive sul database, che è più veloce
(circa 60 ms invece di un secondo) e non dipende dai tempi di Google.

Il ponte parla esattamente come il Web App di Apps Script (stesse richieste,
stesse risposte), quindi per far passare l'app dal foglio al database basta
cambiare un indirizzo in `js/dati.js`. Per tornare indietro si rimette quello
vecchio.

## Chi comanda

`PADRONE` in `wrangler.jsonc`:

| valore | catalogo | diario e residuo | scritture dall'app |
|---|---|---|---|
| `foglio` | dal foglio | dal foglio: il database è una copia | rifiutate (si fanno sul foglio) |
| `database` | dal foglio | li comanda il database, il foglio ne riceve una copia | accettate |

Ogni 5 minuti il ponte rilegge il foglio. Con il database al comando, dopo ogni
scrittura il ponte manda subito una copia al foglio (attraverso il Web App,
con la chiave); se il foglio non risponde, riprova al giro successivo e niente
si perde. Le voci del diario aggiunte a mano nel foglio, con il database al
comando, non entrano: il diario nel foglio è una copia da guardare.

## Indirizzi

`https://sillage.danilo-moro96.workers.dev/api`

| richiesta | cosa fa |
|---|---|
| `GET /api` | tutto, senza il diario |
| `POST /api?azione=leggi` | tutto, diario compreso, con la chiave |
| `POST /api?azione=diario&op=metti\|togli\|nota&…` | come il Web App, con la chiave |
| `POST /api?azione=residuo&id=…&valore=…` | come il Web App, con la chiave |
| `POST /api?azione=sincronizza` | rilegge subito il foglio e manda quello che manca, con la chiave |
| `GET /api?stato=1` | chi comanda, ultima sincronia, quante cose aspettano di andare al foglio |

La chiave viaggia nel corpo della richiesta (`chiave=…`), mai nell'indirizzo.

## Messa in opera

- Il database si chiama `sillage` e Cloudflare lo crea da solo alla prima
  pubblicazione: in `wrangler.jsonc` non c'è il `database_id` apposta. Le
  tabelle le crea il ponte alla prima richiesta.
- La chiave di Sillage va messa anche qui, una volta: Cloudflare ▸ Workers ▸
  **sillage** ▸ Settings ▸ **Variables and Secrets** ▸ Add ▸ tipo *Secret*,
  nome `SILLAGE_CHIAVE`, valore la chiave ▸ Deploy.
- Ogni unione su `main` ripubblica il ponte da sola (Workers Builds).
- Controllo veloce: `GET /api?stato=1` deve dire una `ultimaSincronia` di pochi
  minuti fa.

## Le tappe del passaggio

1. **Ponte pubblicato, comanda il foglio.** L'app usa ancora il Web App. Il
   database si riempie e si aggiorna da solo; si confrontano le risposte del
   ponte con quelle del foglio (devono essere uguali, a parte `aggiornato`).
2. **Il database comanda.** In un solo commit: `PADRONE` diventa `database` e
   in `js/dati.js` `ORIGINE_DATI.appsScript` punta al ponte (con `?v=` nuovo in
   `index.html`). La coda del telefono passa da sola al nuovo indirizzo.
   La copia notturna legge il diario dal ponte.
3. **Per tornare indietro:** si annulla quel commit. Il foglio ha già tutto,
   perché ogni scrittura gli è stata copiata; prima di annullare, controllare
   che `daMandareAlFoglio` sia 0.

## Provarlo in locale

Serve Node. Con un foglio finto (nessuna scrittura arriva al foglio vero):

```bash
npx wrangler@4 dev --test-scheduled --var FOGLIO_URL:http://127.0.0.1:8899/exec --var SILLAGE_CHIAVE:prova --var PADRONE:database
```

poi `curl "http://127.0.0.1:8787/__scheduled?cron=*/5+*+*+*+*"` lancia un giro
di sincronia. Il database locale sta in `.wrangler/` (fuori da git).
