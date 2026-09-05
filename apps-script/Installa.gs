/**
 * Sillage — allineamento del foglio, da lanciare UNA VOLTA dall'editor.
 *
 * Aggiunge alla tab Profumi le colonne che l'interfaccia usa e che nel foglio
 * non c'erano, e crea le tab Layering, Consigli, ConsigliVoci e Note.
 * I contenuti arrivano da data/*.json nel repo.
 *
 * E' prudente per costruzione: scrive solo in celle vuote e non crea una tab
 * che esiste gia'. Rilanciarlo non fa danni.
 */
function installa() {
  var dati = {};
  ['profumi', 'note', 'layering', 'consigli'].forEach(function (n) {
    var r = UrlFetchApp.fetch(REPO + 'data/' + n + '.json', { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) {
      throw new Error('non riesco a leggere data/' + n + '.json dal repo (HTTP ' +
                      r.getResponseCode() + '). Il repo e\' pubblico?');
    }
    dati[n] = JSON.parse(r.getContentText());
  });

  var resoconto = [];
  resoconto.push(estendiProfumi_(dati.profumi));
  resoconto.push(creaTab_(TAB.layering,
    ['gruppo', 'tag', 'nome', 'sommario', 'come', 'risultato', 'perche', 'quando'],
    dati.layering.map(function (l) {
      return [l.g, l.t, l.n, l.s, l.come, l.ris, l.perche, l.quando];
    })));
  resoconto.push(creaTab_(TAB.consigli, ['gruppo', 'nome', 'lacuna'],
    dati.consigli.map(function (c) { return [c.g, c.n, c.gap]; })));
  var voci = [];
  dati.consigli.forEach(function (c) {
    (c.voci || []).forEach(function (v) { voci.push([c.n, v.t, v.d]); });
  });
  resoconto.push(creaTab_(TAB.consigliVoci, ['consiglio', 'titolo', 'dettaglio'], voci));
  resoconto.push(creaTab_(TAB.note, ['nota'], dati.note.map(function (n) { return [n]; })));

  var testo = resoconto.join('\n');
  Logger.log(testo);
  try { SpreadsheetApp.getActive().toast(testo, 'Sillage — installazione', 30); } catch (e) {}
  return testo;
}

/** Aggiunge le colonne mancanti alla tab Profumi e riempie solo le celle vuote. */
function estendiProfumi_(profumi) {
  var f = foglio_(TAB.profumi);
  var testa = f.getRange(1, 1, 1, f.getLastColumn()).getDisplayValues()[0]
              .map(function (c) { return String(c).trim(); });

  var aggiunte = COLONNE_NUOVE.filter(function (c) { return testa.indexOf(c) < 0; });
  if (aggiunte.length) {
    f.getRange(1, testa.length + 1, 1, aggiunte.length).setValues([aggiunte]);
    testa = testa.concat(aggiunte);
  }

  var ultima = f.getLastRow();
  if (ultima < 2) return 'Profumi: nessuna riga da riempire';
  var griglia = f.getRange(2, 1, ultima - 1, testa.length).getDisplayValues();
  var colId = testa.indexOf('id');
  var perId = {};
  profumi.forEach(function (p) { perId[String(p.id)] = p; });

  // campo JSON da cui prendere il valore di ogni colonna del foglio
  var DA = {
    piramide: 'note', stagione: 'stagione', momento: 'momento', colore: 'colore',
    quotidiano: 'quotidiano', formale: 'formale', informale: 'informale',
    appuntamento: 'appuntamento', casa: 'casa', festivita: 'festivita',
    descrizione: 'desc', clone_di: 'dupe', img: 'img'
  };

  var scritte = 0;
  griglia.forEach(function (riga, i) {
    var p = perId[String(riga[colId]).trim()];
    if (!p) return;
    testa.forEach(function (col, j) {
      var vuota = String(riga[j]).trim() === '';
      // img: si sovrascrive anche il vecchio segnaposto, ora l'immagine vera esiste
      var segnaposto = col === 'img' && /placeholder\.svg$/.test(String(riga[j]));
      if (col === 'nuovo') {
        if (vuota) { riga[j] = p.nuovo ? 'si' : 'no'; scritte++; }
        return;
      }
      var campo = DA[col];
      if (!campo || !(vuota || segnaposto)) return;
      var v = p[campo];
      if (v === undefined || v === null || v === '') return;
      riga[j] = v;
      scritte++;
    });
  });
  f.getRange(2, 1, griglia.length, testa.length).setValues(griglia);
  return 'Profumi: ' + aggiunte.length + ' colonne aggiunte (' +
         (aggiunte.join(', ') || 'nessuna') + '), ' + scritte + ' celle riempite';
}

/** Crea la tab se manca e la riempie. Se esiste gia', non la tocca. */
function creaTab_(nome, intestazione, righe) {
  var ss = SpreadsheetApp.getActive();
  if (ss.getSheetByName(nome)) return nome + ': esiste gia, lasciata com\'e';
  var f = ss.insertSheet(nome);
  f.getRange(1, 1, 1, intestazione.length).setValues([intestazione]).setFontWeight('bold');
  if (righe.length) f.getRange(2, 1, righe.length, intestazione.length).setValues(righe);
  f.setFrozenRows(1);
  f.autoResizeColumns(1, intestazione.length);
  return nome + ': creata con ' + righe.length + ' righe';
}
