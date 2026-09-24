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

// stagione e momento correnti, per il filtro "Adesso"
const stagioneOra=()=>{const m=new Date().getMonth();return (m>=3&&m<=8)?"pe":"ai"};
const moment0Ora=()=>{const h=new Date().getHours();return (h>=7&&h<18)?"giorno":"sera"};

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
const vociDi=id=>diario().filter(v=>+v.id===id).map(v=>v.data).sort();
function giorniDa(id){
  const v=vociDi(id);
  if(!v.length)return null;
  return Math.round((new Date(oggiISO())-new Date(v[v.length-1]))/864e5);
}
const indossatoOggi=id=>diario().some(v=>+v.id===id&&v.data===oggiISO());
const quandoFu=g=>g===0?"oggi":g===1?"ieri":g<45?`${g} giorni fa`:g<365?`${Math.round(g/30)} mesi fa`:"più di un anno fa";

function indossa(id){
  const oggi=oggiISO(),coda=leggiCoda();
  const gia=diario().find(v=>+v.id===id&&v.data===oggi);
  if(gia){
    // tolta prima che il foglio la vedesse: basta cancellarla dalla coda
    const i=coda.findIndex(o=>o.op==="metti"&&String(o.t)===String(gia.t));
    if(i>=0)coda.splice(i,1);else coda.push({op:"togli",id,data:oggi,t:String(gia.t)});
  }else coda.push({op:"metti",id,data:oggi,t:String(Date.now())});
  scriviCoda(coda);
  dopoDiario(id);
  sincronizzaDiario();
}
function dopoDiario(id){
  const r=document.getElementById("diario-"+id);
  if(r)r.innerHTML=rigaDiario(profumi.find(p=>p.id===id));
  disegnaNumeri();
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
  return `<button class="btn-indossa${oggi?" fatto":""}" onclick="event.stopPropagation();indossa(${p.id})">${oggi?spunta+"Indossato oggi":goccia+"Lo metto oggi"}</button>
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
function vaiAlProfumo(id){
  const p=profumi.find(x=>x.id===id);
  if(!p)return;
  filtriAttivi.clear();noteAttive.clear();testoCerca="";
  const c=document.getElementById("cerca");if(c)c.value="";
  const v=eCampione(p)?"campioni":"boccette";
  if(v!==vetrina)cambiaVetrina(v);else disegna();
  cambiaVista("collezione");
  // la scheda e' gia' nel DOM: si apre subito, senza aspettare un fotogramma
  // che in una scheda del browser in secondo piano potrebbe non arrivare mai
  const t=document.getElementById("teca-"+id);
  if(!t)return;
  if(t.getAttribute("data-open")!=="true")apriTeca(id);
  t.scrollIntoView({block:"start",behavior:"smooth"});
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
    ?`<div class="faretto"><img src="${src}" alt="Flacone di ${esc(p.brand)} ${esc(p.name)}" loading="lazy" decoding="async"></div>
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
  const bloccoStrati=ric.length?`
          <div class="strati t-stagger-line t-stagger-line--4">
            <div class="incisa">Layering</div>
            <div class="strati-elenco">
              ${ric.map(r=>`<button class="strato" onclick="event.stopPropagation();vaiAllaRicetta(${r.i})">
                ${iconaStrati}<span>${esc(r.nome)}</span><span class="strato-ruolo">${r.ruolo}</span>
              </button>`).join("")}
            </div>
          </div>`:"";
  return `<article class="teca t-acc ${cl}${presa?" presa":""}" data-open="false" id="teca-${p.id}" style="animation-delay:${Math.min(i*26,320)}ms"
    tabindex="0" role="button" aria-expanded="false" onclick="apriTeca(${p.id})"
    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();apriTeca(${p.id})}">
    <div class="corpo">
      <div class="esposizione">
        <div class="nicchia">${nicchia}<div class="ripiano"></div></div>
        <div class="cartellino">
          <div class="riga-marca"><span class="marca">${esc(p.brand)}</span><span class="catalogo">№ ${numeroDi(p.id)}</span></div>
          <h2 class="nome">${esc(p.name)}</h2>
          <div class="targhette">
            ${p.nuovo?`<span class="targa nuovo">Nuovo</span>`:""}
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
      <p class="note-riga">${evidenzia(p.note)}</p>
      <div class="accordi">${accordi}</div>
      <div class="contrassegni">
        <span class="segno stag">${stagLbl(p.stagione)}</span>
        <span class="segno">${momLbl(p.momento)}</span>
        <span class="segno ore">${p.longevita?p.longevita+"h":"durata n.d."}</span>
        <span class="segno">${p.famiglia}</span>
      </div>
      <div class="scheda-int t-acc-panel">
        <div class="scheda-int-int t-acc-panel-inner t-stagger">
          <div class="incisa t-stagger-line t-stagger-line--1">Quando indossarlo</div>
          <div class="usi t-stagger-line t-stagger-line--2">${usi}</div>
          <div class="diario-riga t-stagger-line t-stagger-line--2" id="diario-${p.id}">${rigaDiario(p)}</div>
          <p class="racconto t-stagger-line t-stagger-line--3">${rinumera(esc(p.desc))}</p>${bloccoLegami}${bloccoStrati}
        </div>
      </div>
    </div>
    <button class="btn-affianca${presa?" presa":""}" id="affianca-${p.id}"
      onclick="event.stopPropagation();aggiungiAlConfronto(${p.id})"
      aria-label="${presa?"Togli dal confronto":"Aggiungi al confronto"}"><span class="t-icon-swap" data-state="${presa?"b":"a"}"><span class="t-icon" data-icon="a">${piu}</span><span class="t-icon" data-icon="b">${spunta}</span></span></button>
  </article>`;
}

function apriTeca(id){
  const c=document.getElementById("teca-"+id);
  if(!c)return;
  const aperta=c.classList.toggle("aperta");   // .aperta accende il faretto
  c.setAttribute("data-open",aperta?"true":"false");  // data-open apre il pannello
  c.setAttribute("aria-expanded",aperta?"true":"false");
  const righe=c.querySelector(".t-stagger");
  if(!righe)return;
  if(aperta){
    righe.classList.remove("is-hiding","is-shown");
    void righe.offsetHeight;          // senza il reflow il rivelo non riparte
    righe.classList.add("is-shown");
  }else{
    righe.classList.add("is-hiding");
    righe.classList.remove("is-shown");
    setTimeout(()=>righe.classList.remove("is-hiding"),200);
  }
}

function disegna(){
  numera();
  strati=indiceStrati();
  const lista=selezione();
  document.getElementById("vista-collezione").innerHTML=lista.length
    ? lista.map(costruisciTeca).join("")
    : `<div class="deserto">Nessuna boccetta con questi filtri.<span>Togli un filtro per allargare la ricerca.</span></div>`;
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
  const st=stagioneOra()==="pe"?"estate":"inverno",mo=moment0Ora();
  const oggi=vetrina==="boccette"?`<button class="scelta oggi" onclick="apriOggi()">${ic.stella}Cosa metto oggi</button>`:"";
  document.getElementById("rapidi").innerHTML=oggi+
    scelta("adesso","ora",`Adesso · ${st}, ${mo}`)+
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

// ── COSA METTO OGGI ───────────────────────────────────────────────────────
/* Un consiglio alla volta, scelto fra le boccette adatte all'occasione, alla
   stagione e all'ora. A parita', vince quella che non metti da piu' tempo:
   il diario serve anche a questo. */
const occasioniOggi=[["ufficio","Ufficio"],["quotidiano","Quotidiano"],["appuntamento","Appuntamento"],["formale","Formale"],["casa","In casa"],["festivita","Festività"],["palestra","Palestra"]];
let occOggi=null,giroOggi=0;
function occasioneProbabile(){
  const d=new Date(),g=d.getDay(),h=d.getHours(),feriale=g>=1&&g<=5;
  if(h>=18||h<5)return (g===5||g===6)?"appuntamento":"casa";
  return feriale?"ufficio":"quotidiano";
}
function candidatiOggi(occ){
  const st=stagioneOra(),mo=moment0Ora();
  return boccette().filter(p=>p[occ]==="si"||p[occ]==="si-mod").map(p=>{
    const g=giorniDa(p.id);
    let s=0;
    s+=p.stagione===st?3:p.stagione==="tutto"?2:-3;
    s+=(p.momento===mo||p.momento==="entrambi")?2:-2;
    s+=p[occ]==="si"?2:.5;
    s+=g===null?2.5:g===0?-8:g===1?-2:Math.min(g,30)/10;
    s+=((p.rating||3.9)-3.9)*1.5;
    return {p,s,g};
  }).sort((a,b)=>b.s-a.s).slice(0,6);
}
const tagPerOccasione={ufficio:["uff"],quotidiano:["casa","uff"],appuntamento:["app","sera"],formale:["sera"],casa:["casa"],festivita:["sera"],palestra:[]};
function ricettaPer(p,occ){
  const st=stagioneOra(),adatta=g=>st==="pe"?!/autunno|inverno/i.test(g):!/estate/i.test(g);
  const r=(strati.get(p.id)||[]).map(x=>({...x,l:layering[x.i]}))
    .map(x=>({...x,s:(tagPerOccasione[occ]||[]).includes(x.l.t)*2+adatta(x.l.g)}))
    .filter(x=>x.s>0).sort((a,b)=>b.s-a.s);
  return r[0]||null;
}
function apriOggi(){
  occOggi=occasioneProbabile();giroOggi=0;
  disegnaOggi();
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
function scegliOccOggi(k){occOggi=k;giroOggi=0;disegnaOggi()}
function altraIdea(){giroOggi++;disegnaOggi()}
function disegnaOggi(){
  const giorni=["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"];
  document.getElementById("oggi-sotto").textContent=
    `${giorni[new Date().getDay()].replace(/^./,c=>c.toUpperCase())} ${moment0Ora()==="giorno"?"di giorno":"sera"} · ${stagLbl(stagioneOra()).toLowerCase()}`;
  const c=candidatiOggi(occOggi);
  let h=`<div class="ventaglio oggi-occasioni">${occasioniOggi.map(([k,l])=>
    `<button class="scelta${k===occOggi?" on":""}" onclick="scegliOccOggi('${k}')">${l}</button>`).join("")}</div>`;
  if(!c.length){
    h+=`<div class="oggi-vuoto">Nessuna boccetta adatta a questa occasione.</div>`;
  }else{
    const {p,g}=c[giroOggi%c.length],cl=vetroClasse[p.colore],r=ricettaPer(p,occOggi);
    const motivi=[stagLbl(p.stagione),momLbl(p.momento),
      g===null?"mai segnato nel diario":g===0?"l'hai già messo oggi":`l'ultima volta ${quandoFu(g)}`];
    const altro=r?profumi.find(x=>x.id===[...r.l.s.matchAll(/№\s*(\d+)/g)].map(m=>+m[1]).find(id=>id!==p.id)):null;
    h+=`<div class="oggi-scelta ${cl}">
      <div class="oggi-nicchia"><div class="faretto acceso">${p.img?`<img src="${p.img}" alt="">`:vetroLettera[p.colore]}</div><div class="ripiano"></div></div>
      <div class="oggi-testo">
        <div class="marca">${esc(p.brand)}</div>
        <div class="oggi-nome">${esc(p.name)}</div>
        <div class="oggi-motivi">${motivi.map(m=>`<span>${m}</span>`).join("")}</div>
        <div class="oggi-conto">${giroOggi%c.length+1} di ${c.length}</div>
      </div>
    </div>
    ${r&&altro?`<button class="oggi-strato" onclick="chiudiOggi();vaiAllaRicetta(${r.i})">${miniatura(altro)}
      <span><span class="incisa">Se vuoi osare, con</span><b>${esc(altro.name)}</b><small>${esc(r.nome)}</small></span></button>`:""}
    <div class="oggi-azioni">
      <button class="btn-ombra" onclick="altraIdea()"${c.length<2?" disabled":""}>Un'altra idea</button>
      <button class="btn-ombra" onclick="chiudiOggi();vaiAlProfumo(${p.id})">Scheda</button>
      <button class="btn-oro" onclick="${indossatoOggi(p.id)?"":`indossa(${p.id});`}chiudiOggi()">${indossatoOggi(p.id)?"Già segnato":"Lo metto"}</button>
    </div>`;
  }
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
  if(n>0)pal.querySelector(".t-badge-dot").textContent=n;
  pal.dataset.open=n>0?"true":"false";
  if(document.getElementById("vista-confronta").classList.contains("attiva"))disegnaConfronto();
}
function disegnaConfronto(){
  const ids=[...insiemeConfronto],cont=document.getElementById("cf-contenuto"),vuoto=document.getElementById("cf-vuoto");
  if(ids.length<2){cont.innerHTML="";vuoto.style.display="block";return}
  vuoto.style.display="none";
  const lista=ids.map(id=>profumi.find(p=>p.id===id)).filter(Boolean);
  const votati=lista.filter(p=>p.rating);
  const megR=votati.length?Math.max(...votati.map(p=>p.rating)):null,
        megL=Math.max(...lista.filter(p=>p.longevita).map(p=>p.longevita),0);
  let h=`<div class="cf-tabella"><div class="cf-griglia col${lista.length}">`;
  h+=`<div class="cf-eti" style="border-bottom:1px solid var(--filo-2)"></div>`;
  lista.forEach(p=>{
    h+=`<div class="cf-testa">
      <div class="cf-x" onclick="togliDalConfronto(${p.id})" title="Togli dal confronto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></div>
      <div class="cf-foto">${p.img?`<img src="${p.img}" alt="${esc(p.name)}">`:""}</div>
      <div class="cf-marca">${esc(p.brand)}</div>
      <div class="cf-nome">${esc(p.name)}</div>
      <span class="cf-grado">${p.conc} · № ${numeroDi(p.id)}</span>
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
  riga("Top accordi",p=>`<div class="cf-cella" style="flex-direction:column;gap:4px">${p.accordi.slice(0,4).map(a=>`<span style="font-size:12px;color:${coloreAccordo(a)}">${a}</span>`).join("")}</div>`);
  riga("Note",p=>`<div class="cf-cella" style="font-size:12px;text-align:left;line-height:1.6;align-items:flex-start">${esc(p.note)}</div>`);
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
  if(!si.length&&!mod.length)gruppi=`<div class="os-vuoto">Nessuna boccetta in collezione per questa occasione.</div>`;
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
  const D=diario().filter(v=>B.some(p=>p.id===+v.id));
  h+=`<div class="tavola diario-tavola"><div class="tavola-t incisa">Diario d'uso</div>`;
  if(!D.length){
    h+=`<p class="diario-invito">Segna quello che indossi con «Lo metto oggi», nella scheda di ogni boccetta o da «Cosa metto oggi». Qui compariranno le più usate e quelle dimenticate.</p>`;
  }else{
    const mese=oggiISO().slice(0,7),n=id=>D.filter(v=>+v.id===id).length;
    const usate=B.filter(p=>n(p.id)).sort((a,b)=>n(b.id)-n(a.id)||giorniDa(a.id)-giorniDa(b.id));
    const dimenticate=B.map(p=>({p,g:giorniDa(p.id)})).sort((a,b)=>(b.g??1e4)-(a.g??1e4)).slice(0,6);
    h+=`<div class="diario-cifre"><div><b>${D.filter(v=>v.data.startsWith(mese)).length}</b><span>questo mese</span></div>
      <div><b>${usate.length}</b><span>boccette usate</span></div><div><b>${tot-usate.length}</b><span>mai segnate</span></div></div>
      <div class="incisa diario-sotto">Le più indossate</div>
      ${classifica(usate,p=>n(p.id),p=>n(p.id)+"×",n(usate[0].id),5)}
      <div class="incisa diario-sotto">Da riprendere</div>
      <div class="tessere">${dimenticate.map(({p,g})=>tessera(p,"",g===null?"mai":quandoFu(g))).join("")}</div>`;
  }
  h+=`</div></div>`+collegamentoProfilo;
  document.getElementById("vista-numeri").innerHTML=h;
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
  ["collezione","confronta","layering","guida","acquisti","numeri"].forEach(n=>{
    document.getElementById("vista-"+n).classList.toggle("attiva",n===v);
    document.getElementById("remo-"+n)?.classList.toggle("attivo",n===v);
  });
  const inCollezione=v==="collezione";
  document.getElementById("testata").style.display=inCollezione?"flex":"none";
  document.getElementById("strumenti").style.display=inCollezione?"block":"none";
  document.getElementById("vassoio").classList.toggle("mostra",insiemeConfronto.size>0&&inCollezione);
  if(v==="confronta")disegnaConfronto();
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

// ── AVVIO ─────────────────────────────────────────────────────────────────
async function avvia() {
  document.getElementById("cerca").addEventListener("input", e => { testoCerca = e.target.value; disegna() });
  forseScheletro();
  let primo = true;
  const mostra = () => {
    costruisciFoglio();
    disegna(); disegnaGuida(); disegnaLayering(); disegnaAcquisti(); disegnaNumeri();
    sincronizzaDiario();
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
