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
 *
 * Oltre alle righe sa aggiungere colonne: una voce con "colonna" al posto di
 * "riga" crea l'intestazione in fondo alla tab, se non c'è già. Le colonne
 * vengono create prima delle righe, così una riga nuova può già usarle.
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

  var esiti = [], aggiunte = 0, colonne = 0, saltate = 0;

  // prima le colonne: le righe che seguono possono aver bisogno di quelle nuove
  voci.filter(function (v) { return v.colonna; }).forEach(function (v) {
    var etichetta = v.tab + ' colonna «' + v.colonna + '»';
    var t;
    try { t = tabella(v.tab); }
    catch (e) { esiti.push(etichetta + ': ' + e.message); return; }
    if (t.testa.indexOf(v.colonna) >= 0) { saltate++; esiti.push(etichetta + ': c\'è già, salto'); return; }
    var col = t.testa.length + 1;
    // anche in prova la colonna entra in memoria: le righe che seguono la
    // usano, e senza la prova a vuoto le respingerebbe dando un esito falso
    t.testa.push(v.colonna);
    t.griglia.forEach(function (r, i) { r.push(i === 0 ? v.colonna : ''); });
    if (soloProva) { esiti.push(etichetta + ': (prova) colonna nuova in fondo'); return; }
    t.foglio.getRange(1, col).setValue(v.colonna).setFontWeight('bold');
    colonne++;
    esiti.push(etichetta + ': creata — ' + (v.perche || ''));
  });

  voci.filter(function (v) { return v.riga; }).forEach(function (v) {
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
                             : (colonne ? colonne + ' colonne e ' : '') + aggiunte + ' righe aggiunte') +
                  (saltate ? ' · ' + saltate + ' già presenti' : '');
  var testo = riassunto + '\n' + (esiti.join('\n') || 'niente da aggiungere');
  Logger.log(testo);
  try { SpreadsheetApp.getActive().toast(riassunto, 'Sillage — aggiunte', 20); } catch (e) {}
  return testo;
}
