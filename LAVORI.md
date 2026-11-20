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

## Da provare dall'iPhone (l'utente)

- **CheMetto ▸ Oggi**: con il proprio account compare un profumo per ogni proposta; scegliendolo, «Oggi ho messo»
  arriva nel diario di Sillage. Con un account senza profumi o senza Sillage non deve vedersi niente di rotto o vuoto.
- **Sillage ▸ Altro ▸ Aggiungi profumo**: la piramide letta da una schermata di Fragrantica esce giusta.

## Da fare (chiesti dall'utente il 17/11)

- **Guida con schermate per «Aggiungi profumo»**: spiegare passo per passo, con immagini, come recuperare la
  cartolina dall'app Fragrantica (scheda del profumo ▸ Condividi ▸ salva l'immagine), come fare la schermata della
  piramide e quali dati servono. Le schermate vere dall'iPhone vanno chieste all'utente.
  Disegno approvato dall'utente il 17/11 (anteprima «Sillage · guida e scheda pubblica»). **Costruita** sul branch
  `guida-e-scheda-pubblica` (20/11): la guida dentro i passi Cartolina e Piramide, con miniature e il cassetto coi passi
  in grande; per ora senza immagini (solo testo). **Aspetta le schermate dell'utente** (scheda nell'app Fragrantica,
  dopo Condividi, foglio con «Salva immagine», la piramide), in `C:\Projects\Sillage\SchedeProfumiFragrantica\guida`:
  poi vanno rimpicciolite in `app/public/img/guida/` e messe nei passi (`img`).
- **Dal profumo consigliato in CheMetto a Sillage**: chi vede il profumo consigliato per l'outfit deve poter
  arrivare a Sillage per saperne di più, sia l'utente stesso sia le persone esterne che lo vedono (per esempio nella
  Bacheca). Scelte dell'utente del 17/11: **chi non ha Sillage** vede una scheda pubblica del profumo (solo i dati
  comuni del catalogo, mai vetrine, note personali, residuo o diario) con l'invito a entrare; **chi ha Sillage** apre
  la sua scheda se il profumo è suo, se no la scheda pubblica con «Mettilo nella mia vetrina»; il link sta **ovunque
  in CheMetto compaia il profumo** (Bacheca, Oggi, proposte, foglio dei consigli). Serve: indirizzo pubblico
  `#/p/<id>`, una lettura senza account della sola scheda nel ponte, in CheMetto il link e una migrazione per tenere
  l'id del profumo nella Bacheca. Sull'iPhone il link si apre in Safari, non nell'app installata. Disegno approvato
  il 17/11. **Parte di Sillage costruita** sul branch `guida-e-scheda-pubblica` (20/11): `#/p/<id>` e `azione=scheda`,
  prove passate (browser col ponte finto, ponte locale, `prova-persone`). Da unire su `main` col via libera dell'utente.
  **Parte di CheMetto** (sì dell'utente il 20/11): branch `profumo-in-sillage` di CheMetto, migrazione 069 (il numero
  del profumo in Sillage nel profumo del giorno), riga della Bacheca che porta a `#/p/<id>`, «i» accanto a ogni profumo
  nel foglio dei consigli; il ponte manda `p_id` a `segna_profumo`. Prove passate (Vitest, e2e del profumo,
  `prova-persone`). **Ordine di pubblicazione**: 1) migrazione 069 su `main` di CheMetto; 2) unione di questo branch
  su `main` di Sillage; 3) il codice di CheMetto. Aspetta l'ok dell'utente sull'anteprima. I profumi segnati prima
  restano senza link. Le proposte col partner (068, altra sessione di CheMetto) avranno il link quando arrivano.

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
