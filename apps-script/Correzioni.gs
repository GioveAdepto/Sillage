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
  },

  /* Asad (#30) era entrato nella collezione senza flag d'uso: l'HTML da cui
     sono stati importati gli altri non aveva quella riga, quindi installa()
     ha messo "no" ovunque e la scheda usciva con tutti i pallini spenti.
     I valori qui sotto seguono il gruppo a cui appartiene — ambrati speziati
     da sera A/I con ufficio "moderazione": Stronger With You Absolutely (#10)
     e Uomo Signature (#21) hanno esattamente questa combinazione. */
  { id: 30, colonna: 'formale',      da: 'no', a: 'si',
    perche: 'ambrato speziato da sera: come SWY Absolutely e Uomo Signature' },
  { id: 30, colonna: 'informale',    da: 'no', a: 'si',
    perche: 'stesso gruppo' },
  { id: 30, colonna: 'appuntamento', da: 'no', a: 'si',
    perche: 'scia forte e fondo caldo: e il suo terreno' },
  { id: 30, colonna: 'festivita',    da: 'no', a: 'si',
    perche: 'boozy speziato invernale' },

  /* La piramide di Asad mancava: nella cella c'era l'elenco piatto delle note,
     che sembrava una piramide senza esserlo. Questi valori vengono dalla scheda
     Fragrantica del profumo, controllata il 2026-09-05. */
  { id: 30, colonna: 'piramide',
    da: 'Pepe · Vaniglia · Ambra · Tabacco · Legno Secco · Patchouli',
    a:  'Testa: pepe nero, tabacco, ananas · Cuore: patchouli, caffè, iris ' +
        '· Fondo: vaniglia, ambra, legno secco, benzoino, labdano',
    perche: 'piramide reale dalla scheda Fragrantica' },
  { id: 30, colonna: 'note',
    da: 'Pepe|Vaniglia|Ambra|Tabacco|Legno Secco|Patchouli',
    a:  'Pepe Nero|Tabacco|Ananas|Patchouli|Caffè|Iris|Vaniglia|Ambra|Legno Secco|Benzoino|Labdano',
    perche: 'mancavano ananas, caffe, iris, benzoino e labdano' },

  /* Encre Noire Sport aveva ufficio "no" mentre l'originale, che la sua stessa
     scheda chiama polarizzante, era "si". Ha il profilo identico a Cool Water
     (P/E, da giorno, quotidiano, informale, palestra, casa), che e' ufficio. */
  { id: 25, colonna: 'ufficio', da: 'no', a: 'si',
    perche: 'stesso profilo di Cool Water, ed e piu accessibile dell Encre Noire' },

  /* ── PIRAMIDI RISCRITTE DA FRAGRANTICA ────────────────────────────────────
     Controllo del 2026-09-05 su 30 schede. Qui ci sono le 27 che cambiano nella
     sostanza. Fuori restano: Sunrise on the Red Sand Dunes (gia identica),
     Ginepro Nero (stesse note, solo in ordine diverso), Asad (gia in coda
     sopra) e ANGELSEAR, che su Fragrantica non esiste.

     Attenzione: qualche piramide si accorcia. Prada L'Homme Intense perde 53
     caratteri perche' meta' delle note che aveva erano del L'Homme normale, non
     dell'Intense; Encre Noire perde la distinzione fra vetiver haitiano e
     bourbon, che Fragrantica non fa. Il testo che vince e' quello della scheda. */

  { id: 1, colonna: 'piramide',
    da: "Testa: lavanda, limone, bergamotto \u00b7 Cuore: geranio, mimosa, note aromatiche \u00b7 Fondo: vetiver, rum, muschio di quercia, muschio",
    a:  "Testa: rum, limone, fiore d'arancio \u00b7 Cuore: lavanda, mimosa, chiodi di garofano, noce moscata, geranio bourbon, pepe nero \u00b7 Fondo: vetiver, muschio di quercia, patchouli",
    perche: 'piramide dalla scheda Fragrantica di Helan Vetiver & Rum EDT' },
  { id: 2, colonna: 'piramide',
    da: "Testa: cedro (agrume), bacche di ginepro, pepe Timur \u00b7 Cuore: note minerali, note aromatiche \u00b7 Fondo: note legnose, vetiver",
    a:  "Testa: cedro \u00b7 Cuore: bacche di ginepro, pepe timut \u00b7 Fondo: note minerali, note legnose",
    perche: 'piramide dalla scheda Fragrantica di Hermès Terre d Hermès Eau Givrée EDP' },
  { id: 3, colonna: 'piramide',
    da: "Testa: bergamotto, mandarino, note marine, salvia sclarea \u00b7 Cuore: note minerali, geranio, rosa, freesia \u00b7 Fondo: muschio, patchouli, incenso, legno di cashmere",
    a:  "Testa: note marine, mandarino verde \u00b7 Cuore: salvia sclarea, lavanda, geranio \u00b7 Fondo: note minerali, vetiver, patchouli",
    perche: 'piramide dalla scheda Fragrantica di Giorgio Armani Acqua di Giò EDP' },
  { id: 4, colonna: 'piramide',
    da: "Testa: bacche di ginepro, cipresso, bergamotto, limone \u00b7 Cuore: rosmarino, violetta, eliotropio, coriandolo \u00b7 Fondo: muschio, cedro, legni",
    a:  "Testa: bacche di ginepro, rosmarino, bergamotto di calabria \u00b7 Cuore: cipresso, violetta, eliotropio \u00b7 Fondo: muschio bianco, legno di cedro, foglia di patchouli",
    perche: 'piramide dalla scheda Fragrantica di Gucci Guilty Cologne Pour Homme EDT' },
  { id: 5, colonna: 'piramide',
    da: "Testa: bergamotto, limone, lime \u00b7 Cuore: note fresche speziate \u00b7 Fondo: ambroxan, muschio, ribes nero, legni",
    a:  "Testa: bergamotto, limone, lime, ribes nero, foglia di violetta, zenzero \u00b7 Cuore: rosa, iris, gelsomino \u00b7 Fondo: ambroxan, muschio, sandalo, legno di cedro",
    perche: 'piramide dalla scheda Fragrantica di Armaf Club de Nuit Sillage EDP' },
  { id: 6, colonna: 'piramide',
    da: "Testa: acqua, bergamotto, limone, mela verde \u00b7 Cuore: prugna, gelsomino, note fruttate \u00b7 Fondo: ambra grigia, muschio, patchouli",
    a:  "Testa: mela, bergamotto, limone, cannella \u00b7 Cuore: note acquatiche, prugna, fiore d'arancio, cardamomo \u00b7 Fondo: ambra grigia, muschio, patchouli, legno marino",
    perche: 'piramide dalla scheda Fragrantica di Rasasi Hawas for Him EDP' },
  { id: 7, colonna: 'piramide',
    da: "Testa: agrumi (pompelmo), zenzero \u00b7 Cuore: ambra, note legnose \u00b7 Fondo: muschio, spezie, patchouli",
    a:  "Testa: agrumi \u00b7 Cuore: note legnose, ambra \u00b7 Fondo: muschio, spezie, patchouli",
    perche: 'piramide dalla scheda Fragrantica di Rue Broca Théorème Homme EDP' },
  { id: 8, colonna: 'piramide',
    da: "Testa: mandarino, pepe, limone, bergamotto, foglia di t\u00e8, mat\u00e9 \u00b7 Cuore: pimento, sesamo, cardamomo \u00b7 Fondo: vetiver, cedro, muschio bianco",
    a:  "Testa: mandarino, pepe, limone, bergamotto, foglia di t\u00e8, erba mate \u00b7 Cuore: pimento, sesamo \u00b7 Fondo: vetiver, legno di cedro, muschio bianco",
    perche: 'piramide dalla scheda Fragrantica di Davidoff Adventure EDT' },
  { id: 9, colonna: 'piramide',
    da: "Testa: note marine, agrumi, mandarino siciliano, bergamotto \u00b7 Cuore: lavanda, salvia sclarea, rosmarino, geranio \u00b7 Fondo: orchidea vanigliata, vetiver haitiano, patchouli, muschio di quercia",
    a:  "Testa: note marine, agrumi, mandarino di sicilia \u00b7 Cuore: lavanda, salvia sclarea, rosmarino, pelargonio egiziano \u00b7 Fondo: orchidea vaniglia, vetiver di haiti, patchouli, muschio di quercia",
    perche: 'piramide dalla scheda Fragrantica di Missoni Wave EDT' },
  { id: 10, colonna: 'piramide',
    da: "Testa: bergamotto, davana \u00b7 Cuore: rum, lavanda, salvia, castagna \u00b7 Fondo: vaniglia, elemi, cedro, patchouli",
    a:  "Testa: rum, elemi, bergamotto \u00b7 Cuore: lavanda, davana \u00b7 Fondo: vaniglia del madagascar, castagna, legno di cedro, patchouli",
    perche: 'piramide dalla scheda Fragrantica di Emporio Armani Stronger With You Absolutely Parfum' },
  { id: 11, colonna: 'piramide',
    da: "Testa: note marine, bergamotto, mandarino \u00b7 Cuore: aquozone, rosmarino, note minerali \u00b7 Fondo: patchouli, cipresso, legni",
    a:  "Testa: note marine, aquozone, bergamotto, mandarino verde \u00b7 Cuore: rosmarino, lavanda, cipresso, mastice o lentisco \u00b7 Fondo: note minerali, muschio, patchouli, ambra",
    perche: 'piramide dalla scheda Fragrantica di Giorgio Armani Acqua di Giò Profondo EDP' },
  { id: 12, colonna: 'piramide',
    da: "Testa: pompelmo, coriandolo, basilico \u00b7 Cuore: zenzero, cardamomo, fiore d'arancio, neroli \u00b7 Fondo: tabacco, ambra, cedro",
    a:  "Testa: pompelmo, coriandolo, basilico \u00b7 Cuore: cardamomo, zenzero, fiore d'arancio \u00b7 Fondo: ambra, tabacco, legno di cedro",
    perche: 'piramide dalla scheda Fragrantica di Dolce & Gabbana The One for Men EDP' },
  { id: 14, colonna: 'piramide',
    da: "Testa: menta, mela verde, limone \u00b7 Cuore: fava tonka, ambroxan, geranio \u00b7 Fondo: vaniglia, cedro, vetiver, muschio di quercia, ambra",
    a:  "Testa: menta, mela verde, limone \u00b7 Cuore: fava tonka, ambroxan, geranio \u00b7 Fondo: vaniglia del madagascar, cedro della virginia, cedro dell'atlante, vetiver, muschio di quercia",
    perche: 'piramide dalla scheda Fragrantica di Versace Eros EDT' },
  { id: 15, colonna: 'piramide',
    da: "Testa: menta, mela, limone, mandarino, bergamotto \u00b7 Cuore: ambroxan, geranio, fava tonka, salvia \u00b7 Fondo: vaniglia, cedro, muschio, ambra, patchouli",
    a:  "Testa: menta, mela caramellata, limone, mandarino \u00b7 Cuore: ambroxan, geranio, salvia sclarea \u00b7 Fondo: vaniglia, legno di cedro, sandalo, arancia amara, patchouli, cuoio",
    perche: 'piramide dalla scheda Fragrantica di Versace Eros EDP' },
  { id: 16, colonna: 'piramide',
    da: "Testa: mandarino, pepe del Madagascar, limone, chinotto \u00b7 Cuore: rosmarino, geranio, rosa, pepe rosa \u00b7 Fondo: vaniglia, fava tonka, sandalo, cedro, patchouli, muschio di quercia",
    a:  "Testa: mandarino, pepe del madagascar, limone, chinotto, rosmarino \u00b7 Cuore: geranio, rosa, pepperwood \u00b7 Fondo: vaniglia, fava tonka, sandalo, cedro del texas, patchouli, muschio di quercia",
    perche: 'piramide dalla scheda Fragrantica di Versace Eros Flame EDP' },
  { id: 17, colonna: 'piramide',
    da: "Testa: limone, bergamotto, mela, ribes nero, ananas \u00b7 Cuore: betulla, gelsomino, rosa \u00b7 Fondo: muschio, ambra grigia, vaniglia, legni",
    a:  "Testa: limone, ananas, bergamotto, ribes nero, mela \u00b7 Cuore: betulla, gelsomino, rosa \u00b7 Fondo: muschio, ambra grigia, patchouli, vaniglia",
    perche: 'piramide dalla scheda Fragrantica di Armaf Club de Nuit Intense Man EDT' },
  { id: 18, colonna: 'piramide',
    da: "Testa: menta, lavanda, coriandolo, rosmarino, bergamotto \u00b7 Cuore: geranio, neroli, gelsomino, sandalo, legno di cedro \u00b7 Fondo: muschio, ambra, tabacco, legno di quercia",
    a:  "Testa: acqua di mare, lavanda, menta, note verdi, rosmarino, calone, coriandolo \u00b7 Cuore: sandalo, neroli, geranio, gelsomino \u00b7 Fondo: muschio, muschio di quercia, legno di cedro, tabacco, ambra grigia",
    perche: 'piramide dalla scheda Fragrantica di Davidoff Cool Water EDT' },
  { id: 19, colonna: 'piramide',
    da: "Testa: pimento, lavanda, fiore d'arancio \u00b7 Cuore: rosa, geranio, aceto balsamico \u00b7 Fondo: legno di cedro, patchouli, ambra",
    a:  "Testa: rosa, peperoncino rosso piccante, aceto balsamico, sale \u00b7 Cuore: lavanda, fiore d'arancio, neroli \u00b7 Fondo: legno di cedro, patchouli",
    perche: 'piramide dalla scheda Fragrantica di Gucci Guilty Pour Homme EDP' },
  { id: 20, colonna: 'piramide',
    da: "Testa: bergamotto \u00b7 Cuore: iris, whisky, castagna \u00b7 Fondo: cedro, patchouli, ambra, vaniglia",
    a:  "Testa: bergamotto \u00b7 Cuore: iris, castagna \u00b7 Fondo: whisky, note boschive, ambra",
    perche: 'piramide dalla scheda Fragrantica di Givenchy Gentleman Réserve Privée EDP' },
  { id: 21, colonna: 'piramide',
    da: "Testa: mandarino, cardamomo, pepe nero \u00b7 Cuore: cannella, caff\u00e8 tostato \u00b7 Fondo: fava tonka, cuoio, ambra, sandalo",
    a:  "Testa: mandarino italiano, pepe rosa, pompelmo \u00b7 Cuore: cannella, cardamomo, cipresso \u00b7 Fondo: fava tonka, cuoio, grani di caff\u00e8 tostati, patchouli",
    perche: 'piramide dalla scheda Fragrantica di Salvatore Ferragamo Uomo Signature EDP' },
  { id: 22, colonna: 'piramide',
    da: "Testa: mandarino, neroli, pepe nero \u00b7 Cuore: iris, ambra, patchouli, geranio \u00b7 Fondo: cuoio, fava tonka, sandalo, ambra, cedro",
    a:  "Testa: iris \u00b7 Cuore: ambra, patchouli \u00b7 Fondo: fava tonka, cuoio, sandalo",
    perche: 'piramide dalla scheda Fragrantica di Prada L Homme Intense EDP' },
  { id: 23, colonna: 'piramide',
    da: "Testa: zafferano, note fruttate, lampone \u00b7 Cuore: rosa, cuoio, pelle scamosciata \u00b7 Fondo: olibano (incenso), note legnose, ambra, muschio",
    a:  "Testa: lampone, zafferano, timo \u00b7 Cuore: olibano, gelsomino, artemisia \u00b7 Fondo: cuoio, pelle scamosciata, note legnose, ambra",
    perche: 'piramide dalla scheda Fragrantica di Rasasi La Yuqawam Pour Homme EDP' },
  { id: 24, colonna: 'piramide',
    da: "Testa: cipresso \u00b7 Cuore: vetiver haitiano, vetiver bourbon \u00b7 Fondo: muschio, legno di cashmere",
    a:  "Testa: cipresso \u00b7 Cuore: vetiver \u00b7 Fondo: legno di cashmere, muschio",
    perche: 'piramide dalla scheda Fragrantica di Lalique Encre Noire EDT' },
  { id: 25, colonna: 'piramide',
    da: "Testa: pompelmo, bergamotto, note acquatiche \u00b7 Cuore: cipresso, vetiver, noce moscata \u00b7 Fondo: legno di cashmere, muschio",
    a:  "Testa: pompelmo, bergamotto, noce moscata \u00b7 Cuore: cipresso, note acquatiche, lavanda \u00b7 Fondo: vetiver bourbon, vetiver di haiti, legno di cashmere, muschio",
    perche: 'piramide dalla scheda Fragrantica di Lalique Encre Noire Sport EDT' },
  { id: 26, colonna: 'piramide',
    da: "Testa: note marine, sale, limone \u00b7 Cuore: ambra grigia, note aromatiche \u00b7 Fondo: muschio di quercia, sandalo, ambra, muschio vegetale",
    a:  "Testa: note marine, sale, limone \u00b7 Cuore: davana, iris \u00b7 Fondo: ambra grigia, muschio di quercia, sandalo",
    perche: 'piramide dalla scheda Fragrantica di Lattafa Atlas EDP' },
  { id: 27, colonna: 'piramide',
    da: "Testa: bergamotto, note verdi, melone, ananas \u00b7 Cuore: accordo gourmand, note fruttate \u00b7 Fondo: ambra, vaniglia, muschio, note legnose",
    a:  "Testa: bergamotto, note verdi \u00b7 Cuore: melone, ananas, ambra, accordo gourmand \u00b7 Fondo: vaniglia, muschio, note legnose",
    perche: 'piramide dalla scheda Fragrantica di Al Haramain Amber Oud Gold Edition EDP' },
  { id: 29, colonna: 'piramide',
    da: "Testa: ananas, iris, zenzero, cipresso \u00b7 Cuore: cocco, note legnose \u00b7 Fondo: fava tonka, sandalo, ambra, ambra grigia",
    a:  "Testa: ananas, iris, zenzero, cipresso \u00b7 Cuore: cocco, note boschive \u00b7 Fondo: fava tonka, sandalo, ambra, ambra grigia",
    perche: 'piramide dalla scheda Fragrantica di Khadlaj Island EDP' },
  /* restano "no": quotidiano (troppo pieno per tutti i giorni), palestra
     (orientale caldo) e casa — come tutto il gruppo di riferimento. */
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
