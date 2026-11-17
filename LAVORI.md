# Lavori di Sillage

A che punto siamo. Lo tiene aggiornato la chat di coordinamento, a ogni tappa e nello stesso commit.
Ultimo aggiornamento: 17 novembre 2026.

## Fatto (su `main`, pubblicato)

| quando | cosa | unione |
|---|---|---|
| 12/11 | Database D1 originale di tutto, foglio Google come copia | `86fd934` |
| 13/11 | App rifatta in React + TypeScript, stile Boutique chiaro e scuro | `985e662` |
| 14–15/11 | Account (quelli di CheMetto), registrazione libera, vetrina per persona, chiave fuori dall'app, via «Ce l'ho» | `dfcde44` … `05305c9` |
| 14/11 | Foto delle boccette scontornate di nuovo | `9fec1e1` |
| 16/11 | Pagina d'ingresso: senza account si vede solo «Entra con il tuo account di CheMetto» | `61d2c0b` |
| 17/11 | Aggiungi profumo, con la cartolina di Fragrantica letta nel telefono (gratis) e la piramide da schermata | `10f47d9`, `ff6f178`, `6a328a4` |
| 17/11 | CheMetto: un profumo per ogni proposta di Oggi; «Oggi ho messo» nei due sensi | `8efee8f`, `d8c03dd`, `03b8618`, `02dac98` |

## Da provare dall'iPhone (l'utente)

- **CheMetto ▸ Oggi**: con il proprio account compare un profumo per ogni proposta; scegliendolo, «Oggi ho messo»
  arriva nel diario di Sillage. Con un account senza profumi o senza Sillage non deve vedersi niente di rotto o vuoto.
- **Sillage ▸ Altro ▸ Aggiungi profumo**: la piramide letta da una schermata di Fragrantica esce giusta.

## Da fare (chiesti dall'utente il 17/11)

- **Guida con schermate per «Aggiungi profumo»**: spiegare passo per passo, con immagini, come recuperare la
  cartolina dall'app Fragrantica (scheda del profumo ▸ Condividi ▸ salva l'immagine), come fare la schermata della
  piramide e quali dati servono. Le schermate vere dall'iPhone vanno chieste all'utente.
- **Dal profumo consigliato in CheMetto a Sillage**: chi vede il profumo consigliato per l'outfit deve poter
  arrivare a Sillage per saperne di più, sia l'utente stesso sia le persone esterne che lo vedono (per esempio nella
  Bacheca). Prima chiedere all'utente che esperienza vuole, soprattutto per chi non ha un account di Sillage: oggi
  senza account si vede solo la pagina d'ingresso.

## Da decidere

- Sul branch `riscrittura-react` c'è un commit mai unito (`efa3472`): toglie il service worker rimasto
  all'indirizzo di prova `/nuova/`. Serve solo se un telefono ha aperto quell'indirizzo.
- Branch vecchi del 5/11 mai uniti, con un commit ciascuno:
  - `no-zoom`: niente zoom nell'app installata, ma tocca solo l'app di prima. L'app nuova oggi si può
    ingrandire (`app/index.html`, viewport): chiedere all'utente se vuole lo stesso anche lì.
  - `date-asad-angelsear`: date d'ingresso di Asad e ANGELSEAR scambiate, sulle code di allora
    (`data/aggiunte.json`, `data/correzioni.json`). Controllare nel database se le date sono giuste; poi cancellarlo.
- L'app di prima nella radice (`index.html`, `js/`, `css/`, `sw.js`): serve ai confronti automatici e per tornare
  indietro; quando non servirà più si può togliere.

## Idee per dopo (dette dall'utente)

- Layering e consigli d'acquisto oggi sono solo di Danilo: «per ora; il resto lo valutiamo più avanti».
