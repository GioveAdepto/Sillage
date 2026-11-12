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
 *           Con azione=leggi e la chiave giusta restituisce tutto, diario compreso.
 *           Con azione=grezzo e azione=specchio (con la chiave) il database
 *           legge le tab cosi' come sono e le riscrive: vedi in fondo.
 *
 * DA NOVEMBRE 2026 L'ORIGINALE E' IL DATABASE (ponte/LEGGIMI.md): questo
 * foglio ne e' una copia, riscritta dopo ogni modifica. Quello che cambi a
 * mano qui viene sovrascritto alla copia successiva.
 *
 * LA CHIAVE. Il link del Web App e' scritto nel codice dell'app, e il repo e'
 * pubblico: chiunque puo' trovarlo. Per questo il diario si legge e si scrive,
 * e il residuo si cambia, solo con la chiave di Sillage. La chiave sta nelle
 * proprieta' dello script (Impostazioni progetto ▸ Proprieta' script ▸ CHIAVE),
 * mai nel repo. Senza la chiave doGet() risponde lo stesso, ma senza il
 * diario. azione=applica resta libera: scrive solo quello che e' gia' nel repo.
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
/** Tutto il foglio in JSON, diario compreso: dalla cache se c'e'. */
function corpo_(e) {
  var cache = CacheService.getScriptCache();
  var salta = e && e.parameter && e.parameter.fresco === '1';
  var corpo = salta ? null : cache.get('dati');
  if (!corpo) {
    corpo = JSON.stringify(tutto_());
    try { cache.put('dati', corpo, CACHE_SEC); } catch (err) { /* oltre 100 KB: si serve senza cache */ }
  }
  return corpo;
}

/** Lo stesso JSON senza il diario, per chi non ha la chiave. */
function senzaDiario_(corpo) {
  var d = JSON.parse(corpo);
  delete d.diario;
  d.diarioChiuso = true;
  return JSON.stringify(d);
}

function json_(testo) {
  return ContentService.createTextOutput(testo).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return json_(senzaDiario_(corpo_(e)));
}

// ── LA CHIAVE ─────────────────────────────────────────────────────────────
/* Arriva nel corpo della richiesta POST, non nell'indirizzo, cosi' non
   finisce nei registri. Senza la proprieta' CHIAVE non passa niente: meglio
   un diario fermo (l'app tiene le voci in coda) che un diario aperto. */
function chiaveGiusta_(e) {
  var vera = PropertiesService.getScriptProperties().getProperty('CHIAVE');
  var data = e && e.parameter && e.parameter.chiave;
  return !!vera && !!data && String(data).trim() === String(vera).trim();
}

/* "sconosciuta:" non e' un caso: le versioni vecchie dell'app tengono in coda
   una voce rifiutata con questa parola, e la riprovano dopo. Senza, la
   butterebbero via. */
var SENZA_CHIAVE = { errore: 'chiave sconosciuta: manca o non e\' quella giusta' };

// ── APPLICAZIONE DA FUORI ─────────────────────────────────────────────────
/* POST e non GET: un link aperto per sbaglio, o un crawler, non scrive niente.
   applica non chiede la chiave: chi lo chiama può solo applicare quello che
   è già nel repo, e rilanciare non fa danni. */
function doPost(e) {
  var azione = e && e.parameter && e.parameter.azione;
  var esito;
  if (azione === 'leggi') {
    var corpo = corpo_(e);
    return json_(chiaveGiusta_(e) ? corpo : senzaDiario_(corpo));
  }
  if (azione === 'grezzo' || azione === 'specchio') {
    if (!chiaveGiusta_(e)) return json_(JSON.stringify(SENZA_CHIAVE));
    if (azione === 'grezzo') return json_(JSON.stringify(grezzo_()));
    var l = LockService.getScriptLock();
    l.waitLock(30000);
    try { esito = specchio_(JSON.parse(e.parameter.dati || '{}')); }
    finally { l.releaseLock(); }
    return json_(JSON.stringify(esito));
  }
  if (['applica', 'diario', 'residuo'].indexOf(azione) < 0) {
    esito = { errore: 'azione sconosciuta: ' + azione };
  } else if (azione !== 'applica' && !chiaveGiusta_(e)) {
    esito = SENZA_CHIAVE;
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

// ── IL FOGLIO COME COPIA DEL DATABASE ─────────────────────────────────────
/* Da quando l'originale e' il database (ponte/LEGGIMI.md), il foglio ne e'
   una copia da guardare. Due azioni, tutte e due con la chiave:
   azione=grezzo    le tab di Sillage cosi' come sono, colonna per colonna:
                    serve una volta, per portare il foglio nel database.
   azione=specchio  riscrive le tab con quello che manda il database
                    (dati = {tabs: {Nome: {colonne, righe}}}). Le colonne del
                    foglio restano dove sono, quelle nuove vanno in fondo.
                    Tutto viene scritto come testo semplice: niente decimali
                    che diventano orari. */
var TAB_SPECCHIO = ['Profumi', 'Layering', 'Consigli', 'ConsigliVoci', 'Note', 'Diario'];

function grezzo_() {
  var ss = SpreadsheetApp.getActive(), tabs = {};
  TAB_SPECCHIO.forEach(function (nome) {
    var f = ss.getSheetByName(nome);
    if (!f || !f.getLastColumn()) return;
    var testa = f.getRange(1, 1, 1, f.getLastColumn()).getDisplayValues()[0]
      .map(function (c) { return String(c).trim(); });
    tabs[nome] = { colonne: testa.filter(function (c) { return c; }), righe: righe_(nome) };
  });
  return { ok: true, tabs: tabs };
}

function specchio_(d) {
  var ss = SpreadsheetApp.getActive(), esito = { ok: true, tab: {} };
  Object.keys((d && d.tabs) || {}).forEach(function (nome) {
    var t = d.tabs[nome];
    if (TAB_SPECCHIO.indexOf(nome) < 0 || !t || !Array.isArray(t.righe)) return;
    // un database vuoto per errore non deve svuotare il foglio
    if (nome === TAB.profumi && !t.righe.length) { esito.tab[nome] = 'saltata: nessun profumo'; return; }
    var f = ss.getSheetByName(nome) || ss.insertSheet(nome);
    var larga = f.getLastColumn();
    var testa = larga ? f.getRange(1, 1, 1, larga).getDisplayValues()[0]
      .map(function (c) { return String(c).trim(); }) : [];
    (t.colonne || []).forEach(function (c) { if (c && testa.indexOf(c) < 0) testa.push(c); });
    var valori = t.righe.map(function (r) {
      return testa.map(function (c) {
        var v = c ? r[c] : '';
        return v === undefined || v === null ? '' : String(v);
      });
    });
    f.getRange(1, 1, 1, testa.length).setValues([testa]).setFontWeight('bold');
    var ultima = f.getLastRow();
    if (ultima > 1) f.getRange(2, 1, ultima - 1, Math.max(testa.length, larga)).clearContent();
    if (valori.length) f.getRange(2, 1, valori.length, testa.length).setNumberFormat('@').setValues(valori);
    esito.tab[nome] = valori.length;
  });
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
