/**
 * Sillage — backend di sola lettura sul foglio "sillage-profumi".
 *
 * doGet()   pubblica il contenuto del foglio come JSON, gia' nella forma che
 *           l'interfaccia si aspetta (le colonne italiane del foglio vengono
 *           tradotte nei nomi di campo usati da js/app.js).
 * installa() da lanciare UNA VOLTA dall'editor: aggiunge al foglio le colonne
 *           e le tab che ancora non ci sono, riempiendole con i dati del repo.
 * doPost()  con azione=residuo salva quanto resta in una boccetta.
 *           Con azione=diario segna (o toglie) un profumo indossato: vedi
 *           Diario.gs. Con azione=applica lancia aggiungi() e poi correggi(): chi lavora
 *           al repo applica le sue modifiche al foglio senza passare
 *           dall'editor. Scrive solo quello che sta in data/aggiunte.json e
 *           data/correzioni.json su main, con le stesse guardie di sempre.
 *
 * Il foglio resta la sorgente di verita'. I file data/*.json nel repo sono una
 * copia di sicurezza: l'app li usa se questo servizio non risponde.
 */

// ── CONFIGURAZIONE ────────────────────────────────────────────────────────
var REPO = 'https://raw.githubusercontent.com/GioveAdepto/Sillage/main/';
var CACHE_SEC = 300;        // il foglio cambia di rado: 5 minuti bastano

var TAB = {
  profumi:      'Profumi',
  layering:     'Layering',
  consigli:     'Consigli',
  consigliVoci: 'ConsigliVoci',
  note:         'Note'
};

// colonna del foglio → campo JSON. Le colonne non elencate passano col loro nome.
var RINOMINA = {
  marchio: 'brand', profumo: 'name', concentrazione: 'conc',
  longevita_h: 'longevita', piramide: 'note', note: 'noteElenco',
  clone_di: 'dupe', clone_stato: 'cloneStato', descrizione: 'desc',
  giorno_pct: 'giornoPct', formato_ml: 'formatoMl', tipo_possesso: 'tipoPossesso',
  num_flaconi: 'numFlaconi', residuo_pct: 'residuoPct', note_personali: 'notePersonali'
};

var ELENCHI  = ['accordi', 'note'];                    // celle separate da |
var NUMERICI = ['id', 'longevita_h', 'rating', 'voti', 'giorno_pct', 'inverno',
                'primavera', 'estate', 'autunno', 'formato_ml', 'num_flaconi', 'residuo_pct'];
var TRISTATO = ['ufficio', 'palestra', 'serata', 'quotidiano', 'formale',
                'informale', 'appuntamento', 'casa', 'festivita'];

var COLONNE_NUOVE = ['piramide', 'stagione', 'momento', 'colore', 'quotidiano',
                     'formale', 'informale', 'appuntamento', 'casa', 'festivita',
                     'nuovo', 'descrizione'];

// ── LETTURA ───────────────────────────────────────────────────────────────
function foglio_(nome) {
  var f = SpreadsheetApp.getActive().getSheetByName(nome);
  if (!f) throw new Error('manca la tab "' + nome + '" — lancia installa()');
  return f;
}

/** Restituisce la tab come array di oggetti, con l'intestazione come chiavi. */
function righe_(nome) {
  var dati = foglio_(nome).getDataRange().getDisplayValues();
  if (dati.length < 2) return [];
  var testa = dati[0].map(function (c) { return String(c).trim(); });
  return dati.slice(1)
    .filter(function (r) { return r.join('').trim() !== ''; })
    .map(function (r) {
      var o = {};
      testa.forEach(function (col, i) { if (col) o[col] = String(r[i]).trim(); });
      return o;
    });
}

function numero_(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function tristato_(v) {
  v = String(v).toLowerCase().trim();
  if (v === 'moderazione' || v === 'si-mod') return 'si-mod';
  return v === 'si' ? 'si' : 'no';
}

function profumi_() {
  return righe_(TAB.profumi)
    .filter(function (r) { return String(r.attivo).toLowerCase() !== 'no'; })
    .map(function (r) {
      var p = {};
      Object.keys(r).forEach(function (col) {
        var chiave = RINOMINA[col] || col;
        var v = r[col];
        if (ELENCHI.indexOf(col) >= 0) {
          p[chiave] = v ? v.split('|').map(function (x) { return x.trim(); })
                           .filter(function (x) { return x; }) : [];
        } else if (NUMERICI.indexOf(col) >= 0) {
          p[chiave] = numero_(v);
        } else if (TRISTATO.indexOf(col) >= 0) {
          p[chiave] = tristato_(v);
        } else {
          p[chiave] = v;
        }
      });
      p.stagioni = { inverno: numero_(r.inverno), primavera: numero_(r.primavera),
                     estate: numero_(r.estate), autunno: numero_(r.autunno) };
      ['inverno', 'primavera', 'estate', 'autunno'].forEach(function (s) { delete p[s]; });
      // l'interfaccia mostra la piramide; senza, ripiega sull'elenco delle note
      if (!p.note && p.noteElenco && p.noteElenco.length) p.note = p.noteElenco.join(' · ');
      p.nuovo = String(r.nuovo).toLowerCase() === 'si';
      if (!p.nuovo) delete p.nuovo;
      if (!p.dupe) delete p.dupe;
      if (!p.colore) p.colore = 'verde';
      if (!p.stagione) p.stagione = 'tutto';
      if (!p.momento) p.momento = 'entrambi';
      return p;
    });
}

function layering_() {
  return righe_(TAB.layering).map(function (r) {
    return { g: r.gruppo, t: r.tag, n: r.nome, s: r.sommario,
             come: r.come, ris: r.risultato, perche: r.perche, quando: r.quando };
  });
}

function consigli_() {
  var voci = {};
  righe_(TAB.consigliVoci).forEach(function (r) {
    (voci[r.consiglio] = voci[r.consiglio] || []).push({ t: r.titolo, d: r.dettaglio });
  });
  return righe_(TAB.consigli).map(function (r) {
    return { g: r.gruppo, n: r.nome, gap: r.lacuna, voci: voci[r.nome] || [] };
  });
}

function note_() {
  return righe_(TAB.note).map(function (r) { return r.nota; })
    .filter(function (n) { return n; });
}

function tutto_() {
  return {
    profumi:   profumi_(),
    note:      note_(),
    layering:  layering_(),
    consigli:  consigli_(),
    diario:    diario_(),
    aggiornato: new Date().toISOString()
  };
}

// ── PUBBLICAZIONE ─────────────────────────────────────────────────────────
function doGet(e) {
  var cache = CacheService.getScriptCache();
  var salta = e && e.parameter && e.parameter.fresco === '1';
  var corpo = salta ? null : cache.get('dati');
  if (!corpo) {
    corpo = JSON.stringify(tutto_());
    try { cache.put('dati', corpo, CACHE_SEC); } catch (err) { /* oltre 100 KB: si serve senza cache */ }
  }
  return ContentService.createTextOutput(corpo)
    .setMimeType(ContentService.MimeType.JSON);
}

// ── APPLICAZIONE DA FUORI ─────────────────────────────────────────────────
/* POST e non GET: un link aperto per sbaglio, o un crawler, non scrive niente.
   Non serve una password: chi lo chiama può solo applicare quello che è già
   nel repo, e rilanciare non fa danni. */
function doPost(e) {
  var azione = e && e.parameter && e.parameter.azione;
  var esito;
  if (['applica', 'diario', 'residuo'].indexOf(azione) < 0) {
    esito = { errore: 'azione sconosciuta: ' + azione };
  } else {
    var lucchetto = LockService.getScriptLock();
    lucchetto.waitLock(30000);            // due lanci insieme non si pestano
    try {
      if (azione === 'applica') esito = applica();
      else if (azione === 'residuo') {
        esito = scriviResiduo_(e.parameter);
        CacheService.getScriptCache().remove('dati');
      }
      else {
        esito = scriviDiario_(e.parameter);   // vedi Diario.gs
        CacheService.getScriptCache().remove('dati');
      }
    } finally { lucchetto.releaseLock(); }
  }
  return ContentService.createTextOutput(JSON.stringify(esito))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Quanto resta in una boccetta, scelto a mano nell'app: uno dei sette tagli
    (piena 100, usata poco 90, tre quarti 75, mezza 50, un quarto 25, in fine
    10, finita 0). Altri valori vengono rifiutati: il link e' pubblico. */
function scriviResiduo_(p) {
  var id = Number(p.id), v = Number(p.valore);
  if (!id || [100, 90, 75, 50, 25, 10, 0].indexOf(v) < 0) return { errore: 'valore non valido' };
  var f = foglio_(TAB.profumi), g = f.getDataRange().getDisplayValues();
  var testa = g[0].map(function (c) { return String(c).trim(); });
  var cId = testa.indexOf('id'), cR = testa.indexOf('residuo_pct');
  if (cR < 0) return { errore: 'manca la colonna residuo_pct' };
  for (var i = 1; i < g.length; i++) {
    if (Number(g[i][cId]) === id) { f.getRange(i + 1, cR + 1).setValue(v); return { ok: true }; }
  }
  return { errore: 'profumo sconosciuto: ' + id };
}

/* Il foglio e' in italiano: una stringa come "3.78" scritta con setValue viene
   letta come un orario (3 ore e 78 minuti, cioe' 4:18). I numeri con il punto
   decimale si scrivono quindi come testo, con l'apostrofo davanti. */
function valoreFoglio_(v) {
  return (typeof v === 'string' && /^-?\d+\.\d+$/.test(v.trim())) ? "'" + v.trim() : v;
}

/** Prima le righe nuove, poi le correzioni: una correzione può toccare una
    riga appena aggiunta. Poi via la cache, così l'app vede subito il foglio. */
function applica() {
  var esito = { aggiunte: aggiungi(), correzioni: correggi() };
  CacheService.getScriptCache().remove('dati');
  return esito;
}

/** Comodo per controllare dall'editor che la lettura funzioni. */
function prova() {
  var d = tutto_();
  Logger.log('profumi: %s · note: %s · layering: %s · consigli: %s',
             d.profumi.length, d.note.length, d.layering.length, d.consigli.length);
  Logger.log(JSON.stringify(d.profumi[0], null, 1));
}
