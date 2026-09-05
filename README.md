# Sillage

Vetrina di una collezione privata di profumi. Pagina statica, nessuna
compilazione: si apre servendo la cartella così com'è.

## Struttura

```
index.html            solo markup (92 righe)
css/sillage.css       lo stile, com'era nel <style> inline
js/app.js             la logica + il caricamento dei dati
data/*.json           copia dei dati nel repo (ripiego e avvio a freddo)
img/*.webp            31 flaconi, 176×208, più il segnaposto
apps-script/          backend di lettura sul foglio Google
```

Prima stava tutto dentro `index.html`: 242 KB, di cui 129 KB erano una sola riga
di immagini in base64. Ora `index.html` pesa 5,6 KB.

## Da dove arrivano i dati

Sorgente di verità è il foglio Google **sillage-profumi**, pubblicato in JSON da
Apps Script — istruzioni in [`apps-script/LEGGIMI.md`](apps-script/LEGGIMI.md).
`data/*.json` ne è una copia versionata: l'app la usa quando il backend non
risponde, o finché `ORIGINE_DATI.appsScript` in [`js/app.js`](js/app.js) resta
vuoto.

Le immagini restano file nel repo, non passano dal foglio: il foglio contiene
solo il percorso, nella colonna `img`.

## Provarla in locale

Serve un server, perché i dati si caricano con `fetch`:

```bash
python -m http.server 8765
```

poi <http://127.0.0.1:8765>. Aprire `index.html` con doppio clic non funziona.

## Pubblicazione

GitHub Pages sul ramo `main`. `wrangler.jsonc` tiene in piedi in parallelo la
distribuzione Cloudflare Workers, che serve la stessa cartella.
