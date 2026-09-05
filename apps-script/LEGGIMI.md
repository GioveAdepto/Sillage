# Backend Apps Script

Il foglio [`sillage-profumi`](https://docs.google.com/spreadsheets/d/12SyJ5v4ypSNTbP9zS3rY0zlaBebt216B2Lsvndhfmgo/edit)
è la sorgente di verità. Questo script lo pubblica come JSON per `js/app.js`.

## Cosa fa

| file | ruolo |
|---|---|
| `Codice.gs` | `doGet()` — restituisce il foglio in JSON, già nella forma che l'app usa |
| `Installa.gs` | `installa()` — da lanciare una volta: aggiunge al foglio colonne e tab mancanti |
| `Correzioni.gs` | `correggi()` — applica al foglio le correzioni puntuali decise nel repo |

## Messa in opera

1. Apri il foglio → **Estensioni ▸ Apps Script**.
2. Incolla `Codice.gs` e `Installa.gs` in due file dell'editor (stessi nomi).
3. Esegui **`installa()`** e autorizza allo script l'accesso al foglio e alla rete.
   Legge `data/*.json` dal repo e:
   - aggiunge alla tab `Profumi` le 12 colonne che mancavano:
     `piramide, stagione, momento, colore, quotidiano, formale, informale,
     appuntamento, casa, festivita, nuovo, descrizione`;
   - riempie `clone_di` dove era vuoto ma il dupe era noto (Rue Broca, Lattafa
     Atlas, Al Haramain, Khadlaj: 4 attribuzioni che nel foglio non c'erano);
   - sostituisce `img/placeholder.svg` di ANGELSEAR con l'immagine vera e mette
     quella di Asad;
   - crea le tab `Layering` (26 righe), `Consigli` (7), `ConsigliVoci` (18), `Note` (53).

   Scrive **solo in celle vuote** e non tocca una tab che esiste già: rilanciarlo
   non fa danni.
4. Esegui `prova()` e guarda il log: deve stampare 31 profumi, 53 note, 26
   layering, 7 consigli.
5. **Distribuisci ▸ Nuova distribuzione ▸ App web**
   - *Esegui come*: me stesso
   - *Chi ha accesso*: **Chiunque**   ← indispensabile: la pagina su GitHub Pages
     legge senza credenziali. Espone in lettura gli stessi dati che sono già
     pubblici nel repo, non aggiunge nulla di privato.
6. Copia l'URL che finisce in `/exec` e incollalo in `js/app.js`:

```js
const ORIGINE_DATI = {
  appsScript: "https://script.google.com/macros/s/AKfy…/exec",
```

## Come l'app usa il backend

`caricaDati()` disegna il prima possibile e corregge il tiro dopo:

1. se in **cache** (`localStorage`) c'è già una collezione, va a schermo subito;
2. intanto parte la richiesta al **foglio**. Se risponde entro `attesaMax` (8 s)
   vince lei;
3. se tarda, si disegna quello che c'è — la cache, o i **`data/*.json` del
   repo** — e **la richiesta prosegue lo stesso**: quando arriva, il foglio ha
   comunque l'ultima parola. Non viene mai interrotta.

Il secondo disegno scatta solo se il foglio porta qualcosa di diverso da quello
che si vede già, così una schermata a posto non si ricostruisce sotto le mani.

Quindi un Apps Script lento, in quota o non ancora configurato non lascia mai la
pagina vuota. `document.body.dataset.origine` dice da dove arriva quello che è a
schermo adesso (`foglio`, `cache`, `locale`, `locale-ripiego`) e si aggiorna
anche quando il foglio arriva in ritardo.

`doGet` tiene il JSON in `CacheService` per 5 minuti. Per vedere subito una
modifica al foglio: `…/exec?fresco=1`.

## Riallineare la copia nel repo

Dopo qualche modifica al foglio conviene rinfrescare lo snapshot, così il ripiego
non invecchia:

```bash
curl -sL "https://script.google.com/macros/s/AKfy…/exec?fresco=1" -o /tmp/sillage.json
python - <<'PY'
import json, pathlib
d = json.load(open('/tmp/sillage.json', encoding='utf-8'))
for k in ('profumi', 'note', 'layering', 'consigli'):
    p = pathlib.Path('data', k + '.json')
    p.write_text(json.dumps(d[k], ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(p, len(d[k]), 'voci')
PY
```

## Correzioni puntuali

Chi lavora al repo non ha modo di scrivere nel foglio: `correggi()` è quel
canale. In cima a `Correzioni.gs` c'è l'elenco `CORREZIONI`, e ogni voce dichiara
il valore che si aspetta di trovare e quello che vuole mettere:

```js
{ id: 26, colonna: 'ufficio', da: 'moderazione', a: 'no', perche: '…' }
```

Scrive **solo** se la cella contiene ancora `da`. Se nel frattempo l'hai
cambiata tu, la salta e lo scrive nel log: le modifiche fatte a mano nel foglio
vincono sempre. Rilanciarla non fa danni — le voci già applicate risultano
«già a posto».

`correggi(true)` è una prova a vuoto: dice cosa farebbe senza toccare niente.

In coda ora c'è una sola voce: **Atlas, `ufficio` da `moderazione` a `no`**. Con
scia Enorme in uno spazio chiuso condiviso non è nemmeno un forse, e con
`moderazione` rientrava nel filtro Ufficio.

## Colonne del foglio che l'app non disegna (ancora)

`genere`, `sillage`, `voti`, `giorno_pct`, le quattro percentuali stagionali,
`serata`, `formato_ml`, `tipo_possesso`, `num_flaconi`, `residuo_pct`,
`clone_stato`, `note_personali`. Arrivano comunque nel JSON — servono a
`disegnaNumeri()` il giorno che vorrai usarle.

Attenzione a `serata`: **non** è `appuntamento`. Sono due colonne distinte e su
4 profumi danno risposte diverse (Helan, Terre d'Hermès, Acqua di Giò, CdN
Sillage); l'app legge `appuntamento`.
