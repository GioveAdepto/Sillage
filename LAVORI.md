# Lavori di Sillage

A che punto siamo. Lo tiene aggiornato la chat di coordinamento, a ogni tappa e nello stesso commit.
Ultimo aggiornamento: 20 novembre 2026.

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
| 20/11 | Scheda pubblica `#/p/<id>` (il link da CheMetto, anche senza account), guida a passi in «Aggiungi profumo» (per ora senza schermate), il ponte manda a CheMetto il numero del profumo; in CheMetto (migrazione 070 e codice) il profumo si apre in Sillage da Bacheca, proposte col partner, «Chiedi un parere» e dalla «i» del foglio dei profumi | branch `guida-e-scheda-pubblica`; CheMetto `fdc20a1` e `profumo-in-sillage` |

## Da provare dall'iPhone (l'utente)

- **CheMetto ▸ Oggi**: con il proprio account compare un profumo per ogni proposta; scegliendolo, «Oggi ho messo»
  arriva nel diario di Sillage. Con un account senza profumi o senza Sillage non deve vedersi niente di rotto o vuoto.
- **Sillage ▸ Altro ▸ Aggiungi profumo**: la piramide letta da una schermata di Fragrantica esce giusta.
- **Da CheMetto a Sillage** (20/11): nella Bacheca, sotto un outfit condiviso da oggi in poi, «Sillage ›» apre la
  scheda del profumo in Safari; senza accesso a Sillage in Safari si vede la scheda pubblica con «Entra», con l'accesso
  la propria scheda. Anche la «i» nel foglio dei profumi di Oggi. I profumi già in Bacheca prima restano senza link.

## Da fare (chiesti dall'utente il 17/11)

- **Le schermate della guida di «Aggiungi profumo»**: la guida è pubblicata (20/11), per ora solo testo. **Aspetta le
  schermate dell'utente** (scheda nell'app Fragrantica, dopo Condividi, foglio con «Salva immagine», la piramide), in
  `C:\Projects\Sillage\SchedeProfumiFragrantica\guida`: poi vanno rimpicciolite in `app/public/img/guida/` e messe nei
  passi (`img` in `PASSI_CARTOLINA` / `PASSI_PIRAMIDE` di `Aggiungi.tsx`).

## In corso in altre sessioni

- **Grafica meno piatta** (richiesta dell'utente del 20/11): sessione a parte, branch `grafica-meno-piatta`; prima
  chiede all'utente che esperienza vuole.

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
