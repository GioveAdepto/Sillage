/* Sillage — logica dell'interfaccia.
   I dati della collezione non stanno più qui dentro: vivono in data/*.json
   nel repo e, quando è configurato, nel foglio Google servito da Apps Script.
   Le immagini sono file veri in img/, richiamate dal campo `img` di ogni voce. */

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
      `&daily=sunset&timezone=auto&forecast_days=2`;
    const d=await (await fetch(u)).json(),o=d.hourly;
    meteo={quando:Date.now(),temperatura:Math.round(d.current.temperature_2m),percepita:Math.round(d.current.apparent_temperature),
      umidita:d.current.relative_humidity_2m,precipitazioni:d.current.precipitation,codice:d.current.weather_code,
      tramonto:d.daily&&d.daily.sunset?d.daily.sunset[0]:null,tramonti:d.daily&&d.daily.sunset||[],
      // oggi e domani, ora per ora: t e' l'ora locale del posto ("2026-10-07T15:00")
      ore:o?o.time.map((t,i)=>({t,T:Math.round(o.temperature_2m[i]),P:Math.round(o.apparent_temperature[i]),
        u:o.relative_humidity_2m[i],pp:o.precipitation_probability[i]??0,mm:o.precipitation[i]??0,c:o.weather_code[i]})):null};
    scriviJSON(CHIAVE_METEO,meteo);
    return true;
  }catch(e){return false}
}
async function usaMeteo(chiedi){
  if(await aggiornaMeteo(chiedi)){disegnaRapidi();if(document.getElementById("fondale-oggi")?.classList.contains("aperto"))disegnaOggi()}
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

// ── FILTRAGGIO ────────────────────────────────────────────────────────────
function passa(p,filtri,note){
  const s=testoCerca.toLowerCase();
  if(s&&!p.brand.toLowerCase().includes(s)&&!p.name.toLowerCase().includes(s)&&!p.note.toLowerCase().includes(s)
    &&!p.famiglia.toLowerCase().includes(s)&&!p.accordi.join(" ").toLowerCase().includes(s)&&!(p.dupe||"").toLowerCase().includes(s))return false;
  for(const f of filtri){
    if(f==="adesso"){
      const st=stagioneOra(),mo=moment0Ora();
      if(p.stagione!==st&&p.stagione!=="tutto")return false;
      if(p.momento!==mo&&p.momento!=="entrambi")return false;
      continue;
    }
    if(f==="pe"&&p.stagione!=="pe"&&p.stagione!=="tutto")return false;
    if(f==="ai"&&p.stagione!=="ai"&&p.stagione!=="tutto")return false;
    if(f==="tutto"&&p.stagione!=="tutto")return false;
    if((f==="blu"||f==="verde"||f==="rosso")&&p.colore!==f)return false;
    if(f==="ufficio"&&p.ufficio!=="si")return false;
    if(f==="appuntamento"&&p.appuntamento!=="si")return false;
    if(f==="quotidiano"&&p.quotidiano!=="si")return false;
    if(f==="informale"&&p.informale!=="si")return false;
    if(f==="formale"&&p.formale!=="si")return false;
    if(f==="palestra"&&p.palestra!=="si")return false;
    if(f==="casa"&&p.casa!=="si")return false;
    if(f==="festivita"&&p.festivita!=="si")return false;
    if(f==="sera"&&p.momento!=="sera")return false;
    if(f==="giorno"&&p.momento!=="giorno")return false;
    if(f==="dupe"&&!p.dupe)return false;
  }
  if(note.size){
    let trovata=false;
    for(const n of note){if(p.note.toLowerCase().includes(n)||p.accordi.join(" ").toLowerCase().includes(n)){trovata=true;break}}
    if(!trovata)return false;
  }
  return true;
}
/* La collezione tiene due cose diverse nello stesso elenco: le boccette e i
   campioncini in prova. Un 2 ml non lo indossi, lo provi — quindi Numeri,
   Guida e Acquisti parlano solo delle boccette, e i campioni stanno in una
   vetrina per conto loro. Il discrimine e' tipo_possesso. */
let vetrina="boccette";
const eCampione=p=>p.tipoPossesso&&p.tipoPossesso!=="full";
const boccette=()=>profumi.filter(p=>!eCampione(p));
const campioni=()=>profumi.filter(eCampione);
const inVetrina=()=>vetrina==="campioni"?campioni():boccette();

/* Il numero sul cartellino e' la posizione nella sua vetrina, in ordine di
   arrivo: le boccette vanno da 1 a 31, i campioni da 1 a 7. L'id del foglio
   resta la chiave di tutto, ma a schermo non si vede piu': contava anche i
   campioni, e Ombre Noire risultava № 32 su 31 boccette. I testi che citano
   "№ 27" vengono riscritti con il numero nuovo. */
let numeri=new Map();
function numera(){
  numeri=new Map();
  [boccette(),campioni()].forEach(l=>[...l].sort((a,b)=>a.id-b.id).forEach((p,i)=>numeri.set(p.id,i+1)));
}
const numeroDi=id=>{if(numeri.size!==profumi.length)numera();return numeri.get(id)??id};
const rinumera=t=>String(t??"").replace(/№\s*(\d+)/g,(m,n)=>"№ "+numeroDi(+n));

/* ── Il diario d'uso ──
   Le voci confermate arrivano dal foglio (tab Diario). Quelle appena toccate
   aspettano in una coda locale finche' il foglio non le conferma: cosi' il
   pulsante risponde subito anche senza rete, e niente va perso. */
const CODA_DIARIO="sillage:diario-coda";
const leggiCoda=()=>{try{return JSON.parse(localStorage.getItem(CODA_DIARIO))||[]}catch(e){return []}};
const scriviCoda=c=>{try{localStorage.setItem(CODA_DIARIO,JSON.stringify(c))}catch(e){}};
const oggiISO=(d=new Date())=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
function diario(){
  const coda=leggiCoda(),tolte=new Set(coda.filter(o=>o.op==="togli").map(o=>String(o.t))),m=new Map();
  diarioFoglio.forEach(v=>m.set(String(v.t),v));
  coda.filter(o=>o.op==="metti").forEach(o=>m.set(String(o.t),o));
  return [...m.values()].filter(v=>!tolte.has(String(v.t)));
}
const vociDi=id=>diario().filter(v=>+v.id===id&&v.data<=oggiISO()).map(v=>v.data).sort();
function giorniDa(id){
  const v=vociDi(id);
  if(!v.length)return null;
  return Math.round((new Date(oggiISO())-new Date(v[v.length-1]))/864e5);
}
const indossatoOggi=id=>diario().some(v=>+v.id===id&&v.data===oggiISO());
const quandoFu=g=>g===0?"oggi":g===1?"ieri":g<45?`${g} giorni fa`:g<365?`${Math.round(g/30)} mesi fa`:"più di un anno fa";

function indossa(id){segna(id,oggiISO())}
/* Al massimo due profumi al giorno: o due singoli, o un layering (sotto e
   sopra). Il layering si riconosce dal t, senza toccare il foglio: un t di 14
   cifre e' la coppia (le prime 13, uguali per i due) piu' il ruolo, 1 sotto e
   2 sopra. Il Web App accetta t da 10 a 16 cifre, quindi va bene cosi'. */
const MAX_GIORNO=2;
const ruoloStrato=v=>String(v.t).length===14?+String(v.t).slice(-1):0;
const coppiaDi=v=>String(v.t).slice(0,13);
const vociDelGiorno=data=>diario().filter(v=>v.data===data&&profumi.some(p=>p.id===+v.id));
function togliDallaCoda(coda,v){
  // tolta prima che il foglio la vedesse: basta cancellarla dalla coda
  const i=coda.findIndex(o=>o.op==="metti"&&String(o.t)===String(v.t));
  if(i>=0)coda.splice(i,1);else coda.push({op:"togli",id:+v.id,data:v.data,t:String(v.t)});
}
/* Mette o toglie un profumo in un giorno: oggi dal pulsante della scheda,
   un giorno passato dal Diario. Togliere meta' di un layering lo toglie tutto. */
function segna(id,data){
  const coda=leggiCoda(),giorno=vociDelGiorno(data),gia=giorno.find(v=>+v.id===id);
  if(gia){
    const insieme=ruoloStrato(gia)?giorno.filter(v=>ruoloStrato(v)&&coppiaDi(v)===coppiaDi(gia)):[gia];
    insieme.forEach(v=>togliDallaCoda(coda,v));
    scriviCoda(coda);insieme.forEach(v=>dopoDiario(+v.id));
  }else{
    if(giorno.length>=MAX_GIORNO){avvisa(`${data===oggiISO()?"Oggi":"Quel giorno"} hai già segnato due profumi: togline uno prima.`);return false}
    coda.push({op:"metti",id,data,t:String(Date.now())});
    scriviCoda(coda);dopoDiario(id);
  }
  sincronizzaDiario();
  return true;
}
/* Il layering occupa il giorno intero. Se quel giorno c'era gia' uno dei due
   come singolo, diventa parte della coppia; un terzo profumo invece va tolto prima. */
function segnaLayering(sotto,sopra,data){
  if(!sotto||!sopra||sotto===sopra)return false;
  const coda=leggiCoda(),giorno=vociDelGiorno(data);
  const altro=giorno.find(v=>+v.id!==sotto&&+v.id!==sopra);
  if(altro){avvisa(`Quel giorno c'è già ${profumi.find(p=>p.id===+altro.id)?.name||"un altro profumo"}: toglilo prima di segnare un layering.`);return false}
  giorno.forEach(v=>togliDallaCoda(coda,v));
  const base=String(Date.now());
  coda.push({op:"metti",id:sotto,data,t:base+"1"},{op:"metti",id:sopra,data,t:base+"2"});
  scriviCoda(coda);dopoDiario(sotto);dopoDiario(sopra);
  sincronizzaDiario();
  return true;
}
// il layering di un giorno, se c'e': {sotto, sopra} come profumi
function layeringDel(data){
  const v=vociDelGiorno(data).filter(ruoloStrato);
  const sotto=v.find(x=>ruoloStrato(x)===1),sopra=v.find(x=>ruoloStrato(x)===2);
  return sotto&&sopra?{sotto:profumi.find(p=>p.id===+sotto.id),sopra:profumi.find(p=>p.id===+sopra.id)}:null;
}
const layeringFatto=(sotto,sopra,data=oggiISO())=>{const l=layeringDel(data);return !!l&&l.sotto?.id===sotto&&l.sopra?.id===sopra};
function faiLayering(sotto,sopra){
  if(layeringFatto(sotto,sopra)){segna(sotto,oggiISO());return}   // di nuovo: lo toglie
  if(segnaLayering(sotto,sopra,oggiISO()))avvisa("Layering segnato nel diario di oggi.");
}
// un avviso breve in basso, sopra la barra
let timerAvviso=null;
function avvisa(t){
  let el=document.getElementById("avviso");
  if(!el){el=document.createElement("div");el.id="avviso";el.className="avviso";el.setAttribute("role","status");document.body.appendChild(el)}
  el.textContent=t;el.classList.add("mostra");
  clearTimeout(timerAvviso);timerAvviso=setTimeout(()=>el.classList.remove("mostra"),3200);
}
function dopoDiario(id){
  const r=document.getElementById("diario-"+id);
  if(r)r.innerHTML=rigaDiario(profumi.find(p=>p.id===id));
  disegnaNumeri();disegnaDiario();
  if(document.getElementById("vista-layering")?.classList.contains("attiva"))disegnaLayering();
  if(document.getElementById("fondale-oggi")?.classList.contains("aperto"))disegnaOggi();
}

let sincronizzando=false;
async function sincronizzaDiario(){
  if(sincronizzando||!ORIGINE_DATI.appsScript)return;
  sincronizzando=true;
  try{
    for(const o of leggiCoda()){
      const q=new URLSearchParams({azione:"diario",op:o.op,id:o.id,data:o.data,t:o.t});
      const r=await fetch(ORIGINE_DATI.appsScript+"?"+q,{method:"POST",redirect:"follow"});
      const e=await r.json();
      // un rifiuto del foglio (voce non valida) toglie la voce dalla coda;
      // un errore di rete o un Web App vecchio la lasciano li' per la prossima
      if(!e||(!e.ok&&(!e.errore||/sconosciuta:/.test(e.errore))))break;
      if(e.ok){
        if(o.op==="metti")diarioFoglio.push({data:o.data,id:+o.id,t:String(o.t)});
        else diarioFoglio=diarioFoglio.filter(v=>String(v.t)!==String(o.t));
      }
      scriviCoda(leggiCoda().filter(x=>!(x.op===o.op&&String(x.t)===String(o.t))));
      const c=leggiCache();if(c){c.diario=diarioFoglio;scriviCache(c)}
    }
  }catch(e){/* rete assente: si riprova al prossimo avvio o al prossimo tocco */}
  finally{sincronizzando=false}
}
const goccia='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 3h6M10 3v3h4V3M8 9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/><path d="M8 13h8"/></svg>';
function rigaDiario(p){
  if(!p)return "";
  const oggi=indossatoOggi(p.id),n=vociDi(p.id).length,g=giorniDa(p.id);
  const lay=oggi&&layeringDel(oggiISO()),inLay=lay&&(lay.sotto?.id===p.id||lay.sopra?.id===p.id);
  return `<button class="btn-indossa${oggi?" fatto":""}" onclick="event.stopPropagation();indossa(${p.id})">${oggi?spunta+(inLay?"In layering oggi":"Indossato oggi"):goccia+"Lo metto oggi"}</button>
    <span class="diario-nota">${n?`${n} ${n===1?"volta":"volte"} · l'ultima ${quandoFu(g)}`:"Mai segnato nel diario"}</span>`;
}

/* "EDP · 100 ml", e il residuo quando la boccetta non e' piu' piena. Le
   colonne formato_ml e residuo_pct c'erano gia' nel foglio: l'app non le
   mostrava. */
function formato(p){
  if(!p.formatoMl)return "";
  let t=` · ${p.formatoMl} ml`;
  if(p.residuoPct!=null&&p.residuoPct!==""&&+p.residuoPct<100)t+=` · ${p.residuoPct}%`;
  return t;
}

/* Originale e clone si riconoscono dal nome: clone_di contiene "Marchio
   Profumo" dell'originale. Se l'originale e' in collezione — anche come
   campione — le due schede si puntano a vicenda. */
const chiaveNome=t=>String(t).split(" (")[0].toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const originaleDi=p=>p.dupe?profumi.find(q=>q.id!==p.id&&chiaveNome(q.brand+" "+q.name)===chiaveNome(p.dupe))||null:null;
const copieDi=p=>profumi.filter(q=>q.id!==p.id&&q.dupe&&chiaveNome(q.dupe)===chiaveNome(p.brand+" "+p.name));

/* Porta a un profumo da qualunque punto: sceglie la vetrina giusta, toglie i
   filtri che potrebbero nasconderlo, apre la scheda e ci scorre sopra. */
/* Da dove parte il salto: la miniatura dentro l'elemento toccato. Le chiamate
   arrivano da onclick in linea, quindi l'evento e' quello globale. */
function miniaturaToccata(){
  const e=window.event,t=e&&e.target&&e.target.closest?e.target:null;
  if(!t)return null;
  const box=t.closest(".tessera,.oggi-alt,.oggi-medaglia,.oggi-riga,.oggi-scelta,.cl-riga,.clone,.chiuso,.pila-riga,.candidato-gia,.oggi-strato,button,a")||t;
  return box.querySelector(".mini img,.faretto img,.cf-foto img")||null;
}
function vaiAlProfumo(id){
  const p=profumi.find(x=>x.id===id);
  if(!p)return;
  const da=miniaturaToccata();
  if(da&&document.startViewTransition&&!riduci.matches){
    /* Il volo: la miniatura toccata diventa la boccetta della teca. Il salto
       dentro la transizione scorre di colpo: il browser fotografa la pagina
       d'arrivo e la boccetta atterra dove sta davvero. */
    da.style.viewTransitionName="boccetta-in-volo";
    const arrivo=()=>document.getElementById("esame-"+id)||document.querySelector(`#teca-${id} .faretto img`);
    const t=document.startViewTransition(()=>{
      da.style.viewTransitionName="";
      presaDiretta=true;saltaAlProfumo(p,"instant");presaDiretta=false;
      const a=arrivo();if(a)a.style.viewTransitionName="boccetta-in-volo";
    });
    t.finished.finally(()=>{const a=arrivo();if(a)a.style.viewTransitionName=""});
    return;
  }
  saltaAlProfumo(p,"smooth");
}
function saltaAlProfumo(p,scorri){
  const id=p.id;
  filtriAttivi.clear();noteAttive.clear();testoCerca="";
  const c=document.getElementById("cerca");if(c)c.value="";
  const v=eCampione(p)?"campioni":"boccette";
  if(v!==vetrina)cambiaVetrina(v);else disegna();
  cambiaVista("collezione");
  // la barra si misura adesso che e' di nuovo visibile: da un'altra vista e' alta zero
  const barra=document.getElementById("strumenti");
  if(barra)document.documentElement.style.setProperty("--altezza-strumenti",barra.offsetHeight+"px");
  // la scheda e' gia' nel DOM: si apre subito, senza aspettare un fotogramma
  // che in una scheda del browser in secondo piano potrebbe non arrivare mai
  const t=document.getElementById("teca-"+id);
  if(!t)return;
  // prima si arriva, poi si apre: il pannello largo calcola il suo scorrimento
  // dalla posizione della card, e farlo prima lo sommava al salto
  t.scrollIntoView({block:"start",behavior:scorri});
  if(t.getAttribute("data-open")!=="true"&&tecaNelPannello!==t)apriTeca(id);
}

// ── LA RUOTA DEGLI ACCORDI ────────────────────────────────────────────────
/* Sette raggi, uno per famiglia di accordi (le stesse sette tinte delle
   etichette). Ogni accordo pesa per posizione, come nelle somiglianze, e il
   profilo e' la quota di ciascuna famiglia: due profumi si confrontano sulla
   stessa scala. Gli accordi che non appartengono a nessuna famiglia restano
   fuori dal conto.
   Nel confronto le serie hanno tre colori fissi, nell'ordine in cui i profumi
   sono entrati: oro brunito, blu, rosa. Validati per il fondo scuro (banda di
   luminosita', croma, separazione anche per i daltonici, contrasto). */
const raggiRuota=[["acqua","Acquatico"],["agrume","Agrumato"],["spezia","Speziato"],["dolce","Dolce"],["fumo","Cuoio e fumo"],["cipria","Cipriato"],["bosco","Legnoso"]];
const coloriSerie=["#b8892d","#5685d4","#a63f66"];
const famigliaDi=(()=>{const m={};for(const f in famigliaAccordo)famigliaAccordo[f].forEach(a=>m[a.toLowerCase()]=f);return a=>m[String(a).toLowerCase()]})();
function profiloAccordi(p){
  const q={};raggiRuota.forEach(([k])=>q[k]=0);
  let tot=0;
  (p.accordi||[]).forEach((a,i)=>{const f=famigliaDi(a);if(!f)return;const w=1/(1+i*.35);q[f]+=w;tot+=w});
  if(tot)for(const k in q)q[k]/=tot;
  return q;
}
function ruotaAccordi(lista,{nomi=false}={}){
  const W=320,H=268,cx=W/2,cy=H/2+4,R=92,n=raggiRuota.length;
  const profili=lista.map(profiloAccordi);
  // la scala si adatta al profumo piu' sbilanciato, ma non scende sotto il 40%
  const max=Math.max(.4,Math.ceil(Math.max(...profili.flatMap(q=>Object.values(q)))*10)/10);
  const ang=i=>-Math.PI/2+i*2*Math.PI/n;
  const pt=(i,v)=>[cx+Math.cos(ang(i))*R*v/max,cy+Math.sin(ang(i))*R*v/max];
  let s=`<svg class="ruota" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ruota degli accordi${lista.length>1?" a confronto":""}">`;
  // griglia recessiva: tre anelli e i raggi
  [1/3,2/3,1].forEach(f=>{s+=`<polygon class="ruota-anello" points="${raggiRuota.map((_,i)=>pt(i,max*f).map(x=>x.toFixed(1)).join(",")).join(" ")}"/>`});
  raggiRuota.forEach((_,i)=>{const [x,y]=pt(i,max);s+=`<line class="ruota-raggio" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`});
  s+=`<text class="ruota-scala" x="${cx+4}" y="${(cy-R-4).toFixed(1)}">${Math.round(max*100)}%</text>`;
  // etichette dei raggi: inchiostro di testo, un pallino della tinta della famiglia
  raggiRuota.forEach(([k,l],i)=>{
    const [x,y]=pt(i,max*1.2),c=Math.cos(ang(i)),anc=Math.abs(c)<.2?"middle":c>0?"start":"end";
    s+=`<g class="ruota-eti"><circle cx="${(anc==="start"?x-7:anc==="end"?x+7:x).toFixed(1)}" cy="${(y-(anc==="middle"?11:0)).toFixed(1)}" r="3" fill="${tintaAccordo[k]}"/>
      <text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" text-anchor="${anc}">${l}</text></g>`;
  });
  // le serie: area tenue, contorno di 2px, vertici con anello del colore di fondo
  profili.forEach((q,j)=>{
    const col=coloriSerie[j%coloriSerie.length],punti=raggiRuota.map(([k],i)=>pt(i,q[k]));
    s+=`<polygon class="ruota-area" points="${punti.map(p=>p.map(x=>x.toFixed(1)).join(",")).join(" ")}" style="fill:${col};stroke:${col}"/>`;
  });
  profili.forEach((q,j)=>{
    const col=coloriSerie[j%coloriSerie.length],nome=lista[j].name;
    raggiRuota.forEach(([k,l],i)=>{
      if(!q[k])return;
      const [x,y]=pt(i,q[k]);
      s+=`<g class="ruota-punto"><circle class="ruota-presa" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11"/>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" style="fill:${col}"/>
        <title>${esc(nome)} · ${l}: ${Math.round(q[k]*100)}%</title></g>`;
    });
  });
  s+=`</svg>`;
  const legenda=lista.length>1?`<div class="ruota-legenda">${lista.map((p,j)=>`<span><i style="background:${coloriSerie[j]}"></i>${esc(p.name)}</span>`).join("")}</div>`:"";
  return `<div class="ruota-box">${legenda}${s}</div>`;
}

// ── LA BOCCETTA IN MANO ───────────────────────────────────────────────────
/* Aprire una scheda e' prendere la boccetta dallo scaffale per guardarla da
   vicino: si stacca dalla nicchia, si alza inclinandosi un poco, come presa
   in mano, e si posa in grande accanto ai dettagli. Chiudendo, torna al suo
   posto. Il volo e' una copia dell'immagine che viaggia sopra la pagina;
   segue le due posizioni fotogramma per fotogramma, cosi' arriva giusta anche
   se intanto la pagina scorre o il pannello si apre. */
const DURATA_MANO=640;
let presaDiretta=false;
function vola(da,a,{alla_fine}={}){
  // da: elemento o rettangolo di partenza; a: elemento d'arrivo
  const rDa=()=>da instanceof Element?(da.isConnected?da.getBoundingClientRect():r0):da;
  const r0=da instanceof Element?da.getBoundingClientRect():da;
  const src=(da instanceof Element?da:a).getAttribute("src");
  if(!src||!r0.width){alla_fine&&alla_fine();return}
  const f=document.createElement("img");f.src=src;f.className="boccetta-in-volo";f.alt="";
  f.style.cssText=`left:${r0.left}px;top:${r0.top}px;width:${r0.width}px;height:${r0.height}px`;
  document.body.appendChild(f);
  a.style.visibility="hidden";
  const t0=performance.now(),ease=x=>1-Math.pow(1-x,4);
  const passo=t=>{
    const k=Math.min(1,(t-t0)/DURATA_MANO),e=ease(k),r1=rDa(),r2=a.getBoundingClientRect();
    const x=r1.left+(r2.left-r1.left)*e,y=r1.top+(r2.top-r1.top)*e,w=r1.width+(r2.width-r1.width)*e,h=r1.height+(r2.height-r1.height)*e;
    const su=Math.sin(Math.PI*k);          // a meta' strada e' piu' in alto, inclinata, con l'ombra lunga
    f.style.left=x+"px";f.style.top=(y-su*34)+"px";f.style.width=w+"px";f.style.height=h+"px";
    f.style.transform=`rotate(${(-7*su).toFixed(2)}deg) scale(${(1+su*.07).toFixed(3)})`;
    f.style.filter=`drop-shadow(0 ${(6+su*22).toFixed(1)}px ${(8+su*16).toFixed(1)}px rgba(0,0,0,${(.35+su*.25).toFixed(2)}))`;
    if(k<1){requestAnimationFrame(passo);return}
    a.style.visibility="";f.remove();alla_fine&&alla_fine();
  };
  requestAnimationFrame(passo);
}
const immagineEsame=c=>document.getElementById("esame-"+c.id.slice(5));
/* Sul telefono la card si apre in se' e il banco d'esame sta sotto: la
   pagina accompagna la boccetta, scorrendo insieme al volo finche' il banco
   arriva sotto la barra degli strumenti. Chiudendo fa il contrario, se la
   card e' rimasta sopra lo schermo. Su schermo largo ci pensa il pannello. */
const cimaLibera=()=>{const b=document.getElementById("strumenti");return (b&&b.offsetParent?b.offsetHeight:0)+14};
function accompagna(versoY){
  if(colonneVetrina()>1)return;
  const d=versoY-cimaLibera();
  if(Math.abs(d)<8)return;
  const da=scrollY,t0=performance.now(),ease=x=>1-Math.pow(1-x,4);
  const passo=t=>{const k=Math.min(1,(t-t0)/DURATA_MANO);scrollTo(0,da+d*ease(k));if(k<1)requestAnimationFrame(passo)};
  requestAnimationFrame(passo);
}
function prendiInMano(c){
  const scaffale=c.querySelector(".faretto img"),esame=immagineEsame(c);
  if(!scaffale||!esame)return;
  if(!presaDiretta)accompagna(esame.closest(".esame").getBoundingClientRect().top);
  c.classList.add("in-mano");                 // la nicchia resta vuota, illuminata
  // arrivando da un'altra vista la boccetta vola gia' (View Transitions): qui si posa e basta
  if(riduci.matches||presaDiretta){esame.classList.add("posata");return}
  esame.classList.remove("posata");
  vola(scaffale,esame,{alla_fine:()=>esame.classList.add("posata")});
}
function riponi(c,daRett){
  const scaffale=c.querySelector(".faretto img");
  const cima=c.getBoundingClientRect().top;
  if(cima<cimaLibera())accompagna(cima);
  if(!scaffale||riduci.matches||!daRett||!daRett.width){c.classList.remove("in-mano");return}
  vola(daRett,scaffale,{alla_fine:()=>c.classList.remove("in-mano")});
  // durante il ritorno la nicchia e' ancora vuota: la boccetta e' quella in volo
}


// ── LA LUCE SUL VETRO ─────────────────────────────────────────────────────
/* Col mouse la nicchia si inclina verso il puntatore e un riflesso la segue
   (card hover tilt di transitions.dev). Un solo ascoltatore per tutta la
   pagina: le teche si ridisegnano spesso, e legarne uno a ciascuna vorrebbe
   dire riattaccarli ogni volta. */
const riduci=matchMedia("(prefers-reduced-motion: reduce)");
const INCLINAZIONE=16;      // gradi ai bordi della nicchia
let nicchiaInclinata=null;
function raddrizza(n){
  n.classList.remove("is-hover");
  const c=n.querySelector(".t-tilt-card");if(!c)return;
  c.classList.remove("is-tilting");
  c.style.setProperty("--tilt-rx","0deg");c.style.setProperty("--tilt-ry","0deg");
}
document.addEventListener("pointermove",e=>{
  if(e.pointerType!=="mouse")return;
  const n=riduci.matches?null:e.target.closest&&e.target.closest(".nicchia.t-tilt");
  if(n!==nicchiaInclinata){if(nicchiaInclinata)raddrizza(nicchiaInclinata);nicchiaInclinata=n}
  if(!n)return;
  const c=n.querySelector(".t-tilt-card");if(!c)return;
  const r=n.getBoundingClientRect();
  const px=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),py=Math.min(1,Math.max(0,(e.clientY-r.top)/r.height));
  n.classList.add("is-hover");c.classList.add("is-tilting");
  c.style.setProperty("--tilt-ry",((px-.5)*INCLINAZIONE).toFixed(2)+"deg");
  c.style.setProperty("--tilt-rx",((.5-py)*INCLINAZIONE).toFixed(2)+"deg");
  c.style.setProperty("--tilt-gx",(px*100).toFixed(1)+"%");
  c.style.setProperty("--tilt-gy",(py*100).toFixed(1)+"%");
},{passive:true});
document.addEventListener("pointerleave",()=>{if(nicchiaInclinata){raddrizza(nicchiaInclinata);nicchiaInclinata=null}});
// all'apertura un riflesso attraversa il vetro: e' la luce che il dito non puo' muovere
function riflesso(c){
  const r=c&&c.querySelector(".riflesso");
  if(!r||riduci.matches)return;
  r.classList.remove("passa");void r.offsetWidth;r.classList.add("passa");
}

function cambiaVetrina(v){
  if(v===vetrina)return;
  vetrina=v;
  filtriAttivi.clear();noteAttive.clear();   // le scelte rapide cambiano con la vetrina
  document.querySelectorAll(".vetrina").forEach(b=>
    b.setAttribute("aria-selected",String(b.dataset.vetrina===v)));
  muoviVetrina(true);
  svuotaConfronto();       // il tavolo del confronto non mescola le due vetrine
  disegna();
  window.scrollTo({top:0,behavior:"instant"});
}

/* Stessa meccanica della pillola del timone: la posizione la scrive il JS,
   il resto lo fa il CSS. Al primo disegno va messa senza transizione. */
function muoviVetrina(animata){
  const barra=document.querySelector(".vetrine");
  const pil=barra?.querySelector(".t-tabs-pill");
  const att=barra?.querySelector('.vetrina[aria-selected="true"]');
  if(!pil||!att)return;
  const scrivi=()=>{pil.style.transform=`translateX(${att.offsetLeft}px)`;pil.style.width=`${att.offsetWidth}px`};
  if(animata){scrivi();return}
  const prec=pil.style.transition;
  pil.style.transition="none";scrivi();void pil.offsetWidth;pil.style.transition=prec;
}

const selezione=()=>inVetrina().filter(p=>passa(p,filtriAttivi,noteAttive))
  .sort((a,b)=>{const fn=ordinamenti[ordine].fn,va=fn(a),vb=fn(b);return typeof va==="number"?va-vb:va<vb?-1:va>vb?1:0});
const quanti=(f,n)=>inVetrina().filter(p=>passa(p,f,n)).length;

// ── PIRAMIDE OLFATTIVA ────────────────────────────────────────────────────
/* La piramide arriva dal foglio come testo ("Testa: a, b · Cuore: … · Fondo: …")
   e diventa tre file di tessere, come su Fragrantica. Le icone sono emoji
   scelte nota per nota: le illustrazioni di Fragrantica non sono nostre.
   L'ordine conta, vince la prima regola che combacia: "legno di cedro" e'
   un legno, "cedro" da solo e' l'agrume. */
const iconeNote=[
  [/pepe|pimento|peperoncino|timur|timut|pepperwood/,"🌶️"],          // prima della rosa: "pepe rosa" e' un pepe
  [/legno di cedro|cedro (del|della|dell)|cipresso|pino|abete/,"🌲"],[/bacche di ginepro|ginepro|ribes|mirtill/,"🫐"],
  [/cedro|limone|lime|bergamotto|yuzu/,"🍋"],[/mandarino|arancia|pompelmo|chinotto|agrumi|clementin/,"🍊"],
  [/fiore d'arancio|neroli|zagara|mimosa|gelsomino|tuberosa|ylang/,"🌼"],[/rosa/,"🌹"],[/iris/,"⚜️"],[/lavanda/,"🪻"],
  [/violetta|eliotropio/,"🌸"],[/orchidea|geranio|pelargonio/,"🌺"],
  [/mela caramellata/,"🍎"],[/mela/,"🍏"],[/ananas/,"🍍"],[/melone/,"🍈"],[/cocco/,"🥥"],[/lampone|fragola/,"🍓"],
  [/prugna|frutti|fruttat/,"🍑"],[/frutto della passione|mango/,"🥭"],[/castagna/,"🌰"],
  [/rum|cognac|whisky|brandy|liquore/,"🥃"],[/aceto/,"🍷"],[/caffè/,"☕"],[/cacao|cioccolat|pralina/,"🍫"],
  [/vaniglia/,"🍦"],[/tonka/,"🫘"],[/miele/,"🍯"],[/gourmand|caramell/,"🍬"],[/sesamo/,"🌾"],
  [/zenzero/,"🫚"],[/cardamomo/,"🫛"],[/zafferano/,"🏵️"],
  [/cannella|noce moscata|chiodi di garofano|spezie|speziat/,"🌰"],
  [/erba mate|maté/,"🧉"],[/foglia di tè|tè /,"🍵"],[/menta/,"🌱"],[/tabacco/,"🍂"],[/foglia|patchouli/,"🍃"],
  [/rosmarino|salvia|timo|basilico|coriandolo|artemisia|davana|note verdi|cannabis|muschio di quercia|mastice|lentisco/,"🌿"],
  [/vetiver|papiro/,"🌾"],[/betulla|fumo|affumicat/,"🔥"],[/incenso|olibano|mirra|elemi/,"🕯️"],
  [/benzoino|labdano|resin|balsam/,"🍯"],[/ambra grigia|ambroxan/,"🐋"],[/ambra/,"🔶"],
  [/agar|oud|sandalo|quercia|guaiaco|legn|boschiv/,"🪵"],[/cuoio|pelle|scamosciata/,"🧤"],[/animal/,"🐾"],
  [/cashmeran|muschio/,"☁️"],[/acqua di mare|marin|aquozone|calone|acquatic/,"🌊"],[/acqua/,"💧"],[/sale/,"🧂"],[/minerali/,"🪨"],[/ozon/,"💨"]
];
const iconaNota=n=>{const t=n.toLowerCase();const r=iconeNote.find(([re])=>re.test(t));return r?r[1]:""};
function piramideDi(p){
  const testo=(p.note||"").trim();
  if(!testo)return [];
  const livelli=testo.split(/\s*·\s*/).map(pezzo=>{
    const m=pezzo.match(/^(testa|cuore|fondo|note)\s*:\s*(.*)$/i);
    return {nome:m?m[1][0].toUpperCase()+m[1].slice(1).toLowerCase():"Note",
      note:(m?m[2]:pezzo).split(/\s*,\s*/).map(x=>x.trim()).filter(Boolean)};
  }).filter(l=>l.note.length);
  return livelli;
}
const principale=(p,n)=>(p.noteElenco||[]).some(x=>{const a=x.toLowerCase(),b=n.toLowerCase();return a===b||b.includes(a)||a.includes(b)});
const accesa=n=>[...noteAttive].some(x=>n.toLowerCase().includes(x));
const tesseraNota=(p,n)=>`<span class="nota-t${principale(p,n)?" chiave":""}${accesa(n)?" accesa":""}">
  <span class="nota-i">${iconaNota(n)||`<b>${esc(n[0].toUpperCase())}</b>`}</span><span class="nota-n">${esc(n)}</span></span>`;
const sottoLivello={Testa:"apertura",Cuore:"dopo la prima mezz'ora",Fondo:"quello che resta"};
function bloccoPiramide(p){
  const l=piramideDi(p);
  if(!l.length)return "";
  return `<div class="piramide">${l.map(x=>`<div class="piramide-livello">
      <div class="piramide-nome"><span class="incisa">${x.nome}</span>${sottoLivello[x.nome]?`<small>${sottoLivello[x.nome]}</small>`:""}</div>
      <div class="piramide-note">${x.note.map(n=>tesseraNota(p,n)).join("")}</div></div>`).join("")}
    ${(p.noteElenco||[]).length?`<div class="piramide-legenda"><span class="nota-t chiave mini-l"><span class="nota-i"></span></span>note principali secondo Fragrantica</div>`:""}</div>`;
}
// sulla card chiusa: le note principali, con icona; se mancano, la piramide come testo
function rigaNote(p){
  const el=p.noteElenco||[];
  if(!el.length)return `<p class="note-riga">${evidenzia(p.note)}</p>`;
  return `<div class="note-chiave">${el.map(n=>`<span class="nota-c${accesa(n)?" accesa":""}"><i>${iconaNota(n)||"·"}</i>${esc(n)}</span>`).join("")}</div>`;
}

function evidenzia(testo){
  if(!noteAttive.size)return esc(testo);
  let o=esc(testo);
  noteAttive.forEach(n=>{o=o.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"gi"),m=>"<mark>"+m+"</mark>")});
  return o;
}

// ── LA TECA ───────────────────────────────────────────────────────────────
const piu='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
const spunta='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';

function costruisciTeca(p,i){
  const src=p.img,cl=vetroClasse[p.colore];
  const nicchia=src
    ?`<div class="faretto t-tilt-card"><img src="${src}" alt="Flacone di ${esc(p.brand)} ${esc(p.name)}" loading="lazy" decoding="async"><div class="t-tilt-glare"></div><div class="riflesso"></div></div>
      <div class="specchio" aria-hidden="true"><img src="${src}" alt=""></div>`
    :`<div class="faretto vuoto">${vetroLettera[p.colore]}</div><div class="specchio"></div>`;
  const usi=Object.keys(usoLabels).map(k=>{
    const v=p[k],c=v==="si"?"si":v==="si-mod"?"forse":"no";
    return `<div class="uso ${c}"><span class="punto ${c}"></span>${usoLabels[k]}</div>`;
  }).join("");
  const accordi=p.accordi.slice(0,3).map(a=>`<span class="accordo" style="color:${coloreAccordo(a)}">${a}</span>`).join("");
  const presa=insiemeConfronto.has(p.id);
  const ric=strati.get(p.id)||[];
  const orig=originaleDi(p),copie=copieDi(p);
  const legame=(q,testo)=>`<button class="strato" onclick="event.stopPropagation();vaiAlProfumo(${q.id})">
                ${iconaLegame}<span>${testo} <b>${esc(q.name)}</b></span><span class="strato-ruolo">№ ${numeroDi(q.id)}</span></button>`;
  const bloccoLegami=(orig||copie.length)?`
          <div class="strati t-stagger-line t-stagger-line--4">
            <div class="incisa">Parentele</div>
            <div class="strati-elenco">
              ${orig?legame(orig,eCampione(orig)?"L'originale, tra i campioni:":"L'originale, in collezione:"):""}
              ${copie.map(q=>legame(q,eCampione(q)?"Il suo clone, tra i campioni:":"Il suo clone, in collezione:")).join("")}
            </div>
          </div>`:"";
  const simili=similiA(p);
  const bloccoSimili=simili.length?`
          <div class="strati t-stagger-line t-stagger-line--4">
            <div class="incisa">Somiglia a</div>
            <div class="simili">${simili.map(({q,v})=>`<button class="simile" onclick="event.stopPropagation();vaiAlProfumo(${q.id})">
              ${miniatura(q)}<span class="simile-nome">${esc(q.name)}<small>${eCampione(q)?"campione":esc(q.brand)}</small></span>
              <span class="simile-affinita" style="--v:${Math.round(v*100)}%">${Math.round(v*100)}%</span></button>`).join("")}</div>
          </div>`:"";
  const bloccoStrati=ric.length?`
          <div class="strati t-stagger-line t-stagger-line--4">
            <div class="incisa">Layering</div>
            <div class="strati-elenco">
              ${ric.map(r=>`<button class="strato" onclick="event.stopPropagation();vaiAllaRicetta(${r.i})">
                ${iconaStrati}<span>${esc(r.nome)}</span><span class="strato-ruolo">${r.ruolo}</span>
              </button>`).join("")}
            </div>
          </div>`:"";
  return `<article class="teca t-acc ${cl}${presa?" presa":""}" data-open="false" id="teca-${p.id}" style="animation-delay:${Math.min(i*40,280)}ms"
    tabindex="0" role="button" aria-expanded="false" onclick="apriTeca(${p.id})"
    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();apriTeca(${p.id})}">
    <div class="corpo">
      <div class="esposizione">
        <div class="nicchia t-tilt">${nicchia}<div class="ripiano"></div></div>
        <div class="cartellino">
          <div class="riga-marca"><span class="marca">${esc(p.brand)}</span><span class="catalogo">№ ${numeroDi(p.id)}</span></div>
          <h2 class="nome">${esc(p.name)}</h2>
          <div class="targhette">
            <span class="targa grado">${p.conc}${formato(p)}</span>
            <span class="targa voto">${p.rating?`★ ${voto(p.rating)}`:"★ n.d."}</span>
            ${p.dupe?`<span class="targa copia">Copia di ${esc(p.dupe.split(" (")[0])}</span>`:""}
            ${ric.length?`<span class="targa strati-conta">${iconaStrati}${ric.length} ${ric.length===1?"ricetta":"ricette"}</span>`:""}
          </div>
        </div>
        <span class="t-tt-wrap">
          <span class="gemma ${cl}" aria-label="${vetroNome[p.colore]}">${vetroLettera[p.colore]}</span>
          <span class="t-tt" role="tooltip">${vetroNome[p.colore]}</span>
        </span>
      </div>
      ${rigaNote(p)}
      <div class="accordi">${accordi}</div>
      <div class="contrassegni">
        <span class="segno stag">${stagLbl(p.stagione)}</span>
        <span class="segno">${momLbl(p.momento)}</span>
        <span class="segno ore">${p.longevita?p.longevita+"h":"durata n.d."}</span>
        <span class="segno">${p.famiglia}</span>
      </div>
      <div class="scheda-int t-acc-panel">
        <div class="scheda-int-int t-acc-panel-inner t-stagger">
          ${p.img?`<div class="esame" aria-hidden="true"><div class="esame-luce"></div><div class="esame-vetro"><img class="esame-img" id="esame-${p.id}" src="${p.img}" alt=""></div><div class="esame-ombra"></div></div>`:""}
          ${piramideDi(p).length?`<div class="incisa t-stagger-line t-stagger-line--1 lato-piramide titolo">Piramide olfattiva</div>
          <div class="t-stagger-line t-stagger-line--1 lato-piramide">${bloccoPiramide(p)}</div>`:""}
          <div class="incisa t-stagger-line t-stagger-line--1">Quando indossarlo</div>
          <div class="usi t-stagger-line t-stagger-line--2">${usi}</div>
          <div class="diario-riga t-stagger-line t-stagger-line--2" id="diario-${p.id}">${rigaDiario(p)}</div>
          ${p.accordi&&p.accordi.length?`<div class="incisa t-stagger-line t-stagger-line--3">Ruota degli accordi</div>
          <div class="t-stagger-line t-stagger-line--3">${ruotaAccordi([p])}</div>`:""}
          <p class="racconto t-stagger-line t-stagger-line--3">${rinumera(esc(p.desc))}</p>${bloccoLegami}${bloccoSimili}${bloccoStrati}
        </div>
      </div>
    </div>
    <button class="btn-affianca${presa?" presa":""}" id="affianca-${p.id}"
      onclick="event.stopPropagation();aggiungiAlConfronto(${p.id})"
      aria-label="${presa?"Togli dal confronto":"Aggiungi al confronto"}"><span class="t-icon-swap" data-state="${presa?"b":"a"}"><span class="t-icon" data-icon="a">${piu}</span><span class="t-icon" data-icon="b">${spunta}</span></span></button>
  </article>`;
}

/* Quanto si somigliano due profumi: soprattutto gli accordi, pesati per
   posizione (il primo conta piu' del quinto), poi le note in comune, e un
   piccolo bonus se la famiglia e' la stessa. Da 0 a 1. Sotto 0,3 non si
   mostra: due profumi qualsiasi hanno sempre un "legnoso" in comune. */
function somiglianza(a,b){
  const pesi=l=>{const m=new Map();(l||[]).forEach((x,i)=>m.set(x.toLowerCase(),1/(1+i*.35)));return m};
  const A=pesi(a.accordi),B=pesi(b.accordi);
  let dentro=0,tutto=0;
  new Set([...A.keys(),...B.keys()]).forEach(k=>{const x=A.get(k)||0,y=B.get(k)||0;dentro+=Math.min(x,y);tutto+=Math.max(x,y)});
  const na=new Set((a.noteElenco||[]).map(n=>n.toLowerCase())),nb=new Set((b.noteElenco||[]).map(n=>n.toLowerCase()));
  const comuni=[...na].filter(x=>nb.has(x)).length,unione=new Set([...na,...nb]).size;
  return (tutto?dentro/tutto:0)*.65+(unione?comuni/unione:0)*.25+(a.famiglia===b.famiglia?.1:0);
}
const similiA=(p,quanti=3)=>profumi.filter(q=>q.id!==p.id).map(q=>({q,v:somiglianza(p,q)}))
  .filter(x=>x.v>=.3).sort((a,b)=>b.v-a.v).slice(0,quanti);

function apriTeca(id){
  const c=document.getElementById("teca-"+id);
  if(!c)return;
  if(c.closest("#vista-collezione")&&colonneVetrina()>1)return apriNelPannello(c);
  const esame=immagineEsame(c),rEsame=esame&&esame.getBoundingClientRect();
  const aperta=c.classList.toggle("aperta");   // .aperta accende il faretto
  if(aperta)riflesso(c);
  c.setAttribute("data-open",aperta?"true":"false");  // data-open apre il pannello
  c.setAttribute("aria-expanded",aperta?"true":"false");
  const righe=c.querySelector(".t-stagger");
  if(!righe)return;
  if(aperta){
    righe.classList.remove("is-hiding","is-shown");
    void righe.offsetHeight;          // senza il reflow il rivelo non riparte
    righe.classList.add("is-shown");
    prendiInMano(c);
  }else{
    riponi(c,rEsame);
    righe.classList.add("is-hiding");
    righe.classList.remove("is-shown");
    setTimeout(()=>righe.classList.remove("is-hiding"),200);
  }
}

/* Su schermo largo la griglia resta a righe allineate e la card aperta non si
   allunga: i suoi dettagli scendono in un pannello a tutta larghezza, inserito
   sotto la sua riga. Sul telefono, una colonna sola, la card si apre in se'. */
const colonneVetrina=()=>matchMedia("(min-width:980px)").matches?3:matchMedia("(min-width:680px)").matches?2:1;
const inColonne=(lista,da)=>lista.map((p,i)=>costruisciTeca(p,da+i)).join("");
let colonneDisegnate=null;
addEventListener("resize",()=>{
  const n=colonneVetrina();
  if(colonneDisegnate!==null&&n!==colonneDisegnate&&profumi.length){disegna();return}
  puntaFreccia();
});

// ── PANNELLO DI DETTAGLIO (schermo largo) ─────────────────────────────────
let tecaNelPannello=null;
function chiudiPannello(){
  const pan=document.getElementById("pannello-dettaglio");
  if(tecaNelPannello){
    const c=tecaNelPannello,int=pan&&pan.querySelector(".scheda-int-int");
    const esame=immagineEsame(c),rEsame=esame&&esame.getBoundingClientRect();
    if(int){int.classList.remove("is-shown","is-hiding");c.querySelector(".scheda-int").appendChild(int)}  // il contenuto torna nella sua card
    c.classList.remove("aperta");c.setAttribute("aria-expanded","false");
    riponi(c,rEsame);
    tecaNelPannello=null;
  }
  if(pan)pan.remove();
}
function apriNelPannello(c){
  const gia=tecaNelPannello===c;
  chiudiPannello();
  if(gia)return;
  // l'ultima card della stessa riga: il pannello va subito dopo
  let fine=c;
  for(let x=c.nextElementSibling;x&&x.classList.contains("teca")&&x.offsetTop===c.offsetTop;x=x.nextElementSibling)fine=x;
  const int=c.querySelector(".scheda-int-int");
  const pan=document.createElement("section");
  pan.id="pannello-dettaglio";
  pan.className="pannello-dettaglio t-acc "+[...c.classList].filter(k=>/^(acqua|bosco|ambra)$/.test(k)).join(" ");
  pan.setAttribute("data-open","true");
  pan.setAttribute("aria-label","Dettagli di "+c.querySelector(".nome").textContent);
  pan.innerHTML=`<span class="pannello-freccia"></span>
    <button class="foglio-chiudi pannello-chiudi" onclick="chiudiPannello()" aria-label="Chiudi">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
  pan.classList.toggle("con-piramide",!!int.querySelector(".piramide"));
  pan.appendChild(int);
  fine.after(pan);
  tecaNelPannello=c;
  riflesso(c);
  prendiInMano(c);
  c.classList.add("aperta");c.setAttribute("aria-expanded","true");
  puntaFreccia();
  int.classList.remove("is-hiding","is-shown");void int.offsetHeight;int.classList.add("is-shown");
  const r=pan.getBoundingClientRect();
  /* Si scorre per mostrare il pannello, ma la card resta sempre visibile,
     sotto la barra degli strumenti (che e' fissa): meglio un pannello da
     scorrere che una card scappata in alto. */
  const barra=document.getElementById("strumenti"),cimaLibera=(barra&&barra.offsetHeight||0)+12;
  const top=c.getBoundingClientRect().top,serve=r.bottom-innerHeight+24,margine=top-cimaLibera;
  const d=margine<0?margine:Math.min(serve,margine);
  if(d>0||margine<0)window.scrollBy({top:d,behavior:"smooth"});
}
function puntaFreccia(){
  const pan=document.getElementById("pannello-dettaglio");
  if(!pan||!tecaNelPannello)return;
  pan.style.setProperty("--freccia-x",(tecaNelPannello.offsetLeft+tecaNelPannello.offsetWidth/2-pan.offsetLeft)+"px");
}

function disegna(){
  colonneDisegnate=colonneVetrina();
  tecaNelPannello=null;
  numera();
  strati=indiceStrati();
  const lista=selezione();
  /* Con un filtro o una ricerca attivi, sotto le boccette compaiono anche i
     campioni che rispondono: la domanda e' "cosa ho per questo", e un 2 ml
     adatto e' una risposta. Senza filtri no: la vetrina resta delle boccette. */
  const cercando=filtriAttivi.size||noteAttive.size||testoCerca.trim();
  const extra=vetrina==="boccette"&&cercando?campioni().filter(p=>passa(p,filtriAttivi,noteAttive))
    .sort((a,b)=>{const fn=ordinamenti[ordine].fn,va=fn(a),vb=fn(b);return typeof va==="number"?va-vb:va<vb?-1:va>vb?1:0}):[];
  document.getElementById("vista-collezione").innerHTML=(lista.length
    ? inColonne(lista,0)
    : `<div class="deserto">Nessuna boccetta con questi filtri.<span>${extra.length?"Ma qualcosa c'è tra i campioni, qui sotto.":"Togli un filtro per allargare la ricerca."}</span></div>`)+
    (extra.length?`<div class="divisorio incisa tra-campioni">Anche tra i campioni · ${extra.length}</div>`+
      inColonne(extra,lista.length):"");
  const tot=inVetrina().length;
  const parola=vetrina==="campioni"?" campioni":" boccette";
  scriviConteggio(lista.length, lista.length===tot?parola:` di ${tot}`);
  const conta=document.querySelector(".vetrina-conta");
  if(conta)conta.textContent=campioni().length||"";
  const n=filtriAttivi.size+noteAttive.size;
  const bollo=document.getElementById("bollo-filtri");
  if(n>0)bollo.querySelector(".t-badge-dot").textContent=n;  // in chiusura il
  bollo.dataset.open=n>0?"true":"false";                     // numero resta

  document.getElementById("btn-filtri").classList.toggle("acceso",n>0);
  document.getElementById("btn-mostra").textContent=lista.length===tot?"Mostra la collezione":`Mostra ${lista.length} ${lista.length===1?"boccetta":"boccette"}`;
  document.getElementById("foglio-sotto").textContent=n===0?"Tutta la collezione":`${lista.length} di ${tot} boccette`;
  disegnaAttivi();disegnaRapidi();aggiornaConteggiFoglio();
}

/* Il numero rientra dal basso solo quando cambia davvero: disegna() gira anche
   quando il foglio conferma i dati, e rianimarlo ogni volta sarebbe un tic. */
let ultimoConteggio=null;
function scriviConteggio(numero,coda){
  const el=document.getElementById("conteggio");
  const cambiato=ultimoConteggio!==null&&ultimoConteggio!==numero;
  ultimoConteggio=numero;
  el.innerHTML=`<b class="t-digit-group"></b>${coda}`;
  const gruppo=el.firstChild,cifre=String(numero).split("");
  cifre.forEach((c,i)=>{
    const sp=document.createElement("span");
    sp.className="t-digit";sp.textContent=c;
    if(i===cifre.length-2)sp.dataset.stagger="1";
    else if(i===cifre.length-1)sp.dataset.stagger="2";
    gruppo.appendChild(sp);
  });
  if(!cambiato)return;
  void gruppo.offsetHeight;          // senza il reflow l'animazione non riparte
  gruppo.classList.add("is-animating");
}

// ── SCELTE RAPIDE E FILTRI ATTIVI ─────────────────────────────────────────
function scelta(f,extra,etichetta){
  const insieme=new Set(filtriAttivi);
  if(!filtriAttivi.has(f))insieme.add(f);
  const n=quanti(insieme,noteAttive);
  const on=filtriAttivi.has(f);
  return `<button class="scelta ${extra}${on?" on":""}${(n===0&&!on)?" zero":""}" onclick="commutaFiltro('${f}')" aria-pressed="${on}">
    ${etichetta}<span class="q">${n}</span></button>`;
}
function disegnaRapidi(){
  const a=adesso();
  const oggi=vetrina==="boccette"?`<button class="scelta oggi" onclick="apriOggi()">${ic.stella}Consigliami</button>`:"";
  document.getElementById("rapidi").innerHTML=oggi+
    scelta("adesso","ora",`Adesso · ${a.nome}, ${a.momento}${a.meteo?` · ${a.meteo.temperatura}°`:""}`)+
    scelta("ufficio","","Ufficio")+
    scelta("appuntamento","","Appuntamento")+
    scelta("sera","","Sera")+
    scelta("dupe","","Cloni");
}
function disegnaAttivi(){
  const el=document.getElementById("attivi");
  if(!filtriAttivi.size&&!noteAttive.size){el.classList.remove("mostra");el.innerHTML="";return}
  el.classList.add("mostra");
  const a=[...filtriAttivi].map(f=>`<button class="tolgo" onclick="commutaFiltro('${f}')">${etichetteFiltro[f]||f}<span class="x">×</span></button>`);
  const b=[...noteAttive].map(n=>`<button class="tolgo nota" onclick="commutaNota(&quot;${n}&quot;)">${n}<span class="x">×</span></button>`);
  el.innerHTML=a.join("")+b.join("")+`<button class="tolgo pulisci" onclick="azzeraTutto()">Azzera tutto<span class="x">×</span></button>`;
}
function commutaFiltro(f){
  filtriAttivi.has(f)?filtriAttivi.delete(f):filtriAttivi.add(f);
  disegna();
}
function commutaNota(n){
  noteAttive.has(n)?noteAttive.delete(n):noteAttive.add(n);
  disegna();
}
function azzeraTutto(){filtriAttivi.clear();noteAttive.clear();disegna()}

// ── IL CASSETTO DEI FILTRI ────────────────────────────────────────────────
const gruppiFiltro=[
  {t:"Stagione",v:[["pe","Primavera / Estate"],["ai","Autunno / Inverno"],["tutto","Tutto l'anno"]]},
  {t:"Occasione",v:[["ufficio","Ufficio"],["appuntamento","Appuntamento"],["quotidiano","Quotidiano"],["informale","Informale"],["formale","Formale"],["palestra","Palestra"],["casa","In casa"],["festivita","Festività"]]},
  {t:"Famiglia",v:[["blu","Acquatici e freschi"],["verde","Aromatici e legnosi"],["rosso","Orientali e intensi"]]},
  {t:"Momento",v:[["giorno","Solo giorno"],["sera","Solo sera"],["adesso","Adatti adesso"]]},
  {t:"Provenienza",v:[["dupe","Cloni e dupe"]]}
];
function costruisciFoglio(){
  let h="";
  gruppiFiltro.forEach(g=>{
    h+=`<div class="gruppo"><div class="gruppo-eti incisa">${g.t}</div><div class="ventaglio">`;
    g.v.forEach(([f,lbl])=>{h+=`<button class="scelta" data-f="${f}" onclick="commutaFiltro('${f}')">${lbl}<span class="q"></span></button>`});
    h+=`</div></div>`;
  });
  h+=`<div class="gruppo"><div class="gruppo-eti incisa">Note olfattive</div>
      <div class="ventaglio ${noteEspanse?"":"chiuso"}" id="ventaglio-note">`;
  noteChips.forEach((n,i)=>{
    h+=`<button class="scelta${i>=16?" oltre":""}" data-n="${n}" onclick="commutaNota(&quot;${n}&quot;)">${n.charAt(0).toUpperCase()+n.slice(1)}<span class="q"></span></button>`;
  });
  h+=`</div><button class="altro" id="btn-altre-note" onclick="commutaNote()">${noteEspanse?"Mostra meno note":`Mostra tutte le ${noteChips.length} note`}</button></div>`;
  h+=`<div class="gruppo"><div class="gruppo-eti incisa">Ordina per</div><div class="ventaglio">`;
  Object.entries(ordinamenti).forEach(([k,o])=>{
    h+=`<button class="scelta ord" data-o="${k}" onclick="impostaOrdine('${k}')">${o.lbl}</button>`;
  });
  h+=`</div></div>`;
  document.getElementById("foglio-corpo").innerHTML=h;
}
function commutaNote(){
  noteEspanse=!noteEspanse;
  document.getElementById("ventaglio-note").classList.toggle("chiuso",!noteEspanse);
  document.getElementById("btn-altre-note").textContent=noteEspanse?"Mostra meno note":`Mostra tutte le ${noteChips.length} note`;
}
function aggiornaConteggiFoglio(){
  document.querySelectorAll(".foglio-corpo .scelta[data-f]").forEach(b=>{
    const f=b.dataset.f,on=filtriAttivi.has(f),ins=new Set(filtriAttivi);
    if(!on)ins.add(f);
    const n=quanti(ins,noteAttive);
    b.classList.toggle("on",on);b.classList.toggle("zero",n===0&&!on);
    b.querySelector(".q").textContent=n;
  });
  document.querySelectorAll(".foglio-corpo .scelta[data-n]").forEach(b=>{
    const k=b.dataset.n,on=noteAttive.has(k),ins=new Set(noteAttive);
    if(!on)ins.add(k);
    const n=quanti(filtriAttivi,ins);
    b.classList.toggle("on",on);b.classList.toggle("zero",n===0&&!on);
    b.querySelector(".q").textContent=n;
  });
  document.querySelectorAll(".foglio-corpo .scelta[data-o]").forEach(b=>b.classList.toggle("on",b.dataset.o===ordine));
}
function impostaOrdine(o){ordine=o;disegna()}
/* I tempi si leggono dalle variabili, non si riscrivono qui: se cambi
   --modal-close-dur in transitions.css la pulizia resta in passo. */
const msChiusuraModale=parseFloat(
  getComputedStyle(document.documentElement).getPropertyValue("--modal-close-dur"))||150;

function apriFiltri(){
  const f=document.getElementById("fondale-filtri"),s=f.querySelector(".t-modal");
  f.classList.add("in-scena");
  s.classList.remove("is-closing");
  void f.offsetWidth;              // un fotogramma da fermi, poi si parte
  f.classList.add("aperto");
  s.classList.add("is-open");
  aggiornaConteggiFoglio();
}
function chiudiFiltri(){
  const f=document.getElementById("fondale-filtri"),s=f.querySelector(".t-modal");
  if(!f.classList.contains("aperto"))return;
  f.classList.remove("aperto");
  s.classList.remove("is-open");
  s.classList.add("is-closing");
  setTimeout(()=>{
    f.classList.remove("in-scena");
    s.classList.remove("is-closing");   // senza questo la prossima apertura
  },msChiusuraModale);                  // parte dalla scala di chiusura
}
function chiudiFondale(e){if(e.target===document.getElementById("fondale-filtri"))chiudiFiltri()}

// ── CONSIGLIAMI ───────────────────────────────────────────────────────────
/* Le cinque boccette migliori per l'occasione, la stagione, l'ora e il
   meteo, ognuna con il suo perche'. A parita', vince quella che non metti da piu' tempo:
   il diario serve anche a questo. Per domani vale lo stesso ragionamento,
   spostato all'ora in cui lo metterai. */
const occasioniOggi=[["ufficio","Ufficio"],["quotidiano","Quotidiano"],["appuntamento","Appuntamento"],["formale","Formale"],["casa","In casa"],["festivita","Festività"],["palestra","Palestra"]];
// a che ora, domani, si mette il profumo per quell'occasione
const oraPerOccasione={ufficio:8,quotidiano:9,casa:10,palestra:18,appuntamento:19,formale:19,festivita:19};
let occOggi=null,quandoOggi="oggi";
function inizioPer(quando,occ){
  if(quando==="oggi")return new Date();
  const d=new Date();d.setDate(d.getDate()+1);d.setHours(oraPerOccasione[occ]??9,0,0,0);
  return d;
}
function occasioneProbabile(quando="oggi"){
  if(quando==="domani"){const g=(new Date().getDay()+1)%7;return g>=1&&g<=5?"ufficio":"quotidiano"}
  const a=adesso(),g=a.giorno,feriale=g>=1&&g<=5;
  if(a.momento==="sera")return (g===5||g===6)?"appuntamento":"casa";
  return feriale?"ufficio":"quotidiano";
}
const durataSullaPelle=p=>Math.min(p.longevita||6,12);
/* Il calendario dice la stagione, il termometro dice quanto pesare: a 27
   gradi di fine settembre un orientale denso resta una cattiva idea, a 9
   gradi di maggio un acquatico sparisce. Col caldo umido i densi pesano
   ancora di piu'; con la pioggia legni, resine e terra rendono meglio.
   Si guarda la finestra oraria: il caldo si misura sul picco, il freddo
   sulla minima, la mezza stagione sulla media. */
function effettoMeteo(p,f){
  if(!f)return {s:0,perche:"",contro:""};
  const densi=p.colore==="rosso",freschi=p.colore==="blu";
  let s=0,perche="",contro="";
  if(f.max>=26){s+=freschi?2.5:densi?-3:0;if(f.umid>=70&&densi)s-=1.5;
    if(freschi)perche=`con un picco di ${f.max}° alle ${f.oraMax} serve un fresco`;
    if(densi)contro=`con ${f.max}° rischia di pesare${f.umid>=70?", e l'aria è umida":""}`;}
  else if(f.min<=10){s+=densi?2.5:freschi?-2:0;if(p.stagione==="ai")s+=1;
    if(densi)perche=`con ${f.min}° alle ${f.oraMin} un intenso si sente e dura`;
    if(freschi)contro=`a ${f.min}° un fresco svanisce in fretta`;}
  else if(f.media>=21){s+=freschi?1:densi?-1:0;if(p.stagione==="pe")s+=1;
    if(freschi)perche=`${f.min}–${f.max}°, clima mite: un fresco sta bene`;
    if(densi)contro=`a ${f.min}–${f.max}° è un po' denso`;}
  else if(f.media<=15){s+=densi?1.2:freschi?-1:0;if(p.stagione==="ai")s+=.8;
    if(densi)perche=`${f.min}–${f.max}°, aria fresca: un caldo avvolge bene`;
    if(freschi)contro=`a ${f.min}–${f.max}° un fresco dura poco`;}
  if(f.pioggia!==null&&p.accordi.some(a=>/Legnoso|Terroso|Fumoso|Ambra|Balsamico/.test(a))){s+=1;
    perche=perche||`pioggia dalle ${f.pioggia}: legni e resine rendono bene`}
  return {s,perche,contro};
}
// senza previsione oraria (posizione mai data, o rete assente) vale il meteo di adesso, solo per oggi
function finestraPer(p,da,quando){
  const f=finestraMeteo(da,durataSullaPelle(p));
  if(f||quando!=="oggi")return f;
  const m=adesso().meteo;if(!m)return null;
  return {ore:[],max:m.percepita,min:m.percepita,media:m.percepita,umid:m.umidita,oraMax:da.getHours(),oraMin:da.getHours(),
    pioggia:piove(m)?da.getHours():null,dalle:da.getHours(),alle:da.getHours()};
}
function candidatiOggi(occ,quando=quandoOggi){
  const da=inizioPer(quando,occ),a=adesso(da),st=a.stagione,mo=a.momento,spost=quando==="domani"?1:0;
  return boccette().filter(p=>p[occ]==="si"||p[occ]==="si-mod").map(p=>{
    const g0=giorniDa(p.id),g=g0===null?null:g0+spost,f=finestraPer(p,da,quando),mt=effettoMeteo(p,f);
    /* Il punteggio e i motivi nascono insieme: ogni voce che sposta la
       classifica lascia una frase, a favore o contro. */
    const pro=[],contro=[],nomeSt=st==="pe"?"primavera ed estate":"autunno e inverno";
    let s=mt.s;
    if(p[occ]==="si"){s+=2;pro.push(fraseOccasione[occ])}
    else{s+=.5;contro.push(`${dosatoPer[occ]} va dosato: uno spray`)}
    if(p.stagione===st){s+=3;pro.push(`è di stagione, nato per ${nomeSt}`)}
    else if(p.stagione==="tutto"){s+=2;pro.push("va bene tutto l'anno")}
    else{s-=3;contro.push(`è più da ${p.stagione==="pe"?"primavera ed estate":"autunno e inverno"}`)}
    if(p.momento===mo){s+=2;pro.push(mo==="sera"?"è pensato per la sera":"è pensato per il giorno")}
    else if(p.momento==="entrambi"){s+=2;pro.push("regge giorno e sera")}
    else{s-=2;contro.push(p.momento==="sera"?"darebbe il meglio di sera":"è più da giorno")}
    if(mt.perche)pro.push(mt.perche);
    if(mt.contro)contro.push(mt.contro);
    if(g===null){s+=2.5;pro.push("non l'hai ancora segnato nel diario")}
    else if(g===0){s-=8;contro.push(spost?"lo metti oggi":"l'hai già messo oggi")}
    else if(g===1){s-=2;contro.push(spost?"l'hai messo ieri":"l'hai messo ieri")}
    else{s+=Math.min(g,30)/10;if(g0>=7)pro.push(`non lo metti da ${quandoFu(g0).replace(" fa","")}`)}
    s+=((p.rating||3.9)-3.9)*1.5;
    if(p.rating>=4.3)pro.push(`è tra i più amati su Fragrantica (★ ${voto(p.rating)})`);
    if(p.longevita>=9&&(occ==="appuntamento"||occ==="festivita"||occ==="formale"))pro.push(`dura ${p.longevita}h: arriva a fine serata`);
    return {p,s,g:g0,f,perche:mt.perche,pro,contro};
  }).sort((a,b)=>b.s-a.s);           // tutte le adatte, in ordine: la prima e' la scelta
}
const fraseOccasione={ufficio:"va bene in ufficio",quotidiano:"è da tutti i giorni",appuntamento:"è fatto per un appuntamento",
  formale:"regge un'occasione formale",casa:"è piacevole da tenere in casa",festivita:"ha il tono giusto per una festa",palestra:"è abbastanza leggero per la palestra"};
const dosatoPer={ufficio:"in ufficio",quotidiano:"di giorno",appuntamento:"a un appuntamento",formale:"in un'occasione formale",
  casa:"in casa",festivita:"a una festa",palestra:"in palestra"};
const segnoSi='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
const segnoMa='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 7v6M12 16.5v.5"/></svg>';
const elencoMotivi=(pro,contro)=>`<ul class="motivi">${pro.map(m=>`<li class="si">${segnoSi}<span>${maiuscola(m)}</span></li>`).join("")}${contro.map(m=>`<li class="ma">${segnoMa}<span>${maiuscola(m)}</span></li>`).join("")}</ul>`;
const tagPerOccasione={ufficio:["uff"],quotidiano:["casa","uff"],appuntamento:["app","sera"],formale:["sera"],casa:["casa"],festivita:["sera"],palestra:[]};
function ricettaPer(p,occ){
  const st=adesso(inizioPer(quandoOggi,occ)).stagione,adatta=g=>st==="pe"?!/autunno|inverno/i.test(g):!/estate/i.test(g);
  const r=(strati.get(p.id)||[]).map(x=>({...x,l:layering[x.i]}))
    .map(x=>({...x,s:(tagPerOccasione[occ]||[]).includes(x.l.t)*2+adatta(x.l.g)}))
    .filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  return r[0]||null;
}
function apriOggi(){
  quandoOggi="oggi";occOggi=occasioneProbabile();
  disegnaOggi();
  usaMeteo(false);          // se la posizione c'e' gia', il meteo si rinfresca da solo
  const f=document.getElementById("fondale-oggi"),s=f.querySelector(".t-modal");
  f.classList.add("in-scena");s.classList.remove("is-closing");
  void f.offsetWidth;
  f.classList.add("aperto");s.classList.add("is-open");
}
function chiudiOggi(){
  const f=document.getElementById("fondale-oggi"),s=f.querySelector(".t-modal");
  if(!f.classList.contains("aperto"))return;
  f.classList.remove("aperto");s.classList.remove("is-open");s.classList.add("is-closing");
  setTimeout(()=>{f.classList.remove("in-scena");s.classList.remove("is-closing")},msChiusuraModale);
}
function scegliQuando(q){if(q===quandoOggi)return;quandoOggi=q;occOggi=occasioneProbabile(q);disegnaOggi()}
function scegliOccOggi(k){occOggi=k;disegnaOggi()}
// le ore sulla pelle, in fila: al massimo sette tacche, la pioggia segnata
function striscia(f){
  if(!f||f.ore.length<2)return "";
  const passo=Math.ceil(f.ore.length/7);
  const tacche=f.ore.filter((_,i)=>i%passo===0).map(o=>
    `<span class="ora${piovosa(o)?" pioggia":""}"><small>${new Date(o.t).getHours()}</small>${o.P}°</span>`).join("");
  return `<div class="oggi-ore"><div class="incisa">Sulla pelle dalle ${f.dalle} ${f.alle===0?"a mezzanotte":"alle "+f.alle} · percepiti</div><div class="tacche">${tacche}</div></div>`;
}
function disegnaOggi(){
  const giorni=["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"];
  const domani=quandoOggi==="domani",da=inizioPer(quandoOggi,occOggi),a=adesso(da);
  document.getElementById("oggi-titolo").textContent=domani?"Consigliami per domani":"Consigliami";
  const mezzanotte=new Date(da).setHours(24,0,0,0);   // il resto di oggi finisce a mezzanotte, non 24 ore dopo
  const giornata=finestraMeteo(domani?new Date(new Date(da).setHours(7,0,0,0)):da,domani?16:Math.max(1,(mezzanotte-da)/36e5));
  const testa=domani
    ?`Domani, ${giorni[a.giorno]} · ${a.nome}`+(giornata?` · ${giornata.min}–${giornata.max}° percepiti${giornata.pioggia!==null?`, pioggia dalle ${giornata.pioggia}`:""}`:"")
    :`${giorni[a.giorno].replace(/^./,c=>c.toUpperCase())} ${a.momento==="giorno"?"di giorno":"sera"} · ${a.nome}`+
      (a.meteo?` · ${cieloDi(a.meteo)}${a.meteo.percepita!==a.meteo.temperatura?` (percepiti ${a.meteo.percepita}°)`:""}`:"")+
      (giornata&&giornata.ore.length>1?` · fino a sera ${giornata.min}–${giornata.max}°`:"");
  document.getElementById("oggi-sotto").textContent=testa;
  const c=candidatiOggi(occOggi);
  let h=`<div class="ventaglio oggi-quando">${[["oggi","Oggi"],["domani","Domani"]].map(([k,l])=>
    `<button class="scelta${k===quandoOggi?" on":""}" onclick="scegliQuando('${k}')">${l}</button>`).join("")}</div>`;
  h+=`<div class="ventaglio oggi-occasioni">${occasioniOggi.map(([k,l])=>
    `<button class="scelta${k===occOggi?" on":""}" onclick="scegliOccOggi('${k}')">${l}</button>`).join("")}</div>`;
  if(!c.length){
    h+=`<div class="oggi-vuoto">Nessuna boccetta adatta a questa occasione.</div>`;
  }else{
    /* Tutto in vista: la prima in rilievo, seconda e terza affiancate, le altre
       in elenco sotto, sempre nell'ordine del punteggio. */
    const diarioTesto=g=>g===null?"mai segnato nel diario":g===0?(domani?"messo oggi":"l'hai già messo oggi"):`l'ultima volta ${quandoFu(g)}`;
    const lometto=(p,cls)=>domani?"":`<button class="${cls}${indossatoOggi(p.id)?" fatto":""}" onclick="${indossatoOggi(p.id)?"":`indossa(${p.id});`}chiudiOggi()">${indossatoOggi(p.id)?"Già segnato":"Lo metto"}</button>`;
    /* Cinque, non tutte: la prima con tutti i suoi perche', le altre quattro
       con i tre motivi piu' forti e il contro principale. */
    const [primo,...resto]=c.slice(0,5);
    const {p,f}=primo,cl=vetroClasse[p.colore],r=ricettaPer(p,occOggi);
    const altro=r?profumi.find(x=>x.id===[...r.l.s.matchAll(/№\s*(\d+)/g)].map(m=>+m[1]).find(id=>id!==p.id)):null;
    h+=`<div class="oggi-scelta ${cl}">
      <div class="oggi-nicchia"><div class="faretto acceso">${p.img?`<img src="${p.img}" alt="">`:vetroLettera[p.colore]}</div><div class="ripiano"></div></div>
      <div class="oggi-testo">
        <div class="oggi-conto">Il primo consiglio · su ${c.length} adatte</div>
        <div class="marca">${esc(p.brand)}</div>
        <div class="oggi-nome">${esc(p.name)}</div>
        <div class="oggi-sotto2">${p.conc} · ${esc(p.famiglia)}${domani?` · domani dalle ${da.getHours()}`:""}</div>
      </div>
    </div>
    <div class="incisa oggi-perche">Perché questo</div>
    ${elencoMotivi(primo.pro,primo.contro)}
    ${striscia(f)}
    ${r&&altro?(()=>{const pr=partiRicetta(r.l),fatto=pr.sotto&&pr.sopra&&layeringFatto(pr.sotto.id,pr.sopra.id);
      return `<div class="oggi-strato-riga"><button class="oggi-strato" onclick="chiudiOggi();vaiAllaRicetta(${r.i})">${miniatura(altro)}
      <span><span class="incisa">Se vuoi osare, con</span><b>${esc(altro.name)}</b><small>${esc(r.nome)}</small></span></button>
      ${!domani&&pr.sotto&&pr.sopra?`<button class="oggi-strato-metto${fatto?" fatto":""}" onclick="faiLayering(${pr.sotto.id},${pr.sopra.id})">${fatto?"Segnato":"Lo faccio"}</button>`:""}</div>`})():""}
    <div class="oggi-azioni">
      <button class="${domani?"btn-oro":"btn-ombra"}" onclick="chiudiOggi();vaiAlProfumo(${p.id})">Scheda</button>
      ${lometto(p,"btn-oro")}
    </div>`;
    if(resto.length)h+=`<div class="oggi-sezione incisa">Le alternative</div>`+resto.map((x,i)=>`
      <div class="oggi-alt">
        <button class="oggi-alt-corpo" onclick="chiudiOggi();vaiAlProfumo(${x.p.id})">
          <span class="oggi-posto">${i+2}</span>${miniatura(x.p)}
          <span class="oggi-alt-testo">
            <span class="oggi-alt-nome">${esc(x.p.name)}<small>${esc(x.p.brand)} · ${x.p.conc}</small></span>
            <span class="oggi-alt-perche">${x.pro.slice(0,3).map(maiuscola).join(" · ")}${x.contro.length?`<em> · ma ${x.contro[0]}</em>`:""}</span>
          </span>
        </button>${lometto(x.p,"oggi-alt-metto")}
      </div>`).join("");
  }
  h+=meteo
    ?`<div class="oggi-meteo">Meteo di dove sei, ora per ora, da Open-Meteo · <button class="collegamento" onclick="scordaPosto()">non usarlo più</button></div>`
    :`<button class="oggi-meteo-chiedi" onclick="usaMeteo(true)"${chiedendoPosto?" disabled":""}>${chiedendoPosto?"Cerco la posizione…":"Usa il meteo di dove sei"}</button>
      <div class="oggi-meteo">Serve la posizione, una volta: resta sul telefono, arrotondata a una decina di chilometri.</div>`;
  document.getElementById("oggi-corpo").innerHTML=h;
}

// ── CONFRONTO ─────────────────────────────────────────────────────────────
let insiemeConfronto=new Set();
function aggiungiAlConfronto(id){
  if(insiemeConfronto.has(id))insiemeConfronto.delete(id);
  else{
    if(insiemeConfronto.size>=3){
      const v=document.getElementById("vassoio");
      v.classList.remove("scossa");void v.offsetWidth;v.classList.add("scossa");
      setTimeout(()=>v.classList.remove("scossa"),400);
      return;
    }
    insiemeConfronto.add(id);
  }
  aggiornaPulsante(id);aggiornaVassoio();
}
function aggiornaPulsante(id){
  const card=document.getElementById("teca-"+id),btn=document.getElementById("affianca-"+id);
  const presa=insiemeConfronto.has(id);
  if(card)card.classList.toggle("presa",presa);
  if(btn){btn.classList.toggle("presa",presa);
    btn.querySelector(".t-icon-swap")?.setAttribute("data-state",presa?"b":"a");
    btn.setAttribute("aria-label",presa?"Togli dal confronto":"Aggiungi al confronto")}
}
function svuotaConfronto(){const ids=[...insiemeConfronto];insiemeConfronto.clear();ids.forEach(aggiornaPulsante);aggiornaVassoio()}
function togliDalConfronto(id){insiemeConfronto.delete(id);aggiornaPulsante(id);aggiornaVassoio()}
function aggiornaVassoio(){
  const ids=[...insiemeConfronto],n=ids.length;
  document.getElementById("vassoio").classList.toggle("mostra",n>0&&document.getElementById("vista-collezione").classList.contains("attiva"));
  const c=document.getElementById("caselle");c.innerHTML="";
  for(let i=0;i<3;i++){
    const p=ids[i]?profumi.find(x=>x.id===ids[i]):null;
    const d=document.createElement("div");d.className="casella";
    d.innerHTML=p?(p.img?`<img src="${p.img}" alt="${esc(p.name)}">`:vetroLettera[p.colore]):"+";
    c.appendChild(d);
  }
  document.getElementById("vassoio-conto").textContent=n+" / 3";
  document.getElementById("btn-confronta").disabled=n<2;
  const pal=document.getElementById("pallino");
  if(pal){if(n>0)pal.querySelector(".t-badge-dot").textContent=n;pal.dataset.open=n>0?"true":"false"}
  if(document.getElementById("vista-confronta").classList.contains("attiva"))disegnaConfronto();
}
function disegnaConfronto(){
  const ids=[...insiemeConfronto],cont=document.getElementById("cf-contenuto"),vuoto=document.getElementById("cf-vuoto");
  const torna=`<button class="torna" onclick="cambiaVista('collezione')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m15 6-6 6 6 6"/></svg>Collezione</button>`;
  if(ids.length<2){cont.innerHTML=torna;vuoto.style.display="block";return}
  vuoto.style.display="none";
  const lista=ids.map(id=>profumi.find(p=>p.id===id)).filter(Boolean);
  const votati=lista.filter(p=>p.rating);
  const megR=votati.length?Math.max(...votati.map(p=>p.rating)):null,
        megL=Math.max(...lista.filter(p=>p.longevita).map(p=>p.longevita),0);
  /* Cosa hanno in comune: accordi e note principali presenti in tutti. */
  const tutti=f=>lista.map(f).reduce((a,b)=>a.filter(x=>b.some(y=>y.toLowerCase()===x.toLowerCase())));
  const accComuni=tutti(p=>p.accordi),noteComuni=tutti(p=>p.noteElenco||[]);
  let h=torna+intesta("Confronto","Fianco a fianco. In oro il migliore su rating e durata, e quello che hanno in comune.");
  h+=`<div class="cf-comune"><span class="incisa">In comune</span>${accComuni.length||noteComuni.length
    ?accComuni.map(a=>`<span class="accordo" style="color:${coloreAccordo(a)}">${a}</span>`).join("")+noteComuni.map(n=>`<span class="nota-c"><i>${iconaNota(n)||"·"}</i>${esc(n)}</span>`).join("")
    :`<span class="cf-comune-niente">niente: sono profumi lontani tra loro</span>`}</div>`;
  h+=`<div class="cf-ruota"><div class="incisa">Ruota degli accordi</div>${ruotaAccordi(lista)}</div>`;
  h+=`<div class="cf-tabella"><div class="cf-griglia col${lista.length}">`;
  h+=`<div class="cf-eti" style="border-bottom:1px solid var(--filo-2)"></div>`;
  lista.forEach(p=>{
    h+=`<div class="cf-testa">
      <div class="cf-x" onclick="togliDalConfronto(${p.id})" title="Togli dal confronto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></div>
      <div class="cf-foto">${p.img?`<img src="${p.img}" alt="${esc(p.name)}">`:""}</div>
      <div class="cf-marca">${esc(p.brand)}</div>
      <div class="cf-nome">${esc(p.name)}</div>
      <span class="cf-grado">${p.conc} · № ${numeroDi(p.id)}</span>
      <span class="cf-serie" style="background:${coloriSerie[lista.indexOf(p)%coloriSerie.length]}" title="Colore nella ruota degli accordi"></span>
    </div>`;
  });
  const riga=(lbl,fn)=>{h+=`<div class="cf-eti">${lbl}</div>`;lista.forEach(p=>{h+=fn(p)})};
  h+=`<div class="cf-sez incisa">Profilo</div>`;
  riga("Rating",p=>`<div class="cf-cella${p.rating&&p.rating===megR?" meglio":""}">${p.rating?`★ ${voto(p.rating)}`:"n.d."}</div>`);
  riga("Longevità",p=>`<div class="cf-cella${p.longevita&&p.longevita===megL?" meglio":""}">${p.longevita?p.longevita+"h":"n.d."}</div>`);
  riga("Stagione",p=>`<div class="cf-cella"><span class="cf-segno stag">${stagLbl(p.stagione)}</span></div>`);
  riga("Momento",p=>`<div class="cf-cella" style="font-size:12px">${momLbl(p.momento)}</div>`);
  riga("Famiglia",p=>`<div class="cf-cella"><span class="cf-segno">${p.famiglia}</span></div>`);
  riga("Copia di",p=>`<div class="cf-cella" style="font-size:12px">${p.dupe?esc(p.dupe.split(" (")[0]):"—"}</div>`);
  h+=`<div class="cf-sez incisa">Accordi principali</div>`;
  const comuneA=new Set(accComuni.map(x=>x.toLowerCase())),comuneN=new Set(noteComuni.map(x=>x.toLowerCase()));
  riga("Top accordi",p=>`<div class="cf-cella" style="flex-direction:column;gap:4px">${p.accordi.slice(0,4).map(a=>`<span class="${comuneA.has(a.toLowerCase())?"cf-comune-x":""}" style="font-size:12px;color:${coloreAccordo(a)}">${a}</span>`).join("")}</div>`);
  riga("Note",p=>`<div class="cf-cella cf-note">${(p.noteElenco&&p.noteElenco.length?p.noteElenco:piramideDi(p).flatMap(l=>l.note).slice(0,6))
    .map(n=>`<span class="nota-c${comuneN.has(n.toLowerCase())?" comune":""}"><i>${iconaNota(n)||"·"}</i>${esc(n)}</span>`).join("")}</div>`);
  h+=`<div class="cf-sez incisa">Quando indossarlo</div>`;
  Object.keys(usoLabels).forEach(k=>{
    riga(usoLabels[k],p=>{
      const v=p[k],c=v==="si"?"si":v==="si-mod"?"forse":"no",lab=v==="si"?"Sì":v==="si-mod"?"Con moderazione":"No";
      return `<div class="cf-cella"><span class="punto ${c}"></span><span style="font-size:12px">${lab}</span></div>`;
    });
  });
  h+=`</div></div>`;
  if(lista.length<3)h+=`<div style="text-align:center;padding:18px 0"><button class="btn-ombra" onclick="cambiaVista('collezione')">Aggiungi un terzo profumo</button></div>`;
  cont.innerHTML=h;
}

// ── GUIDA ─────────────────────────────────────────────────────────────────
const ic={
  ufficio:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
  cuore:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  sole:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  calice:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 22h8M12 15v7M5 3h14l-1 6a6 6 0 0 1-12 0L5 3z"/></svg>',
  fulmine:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
  stella:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  casa:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
};
const tinta={acqua:"#7fa8cf",bosco:"#93b98a",ambra:"#d9906f",oro:"#c8a35e"};
const sezioniGuida=[
  {k:"ufficio",breve:"Ufficio",t:"Ufficio e lavoro",sub:"Spazi chiusi condivisi: due spray, sul petto e non sul collo",i:ic.ufficio,c:"acqua",nota:"Gli orientali e i gourmand restano fuori: in una stanza chiusa la scia diventa invadente entro un'ora."},
  {k:"appuntamento",breve:"Appuntamento",t:"Appuntamento e serata",sub:"Dove la scia è un vantaggio",i:ic.cuore,c:"ambra"},
  {k:"quotidiano",breve:"Quotidiano",t:"Quotidiano e casual",sub:"Il guardaroba di tutti i giorni",i:ic.sole,c:"bosco"},
  {k:"formale",breve:"Formale",t:"Formale e cerimonia",sub:"Eleganza misurata, mai dolciastra",i:ic.calice,c:"oro"},
  {k:"palestra",breve:"Palestra",t:"Palestra e sport",sub:"Leggeri, puliti, senza dolcezza",i:ic.fulmine,c:"acqua",nota:"Da evitare: orientali, gourmand e cuoiati. Con il calore corporeo diventano nauseanti."},
  {k:"festivita",breve:"Festività",t:"Festività e inverno",sub:"Avvolgenti, per le sere più fredde",i:ic.stella,c:"oro"},
  {k:"casa",breve:"In casa",t:"In casa e relax",sub:"Per il piacere di sentirli addosso",i:ic.casa,c:"bosco"}
];
/* Ogni ricetta dichiara i due profumi nel sommario, come "№ 3 sotto · № 2
   sopra". Da li' si ricava l'indice inverso: dato un profumo, in quali ricette
   compare e con che ruolo. Si ricalcola a ogni disegno perche' il foglio puo'
   cambiare sotto, ed e' roba da trenta voci: costa nulla. */
function indiceStrati(){
  const m=new Map();
  layering.forEach((r,i)=>{
    const ids=[...r.s.matchAll(/№\s*(\d+)/g)].map(x=>+x[1]);
    ids.forEach((id,posto)=>{
      if(!m.has(id))m.set(id,[]);
      m.get(id).push({i,nome:r.n,gruppo:r.g,ruolo:posto===0?"sotto":"sopra"});
    });
  });
  return m;
}
let strati=new Map();

const iconaLegame='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.5"/><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L12.5 19.5"/></svg>';
const iconaStrati='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 3 7l9 5 9-5-9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg>';

/* Dalla scheda alla ricetta: cambia vista, apre quella giusta e ci porta
   sopra. Il salto aspetta un fotogramma, se no si scorre prima che il
   pannello abbia preso la sua altezza. */
function vaiAllaRicetta(i){
  // un filtro sulle ricette potrebbe nascondere proprio quella cercata
  if(filtroStrati!=="tutte"&&layering[i]&&layering[i].t!==filtroStrati){filtroStrati="tutte";disegnaLayering()}
  cambiaVista("layering");
  const el=document.getElementById("lay-"+i);
  if(!el)return;
  el.setAttribute("data-open","true");
  el.firstElementChild?.setAttribute("aria-expanded","true");
  requestAnimationFrame(()=>el.scrollIntoView({block:"start",behavior:"smooth"}));
}

// ── PEZZI COMUNI DELLE VISTE ──────────────────────────────────────────────
/* La boccetta in piccolo: la stessa nicchia della teca, ridotta. Le quattro
   viste di testo nominavano i profumi e basta; adesso li mostrano, e ogni
   miniatura porta alla sua scheda. */
const miniatura=(p,cls="")=>p?`<span class="mini ${cls}">${p.img
  ?`<img src="${p.img}" alt="" loading="lazy">`
  :`<b class="${vetroClasse[p.colore]||""}">${vetroLettera[p.colore]||"·"}</b>`}</span>`:"";
const tessera=(p,cls="",nota="")=>`<button class="tessera ${cls}" onclick="vaiAlProfumo(${p.id})">
  ${miniatura(p)}<span class="tessera-nome">${esc(p.name)}</span><span class="tessera-sotto">${nota||p.conc}</span></button>`;
const intesta=(titolo,testo)=>`<header class="intesta"><h2>${titolo}</h2><p>${testo}</p></header>`;
const chevron=`<span class="t-acc-chevron"><svg class="freccia" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 9 6 6 6-6"/></svg></span>`;
const ricorda=(k,v)=>{try{localStorage.setItem("sillage."+k,v)}catch(e){}};
const ricordato=(k,d)=>{try{return localStorage.getItem("sillage."+k)||d}catch(e){return d}};

/* Sette occasioni: una alla volta, scelta da una fila di pillole, invece di
   sette cassetti con dentro elenchi di nomi. La stagione in corso viene per
   prima. */
let occasioneGuida=ricordato("guida","ufficio");
function scegliOccasione(k){occasioneGuida=k;ricorda("guida",k);disegnaGuida()}
function disegnaGuida(){
  const B=boccette(),ora=stagioneOra();
  const s=sezioniGuida.find(x=>x.k===occasioneGuida)||sezioniGuida[0];
  const si=B.filter(p=>p[s.k]==="si"),mod=B.filter(p=>p[s.k]==="si-mod");
  const t=tinta[s.c];
  let h=intesta("Guida","Cosa mettere, occasione per occasione. Si aggiorna da sola quando la collezione cambia.");
  h+=`<div class="occasioni" role="tablist">${sezioniGuida.map(x=>{
    // come la scelta rapida "Ufficio": contano i si, i "con moderazione" si vedono dentro
    const n=B.filter(p=>p[x.k]==="si").length,on=x.k===s.k;
    return `<button class="occasione${on?" on":""}" role="tab" aria-selected="${on}" style="--t:${tinta[x.c]}" onclick="scegliOccasione('${x.k}')">
      <span class="occasione-icona">${x.i}</span>${x.breve}<span class="occasione-q">${n}</span></button>`}).join("")}</div>`;
  const ordine=ora==="pe"?["pe","tutto","ai"]:["ai","tutto","pe"];
  let gruppi="";
  ordine.forEach(st=>{
    const l=si.filter(p=>p.stagione===st);
    if(!l.length)return;
    gruppi+=`<div class="os-gruppo"><div class="os-gruppo-eti"><span class="incisa">${stagLbl(st)}</span>
      ${st===ora?`<span class="ora-badge">Stagione in corso</span>`:""}<span class="os-q">${l.length}</span></div>
      <div class="tessere">${l.map(p=>tessera(p)).join("")}</div></div>`;
  });
  if(mod.length)gruppi+=`<div class="os-gruppo"><div class="os-gruppo-eti"><span class="incisa">Con moderazione</span><span class="os-q">${mod.length}</span></div>
      <div class="tessere">${mod.map(p=>tessera(p,"moderato",`${p.conc} · ${stagBreve(p.stagione)}`)).join("")}</div></div>`;
  const prova=campioni().filter(p=>p[s.k]==="si"||p[s.k]==="si-mod");
  if(!si.length&&!mod.length)gruppi=`<div class="os-vuoto">Nessuna boccetta in collezione per questa occasione.</div>`;
  if(prova.length)gruppi+=`<div class="os-gruppo"><div class="os-gruppo-eti"><span class="incisa">Tra i campioni</span><span class="os-q">${prova.length}</span></div>
      <div class="tessere">${prova.map(p=>tessera(p,"campione",`${p.conc} · ${p.formatoMl?p.formatoMl+" ml":"campione"}`)).join("")}</div></div>`;
  h+=`<section class="os" style="--t:${t}">
    <div class="os-testa">
      <div class="os-icona">${s.i}</div>
      <div class="os-titoli"><div class="os-titolo">${s.t}</div><div class="os-sotto">${s.sub}</div></div>
      <div class="os-conto"><b>${si.length}</b><span>${si.length===1?"boccetta":"boccette"}</span></div>
    </div>${gruppi}
    ${s.nota?`<div class="os-nota"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg><span>${s.nota}</span></div>`:""}
  </section>`;
  document.getElementById("vista-guida").innerHTML=h;
}

// ── LAYERING ──────────────────────────────────────────────────────────────
const bolloIcona={uff:ic.ufficio,app:ic.cuore,sera:ic.stella,casa:ic.casa,lab:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2v7.5L4.5 19A2 2 0 0 0 6.2 22h11.6a2 2 0 0 0 1.7-3L14 9.5V2M9 2h6M7.5 15h9"/></svg>'};
const tintaStrato=t=>t==="app"?tinta.ambra:t==="uff"?tinta.bosco:t==="lab"?"#bd96dc":tinta.oro;
const tipiStrato=[["tutte","Tutte"],["uff","Ufficio"],["app","Appuntamento"],["sera","Sera"],["casa","Casa"],["lab","Sperimentali"]];
let filtroStrati=ricordato("strati","tutte");
function scegliStrati(k){filtroStrati=k;ricorda("strati",k);disegnaLayering()}

/* Il sommario dice chi sta sotto e chi sopra ("№ 3 sotto · № 2 sopra — ..."),
   la ricetta dice quanti spray. Da qui la coppia di boccette e le dosi. */
function partiRicetta(l){
  const [sotto,sopra]=[...l.s.matchAll(/№\s*(\d+)/g)].map(x=>profumi.find(p=>p.id===+x[1]));
  const dosi=[...String(l.come).matchAll(/(\d+)\s+(?:solo\s+)?spray/gi)].map(x=>+x[1]);
  let desc=l.s.split(" — ").slice(1).join(" — ")||"";
  desc=desc.charAt(0).toUpperCase()+desc.slice(1);
  return {sotto,sopra,dSotto:dosi[0]||2,dSopra:dosi[1]||1,desc};
}
const gocce=n=>`<span class="gocce">${"<i></i>".repeat(Math.min(n,4))}</span>`;
const spray=n=>n===1?"1 spray":n+" spray";

function disegnaLayering(){
  let h=intesta("Layering",`${layering.length} abbinamenti fra le tue boccette. Il più denso sotto, il più leggero sopra, e dieci minuti prima di giudicare.`);
  h+=`<div class="regole">${[["Prima il più denso","Legnoso, ambrato o gourmand sotto; acquatico, agrumato o floreale sopra. Il pesante dura di più e regge la struttura."],
       ["Dosi asimmetriche","Non serve la stessa quantità per entrambi. Due più uno è quasi sempre il punto di equilibrio."],
       ["Aspetta prima di giudicare","Quello che stona nei primi minuti spesso si armonizza quando le note di testa evaporano."],
       ["Almeno uno monocorda","Due profumi molto strutturati litigano. Meglio che uno sia centrato su una nota dominante."]]
      .map(([t,d],i)=>`<div class="regola"><div class="regola-n">${["I","II","III","IV"][i]}</div><div class="regola-t">${t}</div><div class="regola-d">${d}</div></div>`).join("")}</div>`;
  const conta=k=>k==="tutte"?layering.length:layering.filter(l=>l.t===k).length;
  if(!tipiStrato.some(([k])=>k===filtroStrati))filtroStrati="tutte";
  h+=`<div class="filtri-vista">${tipiStrato.filter(([k])=>conta(k)).map(([k,lbl])=>
    `<button class="scelta${k===filtroStrati?" on":""}" onclick="scegliStrati('${k}')">${lbl}<span class="q">${conta(k)}</span></button>`).join("")}</div>`;
  let gruppo="";
  layering.forEach((l,i)=>{
    if(filtroStrati!=="tutte"&&l.t!==filtroStrati)return;
    if(l.g!==gruppo){gruppo=l.g;h+=`<div class="divisorio incisa">${gruppo}</div>`}
    const r=partiRicetta(l),t=tintaStrato(l.t);
    const riga=(ruolo,p,d)=>p?`<button class="pila-riga" onclick="event.stopPropagation();vaiAlProfumo(${p.id})">
        <span class="pila-ruolo incisa">${ruolo}</span>${miniatura(p)}
        <span class="pila-nome">${esc(p.name)}<small>${esc(p.brand)} · ${p.conc}</small></span>
        <span class="pila-dose">${gocce(d)}${spray(d)}</span></button>`:"";
    h+=`<article class="ricetta strato-ricetta t-acc" data-open="false" id="lay-${i}" style="--t:${t}">
      <div class="ricetta-testa" onclick="commuta('lay-${i}')">
        <div class="coppia">${miniatura(r.sotto,"sotto")}${miniatura(r.sopra,"sopra")}</div>
        <div class="ricetta-testo">
          <div class="ricetta-nome">${l.n}</div>
          <div class="ricetta-sotto">${r.desc||rinumera(l.s)}</div>
          <div class="dosi"><span class="dosi-icona">${bolloIcona[l.t]||""}</span>${spray(r.dSotto)} sotto · ${spray(r.dSopra)} sopra</div>
        </div>${chevron}
      </div>
      <div class="ricetta-corpo t-acc-panel"><div class="ricetta-corpo-int t-acc-panel-inner">
        <div class="pila">${riga("Sopra",r.sopra,r.dSopra)}${riga("Sotto",r.sotto,r.dSotto)}</div>
        ${r.sotto&&r.sopra?`<button class="btn-indossa strato-oggi${layeringFatto(r.sotto.id,r.sopra.id)?" fatto":""}" onclick="event.stopPropagation();faiLayering(${r.sotto.id},${r.sopra.id})">${layeringFatto(r.sotto.id,r.sopra.id)?spunta+"Fatto oggi":goccia+"Lo faccio oggi"}</button>`:""}
        <div class="passo"><span class="passo-nome">Come si fa</span><span class="passo-testo">${rinumera(l.come)}</span></div>
        <div class="passo"><span class="passo-nome">Risultato</span><span class="passo-testo">${rinumera(l.ris)}</span></div>
        <div class="passo"><span class="passo-nome">Perché funziona</span><span class="passo-testo">${rinumera(l.perche)}</span></div>
        <div class="passo"><span class="passo-nome">Quando</span><span class="passo-testo">${rinumera(l.quando)}</span></div>
      </div></div>
    </article>`;
  });
  document.getElementById("vista-layering").innerHTML=h;
}

// ── ACQUISTI ──────────────────────────────────────────────────────────────
const collegamentoProfilo=`<a class="profilo" href="https://www.fragrantica.it/members/74018" target="_blank" rel="noopener">
  <div class="profilo-tondo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
  <div style="flex:1"><div class="incisa">Fragrantica.it</div><div class="profilo-nome">Il mio profilo →</div></div>
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--carta-3)"><path d="m9 18 6-6-6-6"/></svg>
</a>`;
/* Una voce dei consigli e' gia' in casa se cita un numero di catalogo
   ("→ Island № 29") o se il suo titolo contiene marchio e nome di un profumo
   della collezione ("Lattafa Asad"). */
function giaInCasa(t){
  const n=String(t).match(/№\s*(\d+)/);
  if(n)return profumi.find(p=>p.id===+n[1])||null;
  const k=" "+chiaveNome(t)+" ";
  return profumi.find(p=>k.includes(" "+chiaveNome(p.brand+" "+p.name)+" "))||null;
}
const eChiuso=c=>/copert/i.test(c.g);
function disegnaAcquisti(){
  const aperte=consigli.filter(c=>!eChiuso(c)),chiuse=consigli.filter(eChiuso);
  const lacune=aperte.filter(c=>/lacun/i.test(c.g)).length||aperte.length;
  const idee=aperte.reduce((a,c)=>a+c.voci.filter(v=>!giaInCasa(v.t)).length,0);
  const nChiusi=chiuse.reduce((a,c)=>a+c.voci.length,0);
  let h=intesta("Acquisti",`Dove la collezione è scoperta e con cosa riempirla, letta sulle ${boccette().length} boccette di oggi.`);
  h+=`<div class="riepilogo">
    <div><b>${lacune}</b><span>${lacune===1?"lacuna aperta":"lacune aperte"}</span></div>
    <div><b>${idee}</b><span>idee d'acquisto</span></div>
    <div><b>${nChiusi}</b><span>chiuse di recente</span></div></div>`;
  let gruppo="";
  aperte.forEach(c=>{
    const i=consigli.indexOf(c);
    if(c.g!==gruppo){gruppo=c.g;h+=`<div class="divisorio incisa">${gruppo}</div>`}
    const [titolo,...resto]=c.n.split(" — ");
    h+=`<article class="ricetta lacuna t-acc" data-open="false" id="acq-${i}">
      <div class="ricetta-testa" onclick="commuta('acq-${i}')">
        <div class="ricetta-bollo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><path d="M12 8v8M8 12h8"/></svg></div>
        <div class="ricetta-testo"><div class="ricetta-nome">${titolo}</div>
          <div class="ricetta-sotto">${resto.length?(t=>t.charAt(0).toUpperCase()+t.slice(1))(resto.join(" — "))+" · ":""}${c.voci.length} ${c.voci.length===1?"idea":"idee"}</div></div>${chevron}
      </div>
      <div class="ricetta-corpo t-acc-panel"><div class="ricetta-corpo-int t-acc-panel-inner">
        <p class="lacuna-testo">${rinumera(c.gap)}</p>
        ${c.voci.map((v,j)=>{const p=giaInCasa(v.t);return `<div class="candidato${p?" preso":""}">
          <span class="candidato-n">${p?spunta:j+1}</span>
          <div><div class="candidato-t">${esc(v.t)}</div><div class="candidato-d">${rinumera(v.d)}</div>
          ${p?`<button class="candidato-gia" onclick="vaiAlProfumo(${p.id})">${miniatura(p)}${eCampione(p)?"Ce l'hai come campione":"Ce l'hai in collezione"} →</button>`:""}</div>
        </div>`}).join("")}
      </div></div>
    </article>`;
  });
  chiuse.forEach(c=>{
    h+=`<div class="divisorio incisa">${c.g}</div><div class="chiusi">${c.voci.map(v=>{
      const p=giaInCasa(v.t),gap=v.t.split("→")[0].trim();
      return `<button class="chiuso"${p?` onclick="vaiAlProfumo(${p.id})"`:""}>${miniatura(p)}
        <div class="chiuso-testo"><div class="chiuso-gap">${spunta}${esc(gap)}</div>
        <div class="chiuso-nome">${p?esc(p.name):esc(v.t.split("→")[1]||"")}</div>
        <div class="chiuso-d">${rinumera(v.d)}</div></div></button>`}).join("")}</div>`;
  });
  h+=`<div class="divisorio incisa">Altrove</div>`+collegamentoProfilo;
  document.getElementById("vista-acquisti").innerHTML=h;
}

// ── NUMERI ────────────────────────────────────────────────────────────────
const icUso={ufficio:ic.ufficio,quotidiano:ic.sole,formale:ic.calice,appuntamento:ic.cuore,palestra:ic.fulmine,casa:ic.casa,festivita:ic.stella,
  informale:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.1a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.3-2.2z"/></svg>'};
const tintaStagione={pe:"#ddc76b",tutto:"#93b98a",ai:"#d9906f"};
const tintaVetro={blu:"var(--acqua)",verde:"var(--bosco)",rosso:"var(--ambra)"};
/* Una barra sola divisa in parti: dice le proporzioni a colpo d'occhio,
   dove tre barre separate costringevano a confrontare lunghezze. */
function segmenti(parti,tot){
  return `<div class="segmenti">${parti.filter(x=>x.n).map(x=>`<span style="flex:${x.n};background:${x.c}"></span>`).join("")}</div>
    <div class="legenda">${parti.map(x=>`<span><i style="background:${x.c}"></i>${x.l}<b>${x.n}</b><em>${Math.round(x.n/tot*100)}%</em></span>`).join("")}</div>`;
}
function classifica(lista,val,fmt,max,quanti){
  const riga=(p,i)=>`<button class="cl-riga${i<3?" podio":""}" onclick="vaiAlProfumo(${p.id})">
      <span class="cl-pos">${i+1}</span>${miniatura(p)}
      <span class="cl-mezzo"><span class="cl-nome">${esc(p.name)}<small>${p.conc}</small></span>
        <span class="binario"><span class="riempio" style="width:${Math.max(4,Math.round(val(p)/max*100))}%"></span></span></span>
      <span class="cl-val">${fmt(p)}</span></button>`;
  const primi=lista.slice(0,quanti).map(riga).join(""),resto=lista.slice(quanti);
  return primi+(resto.length?`<details class="altri"><summary>Tutti gli altri ${resto.length}</summary>${resto.map((p,i)=>riga(p,i+quanti)).join("")}</details>`:"");
}
function disegnaNumeri(){
  const B=boccette(),tot=B.length,C=campioni();
  const votati=B.filter(p=>p.rating).sort((a,b)=>b.rating-a.rating||b.voti-a.voti);
  const mediaR=(votati.reduce((a,p)=>a+p.rating,0)/votati.length).toFixed(2);
  /* la media esclude chi la durata non ce l'ha, come gia' fa quella dei voti:
     contarli come zero abbassava il numero senza dirlo */
  const durate=B.filter(p=>p.longevita).sort((a,b)=>b.longevita-a.longevita||(b.rating||0)-(a.rating||0));
  const mediaL=(durate.reduce((a,p)=>a+p.longevita,0)/durate.length).toFixed(1);
  const cloni=B.filter(p=>p.dupe);
  let h=intesta("Numeri","La collezione in cifre. Tocca un profumo per aprire la sua scheda.");
  h+=`<div class="eroe">
    <div><div class="eroe-n">${tot}</div><div class="incisa">Boccette in collezione</div></div>
    <div class="eroe-dx">${C.length?`<div><b>${C.length}</b> campioni</div>`:""}<div><b>${cloni.length}</b> cloni e dupe</div><div><b>${new Set(B.map(p=>p.brand)).size}</b> marchi</div></div>
  </div>
  <div class="numeri tre">
    <div class="numero"><div class="numero-n">${mediaR.replace(".",",")}</div><div class="numero-l">Rating medio</div></div>
    <div class="numero"><div class="numero-n">${mediaL.replace(".",",")}<small>h</small></div><div class="numero-l">Durata media</div></div>
    <div class="numero"><div class="numero-n">${B.filter(p=>p.momento==="entrambi").length}</div><div class="numero-l">Giorno e sera</div></div>
  </div><div class="tavole">`;
  h+=`<div class="tavola"><div class="tavola-t incisa">Stagione</div>${segmenti(
    ["pe","tutto","ai"].map(k=>({n:B.filter(p=>p.stagione===k).length,c:tintaStagione[k],l:stagLbl(k)})),tot)}
    <div class="tavola-t incisa" style="margin-top:22px">Famiglia olfattiva</div>${segmenti(
    ["blu","verde","rosso"].map(k=>({n:B.filter(p=>p.colore===k).length,c:tintaVetro[k],l:vetroNome[k]})),tot)}</div>`;
  const usi=Object.keys(usoLabels).map(k=>({k,n:B.filter(p=>p[k]==="si").length,m:B.filter(p=>p[k]==="si-mod").length})).sort((a,b)=>b.n+b.m-a.n-a.m);
  h+=`<div class="tavola"><div class="tavola-t incisa">Occasione d'uso</div>${usi.map(u=>`<div class="asta">
      <div class="asta-eti"><span class="asta-nome">${icUso[u.k]||""}${usoLabels[u.k]}</span><span>${u.n}${u.m?` <em>+${u.m}</em>`:""}</span></div>
      <div class="binario doppio"><div class="riempio" style="width:${u.n/tot*100}%"></div><div class="riempio tenue" style="width:${u.m/tot*100}%"></div></div></div>`).join("")}
    <div class="tavola-nota">In chiaro le boccette da usare con moderazione.</div></div>`;
  const conta={};B.forEach(p=>p.accordi.forEach(a=>conta[a]=(conta[a]||0)+1));
  const accordi=Object.entries(conta).sort((a,b)=>b[1]-a[1]).slice(0,10),maxA=accordi[0]?accordi[0][1]:1;
  h+=`<div class="tavola"><div class="tavola-t incisa">Accordi più presenti</div>${accordi.map(([a,n])=>`<div class="asta">
      <div class="asta-eti"><span style="color:${coloreAccordo(a)}">${a}</span><span>${n}</span></div>
      <div class="binario"><div class="riempio" style="width:${n/maxA*100}%;background:${coloreAccordo(a)}"></div></div></div>`).join("")}</div>`;
  h+=`<div class="tavola"><div class="tavola-t incisa">Rating Fragrantica</div>${classifica(votati,p=>p.rating-3,p=>"★ "+voto(p.rating),2,5)}</div>`;
  h+=`<div class="tavola"><div class="tavola-t incisa">Durata dichiarata</div>${classifica(durate,p=>p.longevita,p=>p.longevita+"h",durate[0]?durate[0].longevita:1,5)}</div>`;
  if(cloni.length)h+=`<div class="tavola"><div class="tavola-t incisa">Cloni e i loro originali</div>${cloni.map(p=>{
    const o=originaleDi(p);
    return `<button class="clone" onclick="vaiAlProfumo(${p.id})">${miniatura(p)}
      <span class="clone-testo"><span class="clone-nome">${esc(p.name)}</span>
      <span class="clone-orig"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg>${esc(p.dupe.split(" (")[0])}${o?` <em>${eCampione(o)?"campione in casa":"in casa"}</em>`:""}</span></span></button>`}).join("")}</div>`;
  // il diario conta tutto quello che indossi, campioni compresi; "da
  // riprendere" invece guarda solo le boccette: un 2 ml non si riprende
  const D=diario().filter(v=>profumi.some(p=>p.id===+v.id));
  h+=`<div class="tavola diario-tavola"><div class="tavola-t incisa">Diario d'uso<button class="collegamento diario-apri" onclick="cambiaVista('diario')">Apri il diario →</button></div>`;
  if(!D.length){
    h+=`<p class="diario-invito">Segna quello che indossi con «Lo metto oggi», nella scheda di ogni profumo o da «Consigliami». Qui compariranno le più usate e quelle dimenticate.</p>`;
  }else{
    const mese=oggiISO().slice(0,7),n=id=>D.filter(v=>+v.id===id).length;
    const usate=profumi.filter(p=>n(p.id)).sort((a,b)=>n(b.id)-n(a.id)||giorniDa(a.id)-giorniDa(b.id));
    const dimenticate=B.map(p=>({p,g:giorniDa(p.id)})).sort((a,b)=>(b.g??1e4)-(a.g??1e4)).slice(0,6);
    h+=`<div class="diario-cifre"><div><b>${D.filter(v=>v.data.startsWith(mese)).length}</b><span>questo mese</span></div>
      <div><b>${usate.length}</b><span>profumi usati</span></div><div><b>${B.filter(p=>!n(p.id)).length}</b><span>boccette mai segnate</span></div></div>
      <div class="incisa diario-sotto">Le più indossate</div>
      ${classifica(usate,p=>n(p.id),p=>n(p.id)+"×",n(usate[0].id),5)}
      <div class="incisa diario-sotto">Da riprendere</div>
      <div class="tessere">${dimenticate.map(({p,g})=>tessera(p,"",g===null?"mai":quandoFu(g))).join("")}</div>`;
  }
  h+=`</div></div>`+collegamentoProfilo;
  document.getElementById("vista-numeri").innerHTML=h;
}

// ── DIARIO ────────────────────────────────────────────────────────────────
/* Il calendario del mese con quello che hai indossato, il giorno scelto con
   le sue voci (da togliere o aggiungere, anche a posteriori) e la cronologia.
   Le voci passano dalla stessa coda del pulsante «Lo metto oggi». */
let meseDiario=null,giornoDiario=null,sceltaDiario=false,cercaDiario="",strato={sotto:null,sopra:null,slot:"sotto"};
const nomiMesi=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
const maiuscola=t=>t.replace(/^./,c=>c.toUpperCase());
const dataLunga=iso=>{const [y,m,d]=iso.split("-").map(Number);return maiuscola(new Date(y,m-1,d).toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"}))};
function vociPerGiorno(){
  const m=new Map();
  diario().filter(v=>profumi.some(p=>p.id===+v.id)).sort((a,b)=>+a.t-+b.t).forEach(v=>{if(!m.has(v.data))m.set(v.data,[]);m.get(v.data).push(v)});
  return m;
}
function spostaMese(d){
  const [y,m]=meseDiario.split("-").map(Number),n=new Date(y,m-1+d,1);
  const nuovo=n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0");
  if(nuovo>oggiISO().slice(0,7))return;
  meseDiario=nuovo;disegnaDiario();
}
function scegliGiorno(iso){
  if(iso>oggiISO())return;
  giornoDiario=iso;meseDiario=iso.slice(0,7);sceltaDiario=false;cercaDiario="";disegnaDiario();
  document.getElementById("diario-giorno")?.scrollIntoView({block:"nearest",behavior:"smooth"});
}
/* sceltaDiario: false, "uno" (un profumo) o "strati" (un layering) */
function apriSceltaDiario(modo="uno"){
  sceltaDiario=sceltaDiario===modo?false:modo;cercaDiario="";
  if(sceltaDiario==="strati"){
    // il singolo gia' segnato quel giorno parte come base
    const v=vociDelGiorno(giornoDiario);strato={sotto:v.length===1?+v[0].id:null,sopra:null,slot:v.length===1?"sopra":"sotto"};
  }
  disegnaDiario();if(sceltaDiario)document.getElementById("diario-cerca")?.focus();
}
function slotStrato(k){strato.slot=k;disegnaDiario()}
function invertiStrato(){strato={sotto:strato.sopra,sopra:strato.sotto,slot:strato.slot};disegnaDiario()}
function ricettaStrato(i){const r=partiRicetta(layering[i]);if(r.sotto&&r.sopra){strato={sotto:r.sotto.id,sopra:r.sopra.id,slot:"sotto"};disegnaDiario()}}
function confermaStrato(){if(segnaLayering(strato.sotto,strato.sopra,giornoDiario)){sceltaDiario=false;disegnaDiario()}}
function filtraSceltaDiario(t){cercaDiario=t;document.getElementById("diario-elenco").innerHTML=elencoSceltaDiario()}
function aggiungiDiario(id){
  if(sceltaDiario==="strati"){
    strato[strato.slot]=id;
    if(strato.sotto===strato.sopra)strato[strato.slot==="sotto"?"sopra":"sotto"]=null;
    strato.slot=strato.sotto&&!strato.sopra?"sopra":!strato.sotto?"sotto":strato.slot;
    disegnaDiario();return;
  }
  if(segna(id,giornoDiario)!==false&&vociDelGiorno(giornoDiario).length>=MAX_GIORNO)sceltaDiario=false,disegnaDiario();
}
function elencoSceltaDiario(){
  const q=cercaDiario.trim().toLowerCase(),gia=new Set(sceltaDiario==="strati"?[strato.sotto,strato.sopra].filter(Boolean):(vociPerGiorno().get(giornoDiario)||[]).map(v=>+v.id));
  const lista=[...profumi].filter(p=>!q||(p.name+" "+p.brand).toLowerCase().includes(q))
    .sort((a,b)=>eCampione(a)-eCampione(b)||a.name.localeCompare(b.name,"it"));
  if(!lista.length)return `<div class="diario-vuoto">Nessun profumo con questo nome.</div>`;
  return lista.map(p=>`<button class="diario-voce scelta-voce" onclick="aggiungiDiario(${p.id})"${gia.has(p.id)?" disabled":""}>
      ${miniatura(p)}<span class="diario-voce-testo"><b>${esc(p.name)}</b><small>${esc(p.brand)} · ${p.conc}${eCampione(p)?" · campione":""}</small></span>
      <span class="diario-azione">${gia.has(p.id)?spunta:piu}</span></button>`).join("");
}
function disegnaDiario(){
  const el=document.getElementById("vista-diario");
  if(!el||!profumi.length)return;
  const oggi=oggiISO();
  meseDiario=meseDiario||oggi.slice(0,7);giornoDiario=giornoDiario||oggi;
  const g=vociPerGiorno(),[Y,M]=meseDiario.split("-").map(Number);
  const primo=(new Date(Y,M-1,1).getDay()+6)%7,giorni=new Date(Y,M,0).getDate();
  const delMese=[...g.entries()].filter(([d])=>d.startsWith(meseDiario)).flatMap(([,v])=>v);
  const conta=new Map();delMese.forEach(v=>conta.set(+v.id,(conta.get(+v.id)||0)+1));
  const top=[...conta.entries()].sort((a,b)=>b[1]-a[1])[0],pTop=top&&profumi.find(p=>p.id===top[0]);
  let h=intesta("Diario","Cosa hai indossato, giorno per giorno. Tocca un giorno per vederlo, o per segnare quello che avevi addosso.");
  h+=`<div class="diario-griglia"><div class="cal">
    <div class="cal-testa">
      <button class="cal-freccia" onclick="spostaMese(-1)" aria-label="Mese prima"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m15 6-6 6 6 6"/></svg></button>
      <div class="cal-mese">${maiuscola(nomiMesi[M-1])} <span>${Y}</span></div>
      <button class="cal-freccia" onclick="spostaMese(1)" aria-label="Mese dopo"${meseDiario>=oggi.slice(0,7)?" disabled":""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m9 6 6 6-6 6"/></svg></button>
    </div>
    <div class="cal-riassunto"><span><b>${delMese.length}</b> ${delMese.length===1?"voce":"voci"}</span><span><b>${conta.size}</b> ${conta.size===1?"profumo":"profumi"}</span>
      ${pTop?`<span>il più messo: <b>${esc(pTop.name)}</b>${top[1]>1?` · ${top[1]}×`:""}</span>`:""}</div>
    <div class="cal-giorni">${["lun","mar","mer","gio","ven","sab","dom"].map(x=>`<span class="cal-sett">${x}</span>`).join("")}
    ${"<span></span>".repeat(primo)}
    ${Array.from({length:giorni},(_,i)=>{
      const iso=meseDiario+"-"+String(i+1).padStart(2,"0"),v=g.get(iso)||[],fut=iso>oggi;
      const ps=v.map(x=>profumi.find(p=>p.id===+x.id)).filter(Boolean),lay=layeringDel(iso);
      return `<button class="cal-g${iso===oggi?" oggi":""}${iso===giornoDiario?" scelto":""}${v.length?" pieno":""}" onclick="scegliGiorno('${iso}')"${fut?" disabled":""} aria-label="${dataLunga(iso)}${v.length?`: ${ps.map(p=>p.name).join(", ")}`:""}">
        <span class="cal-n">${i+1}</span>${lay?`<span class="cal-foto"><span class="coppia cal-coppia">${miniatura(lay.sotto,"sotto")}${miniatura(lay.sopra,"sopra")}</span></span>`
          :ps.length?`<span class="cal-foto">${miniatura(ps[0])}${ps.length>1?`<i>+${ps.length-1}</i>`:""}</span>`:""}</button>`;
    }).join("")}</div>
  </div>`;
  // il giorno scelto
  const v=(g.get(giornoDiario)||[]).map(x=>({x,p:profumi.find(p=>p.id===+x.id)})).filter(o=>o.p);
  const layG=layeringDel(giornoDiario),singoli=v.filter(o=>!ruoloStrato(o.x)),pieno=v.length>=MAX_GIORNO;
  const xTogli=(p,et)=>`<button class="diario-togli" onclick="segna(${p.id},'${giornoDiario}')" aria-label="${et}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
  h+=`<div class="diario-giorno" id="diario-giorno">
    <div class="diario-giorno-t"><span class="incisa">${giornoDiario===oggi?"Oggi":giornoDiario===oggiISO(new Date(Date.now()-864e5))?"Ieri":"Giorno"}</span><b>${dataLunga(giornoDiario)}</b></div>
    ${layG?`<div class="diario-voce diario-strato">
        <span class="coppia">${miniatura(layG.sotto,"sotto")}${miniatura(layG.sopra,"sopra")}</span>
        <span class="diario-voce-testo"><span class="incisa">Layering</span>
          <span class="riga-strato"><small>sopra</small><button onclick="vaiAlProfumo(${layG.sopra.id})">${esc(layG.sopra.name)}</button></span>
          <span class="riga-strato"><small>sotto</small><button onclick="vaiAlProfumo(${layG.sotto.id})">${esc(layG.sotto.name)}</button></span></span>
        ${xTogli(layG.sotto,"Togli il layering da questo giorno")}</div>`:""}
    ${singoli.map(({p})=>`<div class="diario-voce">
        <button class="diario-voce-apri" onclick="vaiAlProfumo(${p.id})">${miniatura(p)}<span class="diario-voce-testo"><b>${esc(p.name)}</b><small>${esc(p.brand)}</small></span></button>
        ${xTogli(p,"Togli "+esc(p.name)+" da questo giorno")}</div>`).join("")}
    ${!v.length?`<div class="diario-vuoto">${giornoDiario===oggi?"Oggi non hai ancora segnato niente.":"Niente segnato in questo giorno."}</div>`:""}
    ${pieno&&!sceltaDiario?`<div class="diario-limite">Due profumi al giorno al massimo: per cambiarli, togline uno.</div>`:`<div class="diario-pulsanti">
      <button class="diario-aggiungi${sceltaDiario==="uno"?" aperto":""}" onclick="apriSceltaDiario('uno')"${pieno&&sceltaDiario!=="uno"?" disabled":""}>${sceltaDiario==="uno"?"Chiudi":`${piu}Un profumo`}</button>
      <button class="diario-aggiungi${sceltaDiario==="strati"?" aperto":""}" onclick="apriSceltaDiario('strati')"${layG||(singoli.length>1)?" disabled":""}>${sceltaDiario==="strati"?"Chiudi":`${iconaStrati}Un layering`}</button></div>`}
    ${sceltaDiario==="strati"?(()=>{
      const pS=profumi.find(p=>p.id===strato.sotto),pP=profumi.find(p=>p.id===strato.sopra);
      const slot=(k,p,et)=>`<button class="strato-slot${strato.slot===k?" attivo":""}" onclick="slotStrato('${k}')">
          ${p?miniatura(p):`<span class="mini vuota">${piu}</span>`}<span class="diario-voce-testo"><span class="incisa">${et}</span><b>${p?esc(p.name):"Scegli dall'elenco"}</b></span></button>`;
      const ricette=layering.map((l,i)=>({i,r:partiRicetta(l)})).filter(({r})=>r.sotto&&r.sopra&&(!strato.sotto||strato.sopra||r.sotto.id===strato.sotto||r.sopra.id===strato.sotto)).slice(0,12);
      return `<div class="diario-scelta strati-scelta">
        <div class="strato-slot-coppia">${slot("sotto",pS,"Sotto · il più denso")}${slot("sopra",pP,"Sopra · il più leggero")}
          <button class="strato-inverti" onclick="invertiStrato()" aria-label="Inverti sotto e sopra"${!pS&&!pP?" disabled":""}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/></svg></button></div>
        ${ricette.length?`<div class="incisa diario-ricette-t">Dalle tue ricette</div><div class="diario-ricette">${ricette.map(({i,r})=>
          `<button class="scelta" onclick="ricettaStrato(${i})">${esc(r.sotto.name)} → ${esc(r.sopra.name)}</button>`).join("")}</div>`:""}
        <input id="diario-cerca" class="diario-cerca" type="search" placeholder="Cerca per nome o marca…" value="${esc(cercaDiario)}" oninput="filtraSceltaDiario(this.value)" autocomplete="off">
        <div class="diario-elenco" id="diario-elenco">${elencoSceltaDiario()}</div>
        <button class="btn-oro strato-conferma" onclick="confermaStrato()"${pS&&pP?"":" disabled"}>Segna il layering</button></div>`;
    })():sceltaDiario==="uno"?`<div class="diario-scelta">
      <input id="diario-cerca" class="diario-cerca" type="search" placeholder="Cerca per nome o marca…" value="${esc(cercaDiario)}" oninput="filtraSceltaDiario(this.value)" autocomplete="off">
      <div class="diario-elenco" id="diario-elenco">${elencoSceltaDiario()}</div></div>`:""}
  </div></div>`;
  // cronologia: le ultime voci, raggruppate per mese
  const tutte=[...g.entries()].sort((a,b)=>a[0]<b[0]?1:-1).flatMap(([d,vs])=>{
    const lay=layeringDel(d),fuori=vs.filter(x=>!ruoloStrato(x)).slice().reverse().map(x=>({d,p:profumi.find(p=>p.id===+x.id)}));
    return (lay?[{d,lay}]:[]).concat(fuori);
  }).filter(o=>o.p||o.lay);
  h+=`<div class="incisa diario-sez">Cronologia</div>`;
  if(!tutte.length)h+=`<p class="diario-invito">Ancora nessuna voce. Segna quello che indossi con «Lo metto oggi» nella scheda di un profumo, da «Consigliami» o qui sopra, scegliendo un giorno.</p>`;
  else{
    let mese="";
    h+=`<div class="diario-storia">`+tutte.slice(0,90).map(({d,p,lay})=>{
      const [y,m,gg]=d.split("-").map(Number),testa=d.slice(0,7)!==mese?(mese=d.slice(0,7),`<div class="diario-storia-mese">${maiuscola(nomiMesi[m-1])} ${y}</div>`):"";
      return testa+`<button class="diario-riga" onclick="scegliGiorno('${d}');document.getElementById('vista-diario').scrollIntoView({behavior:'smooth'})">
        <span class="diario-data"><b>${gg}</b><small>${new Date(y,m-1,gg).toLocaleDateString("it-IT",{weekday:"short"})}</small></span>
        ${lay?`<span class="coppia">${miniatura(lay.sotto,"sotto")}${miniatura(lay.sopra,"sopra")}</span><span class="diario-voce-testo"><b>${esc(lay.sotto.name)} + ${esc(lay.sopra.name)}</b><small>layering</small></span>`
          :`${miniatura(p)}<span class="diario-voce-testo"><b>${esc(p.name)}</b><small>${esc(p.brand)}</small></span>`}</button>`;
    }).join("")+`</div>`;
    if(tutte.length>90)h+=`<p class="diario-invito">Le voci più vecchie restano nel foglio, nella tab Diario.</p>`;
  }
  el.innerHTML=h;
}

// ── NAVIGAZIONE ───────────────────────────────────────────────────────────
/* La pillola prende la posizione e la larghezza della voce attiva: CSS fa il
   resto. Al primo disegno e al ridimensionamento va scritta senza transizione,
   o parte da translateX(0) con larghezza zero. */
function muoviPillola(animata){
  const timone=document.querySelector(".timone");
  const pillola=timone?.querySelector(".t-tabs-pill");
  const attivo=timone?.querySelector(".remo.attivo");
  if(!pillola||!attivo)return;
  const scrivi=()=>{
    pillola.style.transform=`translateX(${attivo.offsetLeft}px)`;
    pillola.style.width=`${attivo.offsetWidth}px`;
  };
  if(animata){scrivi();return}
  const prec=pillola.style.transition;
  pillola.style.transition="none";
  scrivi();
  void pillola.offsetWidth;
  pillola.style.transition=prec;
}
window.addEventListener("resize",()=>{muoviPillola(false);muoviVetrina(false)});

function cambiaVista(v){
  ["collezione","diario","confronta","layering","guida","acquisti","numeri"].forEach(n=>{
    document.getElementById("vista-"+n).classList.toggle("attiva",n===v);
    // il confronto nasce dalla collezione: in barra resta accesa quella
    document.getElementById("remo-"+n)?.classList.toggle("attivo",n===v||(v==="confronta"&&n==="collezione"));
  });
  const inCollezione=v==="collezione";
  document.getElementById("testata").style.display=inCollezione?"flex":"none";
  document.getElementById("strumenti").style.display=inCollezione?"block":"none";
  document.getElementById("vassoio").classList.toggle("mostra",insiemeConfronto.size>0&&inCollezione);
  if(v==="confronta")disegnaConfronto();
  if(v==="diario")disegnaDiario();
  muoviPillola(true);
  window.scrollTo({top:0,behavior:"instant"});
}
function commuta(id){
  const el=document.getElementById(id);
  if(!el)return;
  const aperto=el.getAttribute("data-open")!=="true";
  el.setAttribute("data-open",String(aperto));
  el.firstElementChild?.setAttribute("aria-expanded",String(aperto));
}
document.addEventListener("keydown",e=>{if(e.key==="Escape"){chiudiFiltri();chiudiOggi()}});

/* Lo scheletro si accende solo se l'attesa ci sarà davvero. Con la collezione
   già in cache il primo disegno è immediato, e far lampeggiare dei fantasmi per
   due fotogrammi sarebbe peggio del niente. Il markup nasce già rivelato: se
   questa funzione non gira, la collezione resta visibile lo stesso. */
function forseScheletro(){
  const s=document.getElementById("avvio");
  if(!s)return;
  if(ORIGINE_DATI.appsScript&&!leggiCache()){s.classList.remove("is-revealed");return}
  document.getElementById("scheletro")?.remove();
}

/* Rivela la collezione e poi toglie di mezzo i fantasmi: restando nella cella
   terrebbero alta la griglia anche nelle altre viste, dove la collezione è
   display:none e la cella sarebbe vuota. */
function rivela(){
  const s=document.getElementById("avvio");
  if(!s)return;
  s.classList.add("is-revealed");
  const ms=parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--reveal-dur"))||400;
  setTimeout(()=>document.getElementById("scheletro")?.remove(),ms);
}

// ── APP INSTALLABILE ──────────────────────────────────────────────────────
/* Il service worker rende Sillage un'app da schermata home che si apre anche
   senza rete. Se il browser non lo supporta, il sito funziona come prima. */
if("serviceWorker" in navigator&&location.protocol!=="file:"){
  addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
}

// ── AVVIO ─────────────────────────────────────────────────────────────────
async function avvia() {
  document.getElementById("cerca").addEventListener("input", e => { testoCerca = e.target.value; disegna() });
  forseScheletro();
  let primo = true;
  const mostra = () => {
    costruisciFoglio();
    disegna(); disegnaDiario(); disegnaGuida(); disegnaLayering(); disegnaAcquisti(); disegnaNumeri();
    sincronizzaDiario();
    usaMeteo(false);
    if (primo) { cambiaVista("collezione"); primo = false;
                 rivela();
                 requestAnimationFrame(() => { muoviPillola(false); muoviVetrina(false); }); }
  };
  try {
    await caricaDati(mostra);
  } catch (err) {
    console.error("Sillage:", err);
    document.getElementById("vista-collezione").innerHTML =
      `<div class="deserto">Non riesco a caricare la collezione.<span>${esc(err.message)}</span></div>`;
    document.getElementById("conteggio").textContent = "—";
    rivela();          // anche quando non c'è niente da mostrare, i fantasmi vanno via
    return;
  }
}
avvia();
