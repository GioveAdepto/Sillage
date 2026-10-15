/* Sillage — i dati e il momento presente.
   Da dove arrivano i profumi (data/*.json nel repo e, quando è configurato,
   il foglio Google servito da Apps Script), le etichette comuni e l'adesso:
   stagione, ora del giorno e meteo. Le immagini sono file veri in img/,
   richiamate dal campo `img` di ogni voce.

   L'app è divisa in più file caricati in ordine da index.html: dati.js,
   collezione.js, consigliami.js, viste.js, diario.js, app.js. Sono script
   classici, non moduli: condividono le stesse variabili globali, come se
   fossero un file solo. */

// ── ORIGINE DEI DATI ──────────────────────────────────────────────────────
// appsScript: l'URL .../exec del Web App (istruzioni in apps-script/LEGGIMI.md).
//             Se resta vuoto, l'app legge soltanto i JSON del repo.
const ORIGINE_DATI = {
  appsScript: "https://script.google.com/macros/s/AKfycbz6i7ZF6FNBboUYZdKjJi1oS_dcbjtEdsCsGyrCxkVKNKIq61j7-H14N8zhDWpOr7w1og/exec",
  locale: "data/",
  attesaMax: 8000            // ms oltre i quali si rinuncia al backend remoto
};

const CHIAVE_CACHE = "sillage:dati";

// Riempiti all'avvio da caricaDati(). Prima di allora la collezione è vuota.
let profumi = [], noteChips = [], layering = [], consigli = [], diarioFoglio = [];
let origineDati = "locale";

/* Da dove arrivano i dati che sono a schermo adesso. Finisce su <body> per
   poterlo leggere dalla console senza strumenti: foglio, cache, locale,
   locale-ripiego. Va aggiornato anche quando il foglio conferma la cache e
   quindi non si ridisegna niente. */
function segnaOrigine(v) {
  origineDati = v;
  try { document.body.dataset.origine = v; } catch (e) {}
}

function applicaDati(d) {
  if (!Array.isArray(d.profumi) || !d.profumi.length) throw new Error("dati senza profumi");
  profumi   = d.profumi;
  noteChips = d.note      || [];
  layering  = d.layering  || [];
  consigli  = d.consigli  || [];
  diarioFoglio = d.diario || [];
}

async function leggiLocale() {
  const nomi = ["profumi", "note", "layering", "consigli"];
  const parti = await Promise.all(nomi.map(async n => {
    const r = await fetch(ORIGINE_DATI.locale + n + ".json", { cache: "no-cache" });
    if (!r.ok) throw new Error("data/" + n + ".json → HTTP " + r.status);
    return r.json();
  }));
  return Object.fromEntries(nomi.map((n, i) => [n, parti[i]]));
}

/* Nessun AbortController: la richiesta non si interrompe. `attesaMax` decide
   solo quanto si sta fermi ad aspettarla prima di disegnare qualcos'altro;
   se il foglio arriva dopo, arriva lo stesso e ha comunque l'ultima parola. */
function chiediAlFoglio() {
  return fetch(ORIGINE_DATI.appsScript, { redirect: "follow" })
    .then(r => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
}

function scriviCache(d) {
  try {
    localStorage.setItem(CHIAVE_CACHE, JSON.stringify({ quando: Date.now(), dati: d }));
  } catch (e) { /* quota piena o storage negato: la cache è un lusso, non un requisito */ }
}

function leggiCache() {
  try {
    const grezzo = localStorage.getItem(CHIAVE_CACHE);
    return grezzo ? JSON.parse(grezzo).dati : null;
  } catch (e) { return null; }
}

/* Impronta dei soli dati: `aggiornato` cambia a ogni risposta e falserebbe
   il confronto fra quello che è a schermo e quello che è appena arrivato. */
function impronta(d) {
  return JSON.stringify([d.profumi, d.note, d.layering, d.consigli, d.diario || []]);
}

/* Ordine di preferenza: foglio Google → ultima copia in cache → JSON del repo.
   Il ripiego locale è sempre presente, quindi la pagina non resta mai vuota.

   `mostra` viene chiamata appena c'è qualcosa da disegnare: se in cache c'è
   già una collezione, va a schermo subito e il foglio la aggiorna dopo, in
   sottofondo. Il secondo disegno scatta solo se il foglio porta qualcosa di
   diverso, così una schermata già a posto non si ricostruisce sotto le mani. */
async function caricaDati(mostra) {
  let aSchermo = null;        // impronta di quello che è disegnato adesso
  let foglioVinto = false;    // il foglio ha risposto: nessuno lo sovrascrive più

  if (ORIGINE_DATI.appsScript) {
    const cache = leggiCache();
    if (cache) {
      try {
        applicaDati(cache);
        segnaOrigine("cache");
        aSchermo = impronta(cache);
        mostra();
      } catch (e) { aSchermo = null; /* cache corrotta: si prosegue */ }
    }

    const dalFoglio = chiediAlFoglio();
    const arrivato = d => {
      try {
        applicaDati(d);
      } catch (e) {
        console.warn("Sillage: risposta del foglio inutilizzabile —", e.message);
        return;
      }
      foglioVinto = true;
      segnaOrigine("foglio");
      scriviCache(d);
      // si ridisegna solo se porta qualcosa di diverso da quello che si vede
      if (impronta(d) !== aSchermo) { aSchermo = impronta(d); mostra(); }
    };
    const perso = err => console.warn("Sillage: foglio non raggiungibile —", err.message);

    // si aspetta il foglio, ma non all'infinito: passata l'attesa si disegna
    // quello che c'è e la richiesta prosegue per conto suo
    const esito = await Promise.race([
      dalFoglio.then(d => ({ d }), err => ({ err })),
      new Promise(r => setTimeout(() => r(null), ORIGINE_DATI.attesaMax))
    ]);

    if (esito && esito.d) { arrivato(esito.d); return; }
    if (esito && esito.err) perso(esito.err);
    else dalFoglio.then(arrivato, perso);   // in ritardo, non perduto
    if (aSchermo) return;                   // la cache è già a schermo, basta così
  }

  const locali = await leggiLocale();
  if (foglioVinto) return;   // il foglio è arrivato mentre si leggeva il repo
  applicaDati(locali);
  aSchermo = impronta(locali);   // così il foglio, se poi conferma, non ridisegna
  segnaOrigine(ORIGINE_DATI.appsScript ? "locale-ripiego" : "locale");
  mostra();
}

// ── ETICHETTE E UTILITÀ ───────────────────────────────────────────────────
const usoLabels={ufficio:"Ufficio",quotidiano:"Quotidiano",informale:"Informale",formale:"Formale",appuntamento:"Appuntamento",palestra:"Palestra",casa:"In casa",festivita:"Festività"};
const vetroClasse={blu:"acqua",verde:"bosco",rosso:"ambra"};
const vetroLettera={blu:"A",verde:"V",rosso:"O"};
const vetroNome={blu:"Acquatici e freschi",verde:"Aromatici e legnosi",rosso:"Orientali e intensi"};
const etichetteFiltro={pe:"Primavera / Estate",ai:"Autunno / Inverno",tutto:"Tutto l'anno",ufficio:"Ufficio",appuntamento:"Appuntamento",quotidiano:"Quotidiano",informale:"Informale",formale:"Formale",palestra:"Palestra",casa:"In casa",festivita:"Festività",blu:"Acquatici",verde:"Legnosi",rosso:"Orientali",sera:"Solo sera",giorno:"Solo giorno",dupe:"Cloni e dupe",adesso:"Adatti adesso"};
const stagLbl=s=>s==="pe"?"Primavera / Estate":s==="ai"?"Autunno / Inverno":"Tutto l'anno";
const stagBreve=s=>s==="pe"?"P/E":s==="ai"?"A/I":"tutto l'anno";
const momLbl=m=>m==="entrambi"?"Giorno e sera":m==="sera"?"Sera":"Giorno";
// il foglio scrive 4 dove gli altri hanno 4.3: a schermo vanno tutti a una cifra
const voto=r=>Number(r).toFixed(1);
/* Il colore dell'accordo segue l'accordo, non la sua posizione nell'elenco:
   prima "Marino" era arancione se primo e verde se secondo, quindi il colore
   sembrava una categoria senza esserlo. Sette famiglie, tinte fisse. */
const famigliaAccordo={
  acqua: ["Marino","Acquatico","Minerale","Salato","Ozonico","Fresco"],
  bosco: ["Aromatico","Legnoso","Verde","Terroso","Lavanda","Muschiato","Muschio Vegetale","Cannabis"],
  agrume:["Agrumato","Fruttato"],
  spezia:["Speziato Fresco","Speziato Caldo","Ambra","Cannella","Balsamico"],
  cipria:["Talcato","Iris","Violetta","Rosa","Floreale Bianco"],
  dolce: ["Vanigliato","Dolce","Cocco","Caffè","Rum","Whisky","Mielato"],
  fumo:  ["Cuoiato","Fumoso","Animalico","Tabacco","Oud"]
};
const tintaAccordo={acqua:"#7fa8cf",bosco:"#93b98a",agrume:"#ddc76b",
                    spezia:"#d9906f",cipria:"#bd96dc",dolce:"#c8a35e",fumo:"#9aa0a8"};
const coloreAccordo=(()=>{
  const m={};
  for(const f in famigliaAccordo)famigliaAccordo[f].forEach(a=>m[a.toLowerCase()]=tintaAccordo[f]);
  // un accordo nuovo aggiunto nel foglio resta neutro invece di sparire
  return a=>m[String(a).toLowerCase()]||"#8b8375";
})();
const ordinamenti={
  alpha:{lbl:"Nome A → Z",fn:p=>p.name.toLowerCase()},
  brand:{lbl:"Marchio A → Z",fn:p=>p.brand.toLowerCase()+p.name},
  rating:{lbl:"Rating più alto",fn:p=>-(p.rating||0)},
  famiglia:{lbl:"Famiglia olfattiva",fn:p=>p.famiglia.toLowerCase()},
  stagione:{lbl:"Stagione",fn:p=>({pe:0,tutto:1,ai:2}[p.stagione]??3)},
  longevita:{lbl:"Longevità più lunga",fn:p=>-(p.longevita||0)},
  id:{lbl:"Numero di catalogo",fn:p=>p.id}
};
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

let filtriAttivi=new Set(), noteAttive=new Set(), testoCerca="", ordine="alpha", noteEspanse=false;

// ── ADESSO: stagione, ora, meteo ──────────────────────────────────────────
/* Una fonte sola per "adesso": il filtro rapido, la Guida e
   «Consigliami» leggono tutti da qui. Prima ognuno aveva la sua regola, e il filtro
   chiamava "inverno" tutto quello che non era estate.
   Le stagioni cambiano agli equinozi e ai solstizi. La sera comincia mezz'ora
   dopo il tramonto, e comunque alle 19: d'inverno alle cinque e mezza e' gia'
   sera, d'estate alle nove no. Senza meteo il tramonto non si sa, e la sera
   comincia alle 18. */
let meteo=null;
function adesso(d=new Date()){
  const k=(d.getMonth()+1)*100+d.getDate(),h=d.getHours();
  const nome=k>=321&&k<621?"primavera":k>=621&&k<923?"estate":k>=923&&k<1221?"autunno":"inverno";
  let inizioSera=new Date(d);inizioSera.setHours(18,0,0,0);
  const tramonto=meteo&&(meteo.tramonti||[meteo.tramonto]).find(s=>s&&s.slice(0,10)===oggiISO(d));
  if(tramonto){
    const t=new Date(tramonto).getTime()+30*6e4,diciannove=new Date(d).setHours(19,0,0,0);
    inizioSera=new Date(Math.min(t,diciannove));
  }
  const sera=d>=inizioSera||h<5;
  return {stagione:nome==="primavera"||nome==="estate"?"pe":"ai",nome,momento:sera?"sera":"giorno",
          giorno:d.getDay(),ora:h,meteo:meteo&&Date.now()-meteo.quando<3*3600e3?meteo:null};
}
const stagioneOra=()=>adesso().stagione;
const moment0Ora=()=>adesso().momento;

/* Il meteo viene da Open-Meteo: gratuito, senza chiave. La posizione la
   chiede il browser, e solo quando la chiedi tu dal pulsante in
   «Consigliami»; poi resta sul telefono, arrotondata a una decina di chilometri, e il
   meteo si aggiorna da solo ogni mezz'ora. */
const CHIAVE_POSTO="sillage:posto",CHIAVE_METEO="sillage:meteo";
const cieli={0:"sereno",1:"quasi sereno",2:"poco nuvoloso",3:"coperto",45:"nebbia",48:"nebbia",51:"pioviggine",53:"pioviggine",55:"pioviggine",
  56:"pioviggine gelata",57:"pioviggine gelata",61:"pioggia",63:"pioggia",65:"pioggia forte",66:"pioggia gelata",67:"pioggia gelata",
  71:"neve",73:"neve",75:"neve forte",77:"neve",80:"rovesci",81:"rovesci",82:"rovesci forti",85:"neve",86:"neve",95:"temporale",96:"temporale",99:"temporale"};
const piove=m=>m&&(m.precipitazioni>0||(m.codice>=51&&m.codice<=67)||(m.codice>=80&&m.codice<=82)||m.codice>=95);
function leggiJSON(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}}
function scriviJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
let chiedendoPosto=false;
async function aggiornaMeteo(chiedi){
  const salvato=leggiJSON(CHIAVE_METEO);
  if(salvato)meteo=salvato;      // anche se vecchio: vale finche' non arriva il nuovo (adesso() lo scarta dopo 3 ore)
  if(salvato&&salvato.ore&&Date.now()-salvato.quando<30*6e4)return true;   // senza "ore" e' una copia vecchia: si riscarica
  let posto=leggiJSON(CHIAVE_POSTO);
  if(!posto){
    if(!chiedi||!navigator.geolocation)return false;
    chiedendoPosto=true;if(document.getElementById("fondale-oggi")?.classList.contains("aperto"))disegnaOggi();
    posto=await new Promise(r=>navigator.geolocation.getCurrentPosition(
      p=>r({lat:+p.coords.latitude.toFixed(1),lon:+p.coords.longitude.toFixed(1)}),()=>r(null),
      {maximumAge:864e5,timeout:15000,enableHighAccuracy:false}));
    chiedendoPosto=false;
    if(!posto)return false;
    scriviJSON(CHIAVE_POSTO,posto);
  }
  try{
    const u=`https://api.open-meteo.com/v1/forecast?latitude=${posto.lat}&longitude=${posto.lon}`+
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code`+
      `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code`+
      `&daily=sunset&timezone=auto&forecast_days=8`;
    const d=await (await fetch(u)).json(),o=d.hourly;
    meteo={quando:Date.now(),temperatura:Math.round(d.current.temperature_2m),percepita:Math.round(d.current.apparent_temperature),
      umidita:d.current.relative_humidity_2m,precipitazioni:d.current.precipitation,codice:d.current.weather_code,
      tramonto:d.daily&&d.daily.sunset?d.daily.sunset[0]:null,tramonti:d.daily&&d.daily.sunset||[],
      // otto giorni, ora per ora: t e' l'ora locale del posto ("2026-10-07T15:00")
      ore:o?o.time.map((t,i)=>({t,T:Math.round(o.temperature_2m[i]),P:Math.round(o.apparent_temperature[i]),
        u:o.relative_humidity_2m[i],pp:o.precipitation_probability[i]??0,mm:o.precipitation[i]??0,c:o.weather_code[i]})):null};
    scriviJSON(CHIAVE_METEO,meteo);
    return true;
  }catch(e){return false}
}
async function usaMeteo(chiedi){
  if(await aggiornaMeteo(chiedi)){disegnaRapidi();if(document.getElementById("fondale-oggi")?.classList.contains("aperto"))disegnaOggi();
    if(document.getElementById("vista-diario")?.classList.contains("attiva"))disegnaDiario()}
  else if(chiedi&&document.getElementById("fondale-oggi")?.classList.contains("aperto"))disegnaOggi();
}
function scordaPosto(){try{localStorage.removeItem(CHIAVE_POSTO);localStorage.removeItem(CHIAVE_METEO)}catch(e){}meteo=null;disegnaRapidi();disegnaOggi()}
const cieloDi=m=>m?`${m.temperatura}° ${cieli[m.codice]||""}`.trim():"";

/* Il meteo pesa per le ore in cui il profumo sta sulla pelle, non come media
   del giorno: da quando lo metti fino alla durata che dichiara. Un picco di 27°
   alle tre del pomeriggio conta anche se la mattina ce ne sono 14. La previsione
   oraria resta buona per 12 ore, quindi serve anche per domani. */
const piovosa=o=>o.pp>=50||o.mm>=.2||(o.c>=51&&o.c<=67)||(o.c>=80&&o.c<=82)||o.c>=95;
function finestraMeteo(da,ore){
  const m=meteo&&meteo.ore&&Date.now()-meteo.quando<12*3600e3?meteo:null;
  if(!m)return null;
  const a=da.getTime()-36e5+1,b=da.getTime()+ore*36e5;
  const h=m.ore.filter(o=>{const t=new Date(o.t).getTime();return t>=a&&t<b});
  if(!h.length)return null;
  const P=h.map(o=>o.P),max=Math.max(...P),min=Math.min(...P),ora=o=>new Date(o.t).getHours();
  const pioggia=h.find(piovosa);
  return {ore:h,max,min,media:Math.round(P.reduce((s,x)=>s+x,0)/P.length),
    umid:Math.round(h.reduce((s,o)=>s+o.u,0)/h.length),
    oraMax:ora(h[P.indexOf(max)]),oraMin:ora(h[P.indexOf(min)]),
    pioggia:pioggia?ora(pioggia):null,dalle:ora(h[0]),alle:(ora(h[h.length-1])+1)%24};
}
