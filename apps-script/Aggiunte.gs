/**
 * Sillage — righe nuove da aggiungere al foglio.
 *
 * `correggi()` aggiorna celle che esistono già; questo invece accoda righe
 * nuove. Serve per le ricette di layering e per le voci degli acquisti, che
 * nascono nel repo e non hanno una riga nel foglio dove atterrare.
 *
 * L'elenco sta in `data/aggiunte.json` e viene scaricato a ogni lancio, come
 * per le correzioni: questo file si incolla una volta sola e non va più
 * toccato.
 *
 * Ogni voce dichiara la tab, la colonna che fa da chiave e il valore di quella
 * chiave. Se una riga con quella chiave c'è già, la voce viene saltata: quindi
 * rilanciare non duplica niente.
 *
 *   aggiungi()       accoda quello che manca
 *   aggiungi(true)   prova a vuoto: dice cosa farebbe senza scrivere
 */

var AGGIUNTE_URL = REPO + 'data/aggiunte.json';

function scaricaAggiunte_() {
  var r = UrlFetchApp.fetch(AGGIUNTE_URL, { muteHttpExceptions: true });
  if (r.getResponseCode() === 404) return [];
  if (r.getResponseCode() !== 200) {
    throw new Error('non riesco a leggere data/aggiunte.json (HTTP ' +
                    r.getResponseCode() + ')');
  }
  return JSON.parse(r.getContentText());
}

function aggiungi(soloProva) {
  var voci = scaricaAggiunte_();
  var lette = {};
  function tabella(nome) {
    if (!lette[nome]) {
      var f = foglio_(nome);
      var g = f.getDataRange().getDisplayValues();
      lette[nome] = { foglio: f, griglia: g,
                      testa: g[0].map(function (c) { return String(c).trim(); }) };
    }
    return lette[nome];
  }
  function breve(x) {
    x = String(x);
    return x.length > 64 ? x.slice(0, 61) + '…' : x;
  }

  var esiti = [], aggiunte = 0, saltate = 0;
  voci.forEach(function (v) {
    var etichetta = v.tab + ' «' + breve(v.valore) + '»';
    var t;
    try { t = tabella(v.tab); }
    catch (e) { esiti.push(etichetta + ': ' + e.message); return; }

    var colChiave = t.testa.indexOf(v.chiave);
    if (colChiave < 0) { esiti.push(etichetta + ': manca la colonna "' + v.chiave + '"'); return; }

    // c'e' gia'? allora non si tocca niente: rilanciare non deve duplicare
    for (var i = 1; i < t.griglia.length; i++) {
      if (String(t.griglia[i][colChiave]).trim() === String(v.valore).trim()) {
        saltate++;
        esiti.push(etichetta + ': c\'è già, salto');
        return;
      }
    }

    var sconosciute = Object.keys(v.riga).filter(function (c) { return t.testa.indexOf(c) < 0; });
    if (sconosciute.length) {
      esiti.push(etichetta + ': colonne che il foglio non ha — ' + sconosciute.join(', '));
      return;
    }

    var riga = t.testa.map(function (c) { return v.riga[c] !== undefined ? v.riga[c] : ''; });
    if (soloProva) { esiti.push(etichetta + ': (prova) riga nuova in fondo'); return; }

    t.foglio.appendRow(riga);
    t.griglia.push(riga);          // così un duplicato nello stesso lancio si vede
    aggiunte++;
    esiti.push(etichetta + ': aggiunta — ' + (v.perche || ''));
  });

  var riassunto = voci.length + ' voci in coda · ' +
                  (soloProva ? 'PROVA A VUOTO, niente è stato scritto'
                             : aggiunte + ' righe aggiunte') +
                  (saltate ? ' · ' + saltate + ' già presenti' : '');
  var testo = riassunto + '\n' + (esiti.join('\n') || 'niente da aggiungere');
  Logger.log(testo);
  try { SpreadsheetApp.getActive().toast(riassunto, 'Sillage — aggiunte', 20); } catch (e) {}
  return testo;
}
