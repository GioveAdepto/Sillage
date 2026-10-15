/**
 * Sillage — il diario d'uso.
 *
 * Una riga per ogni volta che indossi un profumo: la scrive l'app, dal
 * pulsante «Lo metto oggi» nella scheda. La tab "Diario" nasce da sola alla
 * prima voce. Si può anche correggere a mano: basta lasciare le colonne
 * data (AAAA-MM-GG), id e t.
 *
 * Un layering sono due righe con lo stesso t a 13 cifre più una cifra di
 * ruolo (1 sotto, 2 sopra): l'app le riconosce da sola e le mostra come coppia.
 *
 * Ogni voce puo' avere un appunto (nota, fino a 200 caratteri) e un voto da 1
 * a 5 su com'e' andata: op=nota li scrive sulla riga con quel t. Le colonne
 * nota e voto nascono da sole la prima volta.
 *
 * Il link del Web App è pubblico, quindi ogni voce viene controllata: il
 * profumo deve esistere, la data dev'essere una data, e in un giorno non
 * entrano più di dieci voci.
 */

var TAB_DIARIO = 'Diario';

function foglioDiario_() {
  var ss = SpreadsheetApp.getActive();
  var f = ss.getSheetByName(TAB_DIARIO);
  if (f) return f;
  f = ss.insertSheet(TAB_DIARIO);
  // testo semplice: se no il foglio trasforma la data in una data locale e
  // il numero t in notazione scientifica, e la lettura non li riconosce più
  f.getRange('A:D').setNumberFormat('@');
  f.getRange(1, 1, 1, 4).setValues([['data', 'id', 'profumo', 't']]).setFontWeight('bold');
  f.setFrozenRows(1);
  return f;
}

/** Le voci del diario, per doGet. Senza la tab il diario è vuoto. */
function diario_() {
  if (!SpreadsheetApp.getActive().getSheetByName(TAB_DIARIO)) return [];
  return righe_(TAB_DIARIO)
    .map(function (r) { return { data: r.data, id: numero_(r.id), t: String(r.t),
                                 nota: r.nota || '', voto: numero_(r.voto) }; })
    .filter(function (v) { return v.id && /^\d{4}-\d{2}-\d{2}$/.test(v.data); });
}

/** L'appunto e il voto di una voce. Testo semplice: un appunto che comincia
    con = + - @ non deve diventare una formula. */
function scriviNota_(f, testa, riga, p) {
  testa = testa.map(function (c) { return String(c).trim(); });
  ['nota', 'voto'].forEach(function (k) {
    if (testa.indexOf(k) < 0) { testa.push(k); f.getRange(1, testa.length).setValue(k).setFontWeight('bold'); }
  });
  var nota = String(p.nota || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (/^[=+\-@]/.test(nota)) nota = "'" + nota;
  var voto = Number(p.voto);
  voto = voto >= 1 && voto <= 5 ? Math.round(voto) : '';
  f.getRange(riga, testa.indexOf('nota') + 1).setValue(nota);
  f.getRange(riga, testa.indexOf('voto') + 1).setValue(voto);
  return { ok: true, nota: true };
}

/** op=metti aggiunge una voce, op=togli la toglie. Rilanciare non duplica:
    t identifica la voce. */
function scriviDiario_(p) {
  var id = Number(p.id), data = String(p.data || ''), t = String(p.t || '');
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{10,16}$/.test(t)) {
    return { errore: 'voce non valida' };
  }
  var profumo = righe_(TAB.profumi).filter(function (r) { return Number(r.id) === id; })[0];
  if (!profumo) return { errore: 'profumo sconosciuto: ' + id };

  var f = foglioDiario_();
  var g = f.getDataRange().getDisplayValues();
  var cT = g[0].indexOf('t'), cData = g[0].indexOf('data');
  for (var i = g.length - 1; i >= 1; i--) {
    if (String(g[i][cT]) === t) {
      if (p.op === 'togli') { f.deleteRow(i + 1); return { ok: true, tolta: true }; }
      if (p.op === 'nota') return scriviNota_(f, g[0], i + 1, p);
      return { ok: true, gia: true };
    }
  }
  if (p.op === 'togli') return { ok: true, assente: true };
  if (p.op === 'nota') return { errore: 'voce non trovata' };

  var nelGiorno = g.filter(function (r) { return r[cData] === data; }).length;
  if (nelGiorno >= 10) return { errore: 'troppe voci per il ' + data };
  // un t di 14 cifre e' meta' di un layering: l'ultima cifra dice il ruolo
  var ruolo = t.length === 14 ? (t.slice(-1) === '1' ? ' (layering, sotto)' : ' (layering, sopra)') : '';
  f.appendRow([data, String(id), profumo.marchio + ' ' + profumo.profumo + ruolo, t]);
  return { ok: true };
}
