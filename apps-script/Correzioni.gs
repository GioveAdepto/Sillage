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
  /* ── LAYERING E ACQUISTI, RIVISTI SULLE PIRAMIDI CORRETTE ────────────────
     Le ricette di layering spiegavano l'abbinamento con le note in comune fra
     i due profumi, ma quelle note venivano dalle piramidi sbagliate: su 26
     ricette, 21 citavano ingredienti che i due non condividono. Qui sotto le
     stesse frasi con le note vere, calcolate sull'intersezione delle piramidi
     dopo il controllo su Fragrantica.

     Due riferimenti puntavano al numero sbagliato: il foglio ha inserito Asad
     al № 30 e ANGELSEAR e' passato al № 31, quindi "№ 30 sotto" mandava a un
     profumo diverso da quello nominato nella ricetta.

     Negli Acquisti, Lattafa Asad era ancora fra le cose da comprare: nel
     frattempo e' entrato in collezione. E tre lacune poggiavano su conti che
     ora tornano diversi. */

  { tab: 'Layering', chiave: 'nome', valore: "Acqua di Gi\u00f2 EDP \u2192 TdH Eau Givr\u00e9e",
    colonna: 'perche',
    da: "Note minerali e geranio in comune. Stesso DNA verde-acquatico: si amplificano invece di scontrarsi. Usa la versione EDP, non il Profondo: il suo fondo patchouli-scuro confligge con il Givr\u00e9e.",
    a:  "Note minerali in comune, pi\u00f9 gli accordi agrumato, aromatico e minerale. Stesso DNA verde-acquatico: si amplificano invece di scontrarsi. Usa la versione EDP, non il Profondo: il suo fondo patchouli-scuro confligge con il Givr\u00e9e.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "CDN Sillage \u2192 Missoni Wave",
    colonna: 'perche',
    da: "Muschio e ribes nero in comune. Il Sillage porta struttura e proiezione, il Wave calore e morbidezza: insieme coprono tutta la piramide.",
    a:  "Nessuna nota in comune: a tenerli insieme sono gli accordi agrumato e speziato fresco. Il Sillage porta struttura e proiezione, il Wave calore e morbidezza: insieme coprono tutta la piramide.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Atlas \u2192 TdH Eau Givr\u00e9e",
    colonna: 'perche',
    da: "Note minerali e agrumate in comune. L'Atlas \u00e8 monocorda sul salato: base ideale. Il Givr\u00e9e aggiunge la testa che si spegne troppo presto se portato da solo.",
    a:  "Nessuna nota in comune, solo il registro aromatico: \u00e8 un accostamento per contrasto, non per parentela. L'Atlas \u00e8 monocorda sul salato: base ideale. Il Givr\u00e9e aggiunge la testa che si spegne troppo presto se portato da solo.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Island \u2192 CDN Sillage",
    colonna: 'perche',
    da: "Ambroxan e ambra grigia si parlano bene. Il Sillage compensa anche la longevit\u00e0 irregolare dell'Island: la base muschiata resta quando il cocco si spegne.",
    a:  "Iris, sandalo e zenzero in comune: \u00e8 la spina dorsale condivisa sotto due aperture opposte. Il Sillage compensa anche la longevit\u00e0 irregolare dell'Island: la base muschiata resta quando il cocco si spegne.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Acqua di Gi\u00f2 Profondo \u2192 Gucci Guilty EDP",
    colonna: 'perche',
    da: "Cedro e note fresche in comune. Equilibrio insolito e molto personale.",
    a:  "Lavanda e patchouli in comune. Equilibrio insolito e molto personale.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Hawas \u2192 Versace Eros Flame",
    colonna: 'perche',
    da: "Ambra grigia e patchouli in comune. Il Flame porta la componente speziata secca che al Hawas manca; le basi vanigliate sono compatibili.",
    a:  "Limone e patchouli in comune. Il Flame porta la componente speziata secca che al Hawas manca; l'ambra grigia dell'Hawas regge sotto la vaniglia del Flame.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Prada L'Homme Intense \u2192 Ginepro Nero",
    colonna: 'perche',
    da: "Entrambi legnoso-aromatici con resine in comune. Il Prada fa da fondamenta densa, il Ginepro porta la nota botanica che mancava.",
    a:  "Patchouli in comune, e gli accordi legnoso e terroso condivisi. Il Prada fa da fondamenta densa, il Ginepro porta la nota botanica \u2014 ginepro e benzoino \u2014 che al Prada manca del tutto.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "SWY Absolutely \u2192 Eros Flame",
    colonna: 'perche',
    da: "Vaniglia e fava tonka in entrambi. Sandalo e cedro del Flame si abbinano a rum e castagna; il pepe bilancia la dolcezza.",
    a:  "Vaniglia, cedro e patchouli in entrambi. La fava tonka la porta solo il Flame e si posa sulla castagna dell'Absolutely; il pepe bilancia la dolcezza.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "D&G The One \u2192 Th\u00e9or\u00e8me Homme",
    colonna: 'perche',
    da: "Patchouli e note legnose in comune. Il The One \u00e8 la base orientale, il Th\u00e9or\u00e8me l'apertura citrico-fresca che mancava.",
    a:  "Ambra in comune, e lo stesso accordo agrumato-ambrato. Il The One \u00e8 la base orientale, il Th\u00e9or\u00e8me l'apertura citrica che mancava: il patchouli lo mette solo il Th\u00e9or\u00e8me, sopra il fondo di tabacco e cedro.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Prada L'Homme Intense \u2192 Th\u00e9or\u00e8me Homme",
    colonna: 'perche',
    da: "Patchouli e muschio in comune. Struttura complementare: il Prada \u00e8 tutto cuore e fondo, il Th\u00e9or\u00e8me testa e corpo. Raramente due profumi coprono i tre stadi cos\u00ec bene.",
    a:  "Patchouli e ambra in comune. Struttura complementare: il Prada \u00e8 tutto cuore e fondo, il Th\u00e9or\u00e8me testa e corpo. Raramente due profumi coprono i tre stadi cos\u00ec bene.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Ferragamo Uomo Signature \u2192 Versace Eros EDP",
    colonna: 'perche',
    da: "Fava tonka in entrambi. Il contrasto si risolve nella base tonka-muschio condivisa. Una delle combinazioni pi\u00f9 originali della collezione.",
    a:  "Cuoio, patchouli e mandarino in comune. Il contrasto fresco-caldo si risolve sul cuoio, che l'Eros EDP ha in fondo e il Ferragamo porta accanto al caff\u00e8. Una delle combinazioni pi\u00f9 originali della collezione.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Givenchy Gentleman RP \u2192 Th\u00e9or\u00e8me Homme",
    colonna: 'perche',
    da: "Patchouli e base legnosa in comune. Stessa logica di The One + Th\u00e9or\u00e8me: base pesante sotto, apertura leggera sopra.",
    a:  "Ambra e note legnose in comune. Stessa logica di The One + Th\u00e9or\u00e8me: base pesante sotto, apertura leggera sopra.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "La Yuqawam \u2192 Eros Flame",
    colonna: 'perche',
    da: "Ambra in comune. Il La Yuqawam \u00e8 monocorda sul cuoio (base ideale), il Flame porta le componenti floreali e fruttate che mancano all'orientale puro.",
    a:  "Non hanno nulla in comune, n\u00e9 note n\u00e9 accordi: \u00e8 il contrasto a reggere tutto. Il La Yuqawam \u00e8 monocorda sul cuoio (base ideale), il Flame porta le componenti agrumate e vanigliate che all'orientale puro mancano.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Helan Vetiver & Rum \u2192 Encre Noire Sport",
    colonna: 'perche',
    da: "Vetiver e muschio di quercia in entrambi. Stessa radice olfattiva: si amplificano invece di creare dissonanza.",
    a:  "Vetiver, lavanda e noce moscata in entrambi, e tutti e cinque gli accordi in comune. Stessa radice olfattiva: si amplificano invece di creare dissonanza.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Gucci Guilty EDP \u2192 Gucci Guilty Cologne",
    colonna: 'perche',
    da: "Ginepro, cedro e lavanda condivisi \u2014 stesso DNA di maison. Si amplificano nel profilo comune e si differenziano nelle note peculiari.",
    a:  "Cedro e patchouli condivisi \u2014 stesso DNA di maison. Il ginepro lo porta solo il Cologne, la lavanda solo l'EDP: si amplificano nel profilo comune e si differenziano nelle note peculiari.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Missoni Wave \u2192 Davidoff Adventure",
    colonna: 'perche',
    da: "Vetiver e muschio bianco in comune, stesso DNA outdoor. Il Wave \u00e8 cremoso e floreale, l'Adventure secco e speziato: si bilanciano.",
    a:  "Vetiver e mandarino in comune, stesso DNA outdoor. Il Wave \u00e8 cremoso e floreale, l'Adventure secco e speziato: si bilanciano.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Encre Noire \u2192 Gucci Guilty EDP",
    colonna: 'perche',
    da: "Cipresso e cedro in comune. Botanicamente affini, non si scontrano.",
    a:  "Cipresso nell'Encre, cedro nel Guilty: legni botanicamente affini, non note condivise. Non si scontrano.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Helan Vetiver & Rum \u2192 Acqua di Gi\u00f2 EDP",
    colonna: 'perche',
    da: "Vetiver, geranio e muschio in comune. L'Helan \u00e8 la versione calda del vetiver, l'ADG quella minerale: il contrasto crea interesse senza dissonanza.",
    a:  "Vetiver, geranio, lavanda e patchouli in comune. L'Helan \u00e8 la versione calda del vetiver, l'ADG quella minerale: il contrasto crea interesse senza dissonanza.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "SWY Absolutely \u2192 CDN Sillage",
    colonna: 'perche',
    da: "Muschio e ambroxan in entrambi: la base comune lega profili molto diversi e il contrasto in testa \u00e8 deliberato.",
    a:  "Bergamotto e cedro in entrambi: la base legnosa comune lega profili molto diversi e il contrasto in testa \u00e8 deliberato.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Encre Noire \u2192 Acqua di Gi\u00f2 EDP",
    colonna: 'perche',
    da: "Il vetiver \u00e8 presente in entrambi: l'Encre nella versione oscura (bourbon e Haiti), l'ADG in quella acquatica che schiarisce. Contrasto bilanciato.",
    a:  "Il vetiver \u00e8 presente in entrambi: oscuro e terroso nell'Encre, acquatico e schiarito nell'ADG. Contrasto bilanciato.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Angelsear (DoDo's) \u2192 Helan Vetiver & Rum",
    colonna: 'perche',
    da: "Accordo boozy condiviso ma su registri opposti: cognac-dolce contro rum-saponoso. La quercia dell'Angelsear e il muschio di quercia dell'Helan sono la stessa base che li salda.",
    a:  "Accordo boozy condiviso ma su registri opposti: cognac-dolce contro rum-saponoso. Nessuna nota davvero in comune: il legno di quercia dell'Angelsear e il muschio di quercia dell'Helan si somigliano pi\u00f9 nel nome che nella piramide, ma vanno d'accordo.",
    perche: 'note in comune riviste sulle piramidi corrette' },
  { tab: 'Layering', chiave: 'nome', valore: "Angelsear (DoDo's) \u2192 Th\u00e9or\u00e8me Homme",
    colonna: 'sommario',
    da: "\u2116 30 sotto \u00b7 \u2116 7 sopra \u2014 cognac citrico, sera A/I",
    a:  "\u2116 31 sotto \u00b7 \u2116 7 sopra \u2014 cognac citrico, sera A/I",
    perche: 'ANGELSEAR e il numero 31, non il 30 che ora e Asad' },
  { tab: 'Layering', chiave: 'nome', valore: "Angelsear (DoDo's) \u2192 Helan Vetiver & Rum",
    colonna: 'sommario',
    da: "\u2116 30 sotto \u00b7 \u2116 1 sopra \u2014 doppio boozy, casa A/I",
    a:  "\u2116 31 sotto \u00b7 \u2116 1 sopra \u2014 doppio boozy, casa A/I",
    perche: 'ANGELSEAR e il numero 31, non il 30 che ora e Asad' },
  { tab: 'ConsigliVoci', chiave: 'titolo', valore: "Boozy gourmand \u2192 Angelsear \u2116 30",
    colonna: 'titolo',
    da: "Boozy gourmand \u2192 Angelsear \u2116 30",
    a:  "Boozy gourmand \u2192 Angelsear \u2116 31",
    perche: 'ANGELSEAR e il numero 31, non il 30 che ora e Asad' },
  { tab: 'ConsigliVoci', chiave: 'titolo', valore: "Lattafa Asad",
    colonna: 'dettaglio',
    da: "Ispirato a Nishane Hacivat. Woody-fresco tropicale, sotto i 30\u20ac. Attenzione: con Island e Zara in collezione, il registro fresco-fruttato inizia a essere affollato \u2014 valuta un decant prima.",
    a:  "Non \u00e8 pi\u00f9 un consiglio: \u00e8 entrato in collezione al \u2116 30, campione da 12 ml. E non \u00e8 il woody-fresco tropicale che sembrava \u2014 la piramide reale \u00e8 pepe nero, tabacco e ananas in apertura, patchouli, caff\u00e8 e iris nel cuore, vaniglia, ambra e legno secco in fondo. Ambrato speziato da sera fredda, non un fresco.",
    perche: 'Asad e in collezione: non si consiglia di comprare cio che si ha gia' },
  { tab: 'Consigli', chiave: 'nome', valore: "Iris polveroso da ufficio diurno",
    colonna: 'lacuna',
    da: "L'iris in collezione c'\u00e8 solo nelle versioni dense e serali (Prada Intense, Gentleman RP, e in tracce nell'Island). Manca la stessa firma in versione leggera, da portare in ufficio alle nove del mattino.",
    a:  "L'iris compare in sei profumi, ma quasi sempre come comprimario: denso e serale in Prada Intense, Gentleman RP e Asad, in traccia dentro profili che vanno da tutt'altra parte \u2014 il cocco dell'Island, il salino dell'Atlas, il citrico del CdN Sillage. Manca la stessa firma in versione leggera e cipriata, da portare in ufficio alle nove del mattino.",
    perche: 'lacuna riscritta sui dati corretti' },
  { tab: 'Consigli', chiave: 'nome', valore: "Fresco marino da palestra",
    colonna: 'lacuna',
    da: "I profumi adatti alla palestra sono pochi e molto simili tra loro: tutti sullo stesso asse acquatico-vetiver.",
    a:  "I profumi adatti alla palestra sono sei e quasi tutti sullo stesso asse: quattro aromatici acquatici (Hawas, Wave, Acqua di Gi\u00f2 Profondo, Cool Water), pi\u00f9 il muschiato del CdN Sillage e il vetiver agrumato dell'Encre Noire Sport.",
    perche: 'lacuna riscritta sui dati corretti' },
  { tab: 'Consigli', chiave: 'nome', valore: "Foug\u00e8re barbershop \u2014 il grande assente",
    colonna: 'lacuna',
    da: "Non c'\u00e8 nessun foug\u00e8re classico: lavanda, cumarina, muschio. \u00c8 la famiglia che copre ufficio, casual e sera 365 giorni, e resta il buco pi\u00f9 evidente della collezione.",
    a:  "I due Eros sono catalogati foug\u00e8re ambrati, ma il foug\u00e8re classico \u2014 lavanda, cumarina, muschio \u2014 non c'\u00e8. \u00c8 la famiglia che copre ufficio, casual e sera 365 giorni, e resta il buco pi\u00f9 evidente della collezione.",
    perche: 'lacuna riscritta sui dati corretti' },
];

function correggi(soloProva) {
  /* Ogni tab viene letta una volta sola e tenuta qui: le correzioni non sono
     piu' solo sui profumi, toccano anche Layering e Consigli, dove la riga si
     riconosce dal nome invece che da un id. */
  var lette = {};
  function tabella(nome) {
    if (!lette[nome]) {
      var f = foglio_(nome);
      var g = f.getDataRange().getDisplayValues();
      var testa = g[0].map(function (c) { return String(c).trim(); });
      lette[nome] = { foglio: f, griglia: g, testa: testa };
    }
    return lette[nome];
  }

  var esiti = [];
  CORREZIONI.forEach(function (c) {
    var nomeTab = c.tab || TAB.profumi;
    var chiave = c.chiave || 'id';
    var valore = c.valore !== undefined ? c.valore : c.id;
    var etichetta = nomeTab + ' «' + String(valore).slice(0, 34) + '» ' + c.colonna;

    var t;
    try { t = tabella(nomeTab); }
    catch (e) { esiti.push(etichetta + ': ' + e.message); return; }

    var colChiave = t.testa.indexOf(chiave);
    if (colChiave < 0) { esiti.push(etichetta + ': manca la colonna "' + chiave + '"'); return; }

    var r = -1;
    for (var i = 1; i < t.griglia.length; i++) {
      if (String(t.griglia[i][colChiave]).trim() === String(valore).trim()) { r = i + 1; break; }
    }
    var griglia = t.griglia, testa = t.testa, f = t.foglio;
    var colonna = testa.indexOf(c.colonna);

    if (r < 0) { esiti.push(etichetta + ': nessuna riga con questa chiave'); return; }
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
