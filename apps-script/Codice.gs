/**
 * Sillage — backend di sola lettura sul foglio "sillage-profumi".
 *
 * doGet()   pubblica il contenuto del foglio come JSON, gia' nella forma che
 *           l'interfaccia si aspetta (le colonne italiane del foglio vengono
 *           tradotte nei nomi di campo usati da js/app.js).
 * installa() da lanciare UNA VOLTA dall'editor: aggiunge al foglio le colonne
 *           e le tab che ancora non ci sono, riempiendole con i dati del repo.
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

/** Comodo per controllare dall'editor che la lettura funzioni. */
function prova() {
  var d = tutto_();
  Logger.log('profumi: %s · note: %s · layering: %s · consigli: %s',
             d.profumi.length, d.note.length, d.layering.length, d.consigli.length);
  Logger.log(JSON.stringify(d.profumi[0], null, 1));
}
