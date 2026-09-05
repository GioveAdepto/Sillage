/**
 * Sillage — correzioni puntuali al foglio.
 *
 * Il foglio è la sorgente di verità, ma chi lavora al repo non ha modo di
 * scriverci: questo è il canale.
 *
 * L'elenco delle correzioni NON sta più qui dentro: sta in `data/correzioni.json`
 * nel repo, e `correggi()` lo scarica ogni volta. Quindi questo file si incolla
 * nell'editor una volta sola e non va più toccato: le correzioni nuove arrivano
 * da sole al prossimo lancio.
 *
 * Ogni voce dichiara il valore che si aspetta di trovare (`da`) e quello che
 * vuole mettere (`a`). Si scrive **solo** se la cella contiene ancora `da`: se
 * nel frattempo l'hai cambiata tu, la voce viene saltata e riportata nel log.
 * Le modifiche fatte a mano nel foglio vincono sempre. Rilanciare non fa danni.
 *
 *   correggi()            applica quello che c'è in coda
 *   correggi(true)        prova a vuoto: dice cosa farebbe senza toccare nulla
 *   attivaAutomatismo()   una volta al giorno le applica da solo
 *   fermaAutomatismo()    e smette
 */

var CORREZIONI_URL = REPO + 'data/correzioni.json';

function scaricaCorrezioni_() {
  var r = UrlFetchApp.fetch(CORREZIONI_URL, { muteHttpExceptions: true });
  if (r.getResponseCode() === 404) return [];          // coda vuota: niente da fare
  if (r.getResponseCode() !== 200) {
    throw new Error('non riesco a leggere data/correzioni.json (HTTP ' +
                    r.getResponseCode() + ')');
  }
  return JSON.parse(r.getContentText());
}

function correggi(soloProva) {
  var correzioni = scaricaCorrezioni_();

  /* Ogni tab viene letta una volta sola e tenuta qui: le correzioni non sono
     solo sui profumi, toccano anche Layering e Consigli, dove la riga si
     riconosce dal nome invece che da un id. */
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

  // i testi lunghi renderebbero il log illeggibile
  function breve(x) {
    x = String(x);
    return x.length > 64 ? x.slice(0, 61) + '…' : x;
  }

  var esiti = [], scritte = 0, saltate = 0;
  correzioni.forEach(function (c) {
    var nomeTab = c.tab || TAB.profumi;
    var chiave = c.chiave || 'id';
    var valore = c.valore !== undefined ? c.valore : c.id;
    var etichetta = nomeTab + ' «' + breve(valore) + '» ' + c.colonna;

    var t;
    try { t = tabella(nomeTab); }
    catch (e) { esiti.push(etichetta + ': ' + e.message); return; }

    var colChiave = t.testa.indexOf(chiave);
    if (colChiave < 0) { esiti.push(etichetta + ': manca la colonna "' + chiave + '"'); return; }

    var r = -1;
    for (var i = 1; i < t.griglia.length; i++) {
      if (String(t.griglia[i][colChiave]).trim() === String(valore).trim()) { r = i + 1; break; }
    }
    var colonna = t.testa.indexOf(c.colonna);
    if (r < 0) { esiti.push(etichetta + ': nessuna riga con questa chiave'); return; }
    if (colonna < 0) { esiti.push(etichetta + ': colonna assente nel foglio'); return; }

    var attuale = String(t.griglia[r - 1][colonna]).trim();
    if (attuale.toLowerCase() === String(c.a).toLowerCase()) {
      esiti.push(etichetta + ': già a posto');
      return;
    }
    if (attuale.toLowerCase() !== String(c.da).toLowerCase()) {
      saltate++;
      esiti.push(etichetta + ': SALTATA — mi aspettavo "' + breve(c.da) +
                 '", trovo "' + breve(attuale) + '". La tua modifica resta.');
      return;
    }
    if (soloProva) {
      esiti.push(etichetta + ': (prova) "' + breve(attuale) + '" → "' + breve(c.a) + '"');
      return;
    }
    t.foglio.getRange(r, colonna + 1).setValue(c.a);
    t.griglia[r - 1][colonna] = c.a;
    scritte++;
    esiti.push(etichetta + ': "' + breve(attuale) + '" → "' + breve(c.a) + '" — ' + c.perche);
  });

  var riassunto = correzioni.length + ' voci in coda · ' +
                  (soloProva ? 'PROVA A VUOTO, niente è stato scritto'
                             : scritte + ' celle scritte') +
                  (saltate ? ' · ' + saltate + ' saltate' : '');
  var testo = riassunto + '\n' + (esiti.join('\n') || 'nessuna correzione in coda');
  Logger.log(testo);
  try { SpreadsheetApp.getActive().toast(riassunto, 'Sillage — correzioni', 20); } catch (e) {}
  return testo;
}

/**
 * Applica da sé le correzioni nuove, una volta al giorno.
 *
 * Da qui in poi non devi più lanciare niente: quello che finisce in
 * `data/correzioni.json` arriva nel foglio da solo. La guardia `da` resta,
 * quindi una voce può cambiare solo una cella che contiene ancora esattamente
 * il valore che si aspettava — quello che modifichi a mano non viene toccato.
 * Il resoconto di ogni esecuzione sta in Esecuzioni, nell'editor.
 */
function attivaAutomatismo() {
  fermaAutomatismo();
  ScriptApp.newTrigger('correggi').timeBased().everyDays(1).atHour(4).create();
  return 'correzioni automatiche attive: ogni notte verso le 4';
}

function fermaAutomatismo() {
  var tolti = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'correggi') { ScriptApp.deleteTrigger(t); tolti++; }
  });
  return tolti ? 'automatismo fermato' : 'non era attivo';
}
