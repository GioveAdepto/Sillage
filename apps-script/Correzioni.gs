/**
 * Sillage — correzioni puntuali al foglio.
 *
 * Il foglio è la sorgente di verità, ma chi lavora al repo non ha modo di
 * scriverci: questo è il canale. Ogni correzione dichiara il valore che si
 * aspetta di trovare (`da`) e quello che vuole mettere (`a`).
 *
 * `correggi()` scrive **solo** se la cella contiene ancora `da`. Se nel
 * frattempo l'hai cambiata tu, la salta e te lo dice: le tue modifiche a mano
 * vincono sempre su quelle in coda qui. Rilanciarlo non fa danni.
 *
 * Per una prova a vuoto: `correggi(true)` dice cosa farebbe senza toccare nulla.
 */
var CORREZIONI = [
  {
    id: 26, colonna: 'ufficio', da: 'moderazione', a: 'no',
    perche: 'Atlas ha scia Enorme: in uno spazio chiuso condiviso non e nemmeno ' +
            'un forse. Con "moderazione" rientrava nel filtro Ufficio.'
  }
];

function correggi(soloProva) {
  var f = foglio_(TAB.profumi);
  var griglia = f.getDataRange().getDisplayValues();
  var testa = griglia[0].map(function (c) { return String(c).trim(); });
  var colId = testa.indexOf('id');
  if (colId < 0) throw new Error('la tab Profumi non ha una colonna "id"');

  // id → numero di riga nel foglio (1-based, intestazione compresa)
  var riga = {};
  for (var i = 1; i < griglia.length; i++) {
    var v = String(griglia[i][colId]).trim();
    if (v) riga[v] = i + 1;
  }

  var esiti = [];
  CORREZIONI.forEach(function (c) {
    var etichetta = '#' + c.id + ' ' + c.colonna;
    var r = riga[String(c.id)];
    var colonna = testa.indexOf(c.colonna);

    if (!r) { esiti.push(etichetta + ': nessuna riga con questo id'); return; }
    if (colonna < 0) { esiti.push(etichetta + ': colonna assente nel foglio'); return; }

    var attuale = String(griglia[r - 1][colonna]).trim();
    if (attuale.toLowerCase() === String(c.a).toLowerCase()) {
      esiti.push(etichetta + ': gia a posto (' + c.a + ')');
      return;
    }
    if (attuale.toLowerCase() !== String(c.da).toLowerCase()) {
      esiti.push(etichetta + ': SALTATA — mi aspettavo "' + c.da + '", trovo "' +
                 attuale + '". La tua modifica resta.');
      return;
    }
    if (soloProva) {
      esiti.push(etichetta + ': (prova) "' + attuale + '" -> "' + c.a + '"');
      return;
    }
    f.getRange(r, colonna + 1).setValue(c.a);
    esiti.push(etichetta + ': "' + attuale + '" -> "' + c.a + '" — ' + c.perche);
  });

  var testo = (soloProva ? 'PROVA A VUOTO — niente e stato scritto\n' : '') +
              (esiti.join('\n') || 'nessuna correzione in coda');
  Logger.log(testo);
  try { SpreadsheetApp.getActive().toast(testo, 'Sillage — correzioni', 30); } catch (e) {}
  return testo;
}
