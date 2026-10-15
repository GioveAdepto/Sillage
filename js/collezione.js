/* Sillage — la collezione: filtri, ruota degli accordi, la boccetta presa
   in mano, la luce sul vetro, la piramide, la teca e il pannello di
   dettaglio. */

// ── FILTRAGGIO ────────────────────────────────────────────────────────────
const piega=t=>String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
function passa(p,filtri,note){
  // "hermes" trova Hermès, "gio" trova Giò: accenti e maiuscole non contano
  const s=piega(testoCerca.trim());
  if(s&&![p.brand,p.name,p.note,p.famiglia,p.accordi.join(" "),p.dupe||"",(p.noteElenco||[]).join(" ")].some(t=>piega(t).includes(s)))return false;
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
  // un appunto in attesa si vede subito, sopra quello che dice il foglio
  coda.filter(o=>o.op==="nota").forEach(o=>{const v=m.get(String(o.t));if(v)m.set(String(o.t),{...v,nota:o.nota,voto:o.voto,occasione:o.occasione,momento:o.momento})});
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

/* Segnato oggi, il profumo porta con se' l'occasione e il momento: quelli
   scelti in Consigliami o nel piano della settimana, se arriva da li';
   altrimenti quelli piu' probabili adesso. Si cambiano con un tocco. */
const usoProbabile=()=>({occasione:occasioneProbabile(),momento:adesso().momento});
function indossa(id,occasione,momento){
  segna(id,oggiISO(),occasione?{occasione,momento:momento||adesso().momento}:usoProbabile());
}
/* Cambia appunto, voto, occasione o momento di una voce. Se la voce aspetta
   ancora in coda si corregge li'; se il foglio l'ha gia', parte un op=nota
   con tutti i campi. */
function aggiornaVoce(t,cambi){
  t=String(t);
  const coda=leggiCoda(),m=coda.find(o=>o.op==="metti"&&String(o.t)===t);
  if(m)Object.assign(m,cambi);
  else{
    const v=diario().find(x=>String(x.t)===t);if(!v)return;
    const i=coda.findIndex(o=>o.op==="nota"&&String(o.t)===t);if(i>=0)coda.splice(i,1);
    coda.push({op:"nota",id:+v.id,data:v.data,t,nota:v.nota||"",voto:v.voto||"",occasione:v.occasione||"",momento:v.momento||"",...cambi});
  }
  scriviCoda(coda);
}
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
function segna(id,data,uso){
  const coda=leggiCoda(),giorno=vociDelGiorno(data),gia=giorno.find(v=>+v.id===id);
  if(gia){
    const insieme=ruoloStrato(gia)?giorno.filter(v=>ruoloStrato(v)&&coppiaDi(v)===coppiaDi(gia)):[gia];
    insieme.forEach(v=>togliDallaCoda(coda,v));
    scriviCoda(coda);insieme.forEach(v=>dopoDiario(+v.id));
  }else{
    if(giorno.length>=MAX_GIORNO){avvisa(`${data===oggiISO()?"Oggi":"Quel giorno"} hai già segnato due profumi: togline uno prima.`);return false}
    coda.push({op:"metti",id,data,t:String(Date.now()),...(uso||{})});
    scriviCoda(coda);dopoDiario(id);
  }
  sincronizzaDiario();
  return true;
}
/* Il layering occupa il giorno intero. Se quel giorno c'era gia' uno dei due
   come singolo, diventa parte della coppia; un terzo profumo invece va tolto prima. */
function segnaLayering(sotto,sopra,data,uso){
  if(!sotto||!sopra||sotto===sopra)return false;
  const coda=leggiCoda(),giorno=vociDelGiorno(data);
  const altro=giorno.find(v=>+v.id!==sotto&&+v.id!==sopra);
  if(altro){avvisa(`Quel giorno c'è già ${profumi.find(p=>p.id===+altro.id)?.name||"un altro profumo"}: toglilo prima di segnare un layering.`);return false}
  giorno.forEach(v=>togliDallaCoda(coda,v));
  const base=String(Date.now());
  coda.push({op:"metti",id:sotto,data,t:base+"1",...(uso||{})},{op:"metti",id:sopra,data,t:base+"2",...(uso||{})});
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
function faiLayering(sotto,sopra,occasione,momento){
  if(layeringFatto(sotto,sopra)){segna(sotto,oggiISO());return}   // di nuovo: lo toglie
  if(segnaLayering(sotto,sopra,oggiISO(),occasione?{occasione,momento:momento||adesso().momento}:usoProbabile()))avvisa("Layering segnato nel diario di oggi.");
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
      const uso={occasione:o.occasione||"",momento:o.momento||""};
      const q=new URLSearchParams({azione:"diario",op:o.op,id:o.id,data:o.data,t:o.t,
        ...(o.op==="nota"?{nota:o.nota||"",voto:o.voto||"",...uso}:o.op==="metti"&&(uso.occasione||uso.momento)?uso:{})});
      const r=await fetch(ORIGINE_DATI.appsScript+"?"+q,{method:"POST",redirect:"follow"});
      const e=await r.json();
      // un rifiuto del foglio (voce non valida) toglie la voce dalla coda;
      // un errore di rete o un Web App vecchio la lasciano li' per la prossima
      if(!e||(!e.ok&&(!e.errore||/sconosciuta:/.test(e.errore))))break;
      // uno script del foglio senza occasione e momento risponde "ok" ma non li scrive: si aspetta
      if(o.op==="nota"&&e.ok&&!e.uso)break;
      let resta=null;   // quello che il foglio deve ancora sapere di questa voce
      if(e.ok&&o.op==="nota"){const v=diarioFoglio.find(x=>String(x.t)===String(o.t));if(v)Object.assign(v,{nota:o.nota,voto:o.voto,...uso})}
      else if(e.ok&&o.op==="metti"){
        diarioFoglio.push({data:o.data,id:+o.id,t:String(o.t),...(e.uso?uso:{})});
        // cambiata mentre viaggiava, o arrivata a uno script vecchio: si manda il resto dopo
        const ora=leggiCoda().find(x=>x.op==="metti"&&String(x.t)===String(o.t))||o;
        if((!e.uso&&(ora.occasione||ora.momento))||ora.occasione!==o.occasione||ora.momento!==o.momento)
          resta={op:"nota",id:+o.id,data:o.data,t:String(o.t),nota:ora.nota||"",voto:ora.voto||"",occasione:ora.occasione||"",momento:ora.momento||""};
      }
      else if(e.ok)diarioFoglio=diarioFoglio.filter(v=>String(v.t)!==String(o.t));
      scriviCoda(leggiCoda().filter(x=>!(x.op===o.op&&String(x.t)===String(o.t))).concat(resta?[resta]:[]));
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
    <span class="diario-nota">${n?`${n} ${n===1?"volta":"volte"} · l'ultima ${quandoFu(g)}`:"Mai segnato nel diario"}</span>
    ${oggi&&!inLay?`<button class="collegamento" onclick="event.stopPropagation();apriAppuntoDiOggi(${p.id})">${diario().find(v=>+v.id===p.id&&v.data===oggiISO()&&(v.nota||v.voto))?"Modifica l'appunto":"Aggiungi un appunto"}</button>`:""}
    ${oggi?sceltaUso(vociUso(p.id,oggiISO())):""}`;
}

/* "EDP · 100 ml", e il residuo quando la boccetta non e' piu' piena. Le
   colonne formato_ml e residuo_pct c'erano gia' nel foglio: l'app non le
   mostrava. */
function formato(p){
  const r=livelloResiduo(p);
  let t=p.formatoMl?` · ${p.formatoMl} ml`:"";
  if(r&&r.v<100)t+=` · ${r.l.toLowerCase()}`;
  return t;
}
/* Quanto ne resta, scelto a mano a occhio: niente percentuali finte. Nel
   foglio finisce come numero (residuo_pct), cosi' resta ordinabile. */
const LIVELLI=[[100,"Piena"],[90,"Usata poco"],[75,"Tre quarti"],[50,"Mezza"],[25,"Un quarto"],[10,"In fine"],[0,"Finita"]];
function livelloResiduo(p){
  if(p.residuoPct==null||p.residuoPct==="")return null;
  const x=+p.residuoPct;
  const [v,l]=LIVELLI.reduce((a,b)=>Math.abs(b[0]-x)<Math.abs(a[0]-x)?b:a);
  return {v,l};
}
function bloccoResiduo(p){
  /* Un indicatore di livello, come quello della benzina: sette tacche in una
     barra sola, dalla boccetta finita (sinistra) a quella piena (destra).
     Si vede tutto senza scorrere; il nome del livello sta sopra. */
  const r=livelloResiduo(p),tacche=[...LIVELLI].reverse();
  return `<div class="residuo t-stagger-line t-stagger-line--2" id="residuo-${p.id}">
    <div class="residuo-testa"><span class="incisa">Quanto ne resta</span><b>${r?r.l:"Non indicato"}</b></div>
    <div class="livello" role="radiogroup" aria-label="Quanto ne resta">${tacche.map(([v,l])=>
      `<button class="livello-tacca${r&&v<=r.v&&r.v>0?" pieno":""}${r&&r.v===v?" on":""}" role="radio" aria-checked="${!!(r&&r.v===v)}" aria-label="${l}" title="${l}"
        onclick="event.stopPropagation();segnaResiduo(${p.id},${v})"></button>`).join("")}</div>
    <div class="livello-eti"><span>Finita</span><span>Mezza</span><span>Piena</span></div></div>`;
}
async function segnaResiduo(id,v){
  const p=profumi.find(x=>x.id===id);if(!p)return;
  const prima=p.residuoPct;
  p.residuoPct=v;aggiornaResiduo(p);
  try{
    const q=new URLSearchParams({azione:"residuo",id,valore:v});
    const e=await (await fetch(ORIGINE_DATI.appsScript+"?"+q,{method:"POST",redirect:"follow"})).json();
    if(!e||!e.ok)throw new Error(e&&e.errore||"rifiutato");
    const c=leggiCache();if(c){const x=c.profumi.find(y=>y.id===id);if(x){x.residuoPct=v;scriviCache(c)}}
  }catch(err){
    p.residuoPct=prima;aggiornaResiduo(p);
    avvisa(/sconosciuta/.test(err.message)?"Per salvarlo va aggiornato lo script del foglio":"Non salvato: riprova con la rete");
  }
}
function aggiornaResiduo(p){
  document.querySelectorAll(`#residuo-${p.id}`).forEach(el=>el.outerHTML=bloccoResiduo(p));
  const t=document.querySelector(`#teca-${p.id} .targa.grado`);if(t)t.textContent=p.conc+formato(p);
  disegnaAcquisti();
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
    const arrivo=()=>document.querySelector(`#teca-${id} .faretto img`);
    const t=document.startViewTransition(()=>{
      da.style.viewTransitionName="";
      saltaAlProfumo(p,"instant");
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
  /* Si arriva alla card e ci si ferma: chiusa, con un bagliore che dice
     quale. Aprirla resta una scelta di chi guarda. */
  const t=document.getElementById("teca-"+id);
  if(!t)return;
  t.scrollIntoView({block:"start",behavior:scorri});
  t.classList.remove("ancorata");void t.offsetWidth;t.classList.add("ancorata");
  sostituisciStoria({vista:"collezione",profumo:id});
  setTimeout(()=>t.classList.remove("ancorata"),2200);
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
/* I raggi seguono la ruota delle fragranze, dal fresco al caldo: famiglie
   vicine stanno vicine, cosi' la forma dice qualcosa. Ogni raggio porta il
   nome di tutto quello che raccoglie (il raggio "bosco" contiene Aromatico e
   Legnoso: chiamarlo solo "Legnoso" faceva sembrare sbagliato un profumo
   aromatico). */
const raggiRuota=[["acqua","Marino e acquatico"],["agrume","Agrumato e fruttato"],["bosco","Aromatico e legnoso"],
  ["spezia","Speziato e ambrato"],["fumo","Cuoio e tabacco"],["dolce","Dolce e gourmand"],["cipria","Floreale e cipriato"]];
const coloriSerie=["#b8892d","#5685d4","#a63f66"];
const famigliaDi=(()=>{const m={};for(const f in famigliaAccordo)famigliaAccordo[f].forEach(a=>m[a.toLowerCase()]=f);return a=>m[String(a).toLowerCase()]})();
function profiloAccordi(p){
  const q={};raggiRuota.forEach(([k])=>q[k]=0);
  let tot=0;
  (p.accordi||[]).forEach((a,i)=>{const f=famigliaDi(a);if(!f)return;const w=pesoAccordo(p,i);q[f]+=w;tot+=w});
  if(tot)for(const k in q)q[k]/=tot;
  return q;
}
function ruotaAccordi(lista){
  const W=360,H=300,cx=W/2,cy=H/2+2,R=86,n=raggiRuota.length,uno=lista.length===1;
  const profili=lista.map(profiloAccordi);
  // la scala si adatta al valore piu' alto, arrotondato al 10%: il bordo della ruota e' quel valore
  const max=Math.max(.3,Math.ceil(Math.max(...profili.flatMap(q=>Object.values(q)))*10)/10);
  const ang=i=>-Math.PI/2+i*2*Math.PI/n;
  const pt=(i,v)=>[cx+Math.cos(ang(i))*R*v/max,cy+Math.sin(ang(i))*R*v/max];
  const f1=x=>x.toFixed(1);
  let s=`<svg class="ruota" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ruota degli accordi${uno?"":" a confronto"}: ${
    lista.map((p,j)=>esc(p.name)+" "+raggiRuota.filter(([k])=>profili[j][k]).map(([k,l])=>l+" "+Math.round(profili[j][k]*100)+"%").join(", ")).join("; ")}">`;
  // griglia recessiva: anelli al 10, 20, 30%... fino al bordo, e i raggi
  for(let v=.1;v<=max+1e-9;v+=.1)s+=`<polygon class="ruota-anello" points="${raggiRuota.map((_,i)=>pt(i,v).map(f1).join(",")).join(" ")}"/>`;
  raggiRuota.forEach((_,i)=>{const [x,y]=pt(i,max);s+=`<line class="ruota-raggio" x1="${cx}" y1="${cy}" x2="${f1(x)}" y2="${f1(y)}"/>`});
  // le serie: area tenue, contorno di 2px, vertici con anello del colore di fondo
  profili.forEach((q,j)=>{
    const col=coloriSerie[j%coloriSerie.length];
    s+=`<polygon class="ruota-area" points="${raggiRuota.map(([k],i)=>pt(i,q[k]).map(f1).join(",")).join(" ")}" style="fill:${col};stroke:${col}"/>`;
  });
  profili.forEach((q,j)=>{
    const col=coloriSerie[j%coloriSerie.length],nome=lista[j].name;
    raggiRuota.forEach(([k,l],i)=>{
      if(!q[k])return;
      const [x,y]=pt(i,q[k]);
      s+=`<g class="ruota-punto"><circle class="ruota-presa" cx="${f1(x)}" cy="${f1(y)}" r="11"/>
        <circle cx="${f1(x)}" cy="${f1(y)}" r="4" style="fill:${col}"/>
        <title>${esc(nome)} · ${l}: ${Math.round(q[k]*100)}%</title></g>`;
    });
  });
  /* Le etichette: nome della famiglia su due righe e, per un profumo solo,
     la sua quota proprio sotto il nome. Nel confronto i numeri sarebbero
     tre per raggio: li dice il passaggio del mouse, e la tabella sotto. */
  raggiRuota.forEach(([k,l],i)=>{
    const [x,y]=pt(i,max*1.18),c=Math.cos(ang(i)),sn=Math.sin(ang(i));
    const anc=Math.abs(c)<.25?"middle":c>0?"start":"end";
    const righe=l.split(" e ");righe[1]="e "+righe[1];
    const v=uno?Math.round(profili[0][k]*100):null;
    const tot=righe.length+(uno?1:0),y0=y-(sn<-.5?(tot-1)*12:sn>.5?0:(tot-1)*6)+4;
    s+=`<g class="ruota-eti"><text x="${f1(x)}" y="${f1(y0)}" text-anchor="${anc}">`+
      righe.map((r,ri)=>`<tspan x="${f1(x)}" dy="${ri?12:0}"${ri?' class="sotto"':""}>${r}</tspan>`).join("")+
      (uno?`<tspan x="${f1(x)}" dy="13" class="${v?"valore":"zero"}">${v?v+"%":"—"}</tspan>`:"")+
      `</text><circle cx="${f1(anc==="start"?x-8:anc==="end"?x+8:x)}" cy="${f1(anc==="middle"?(sn<0?y0-11:y0-15):y0-4)}" r="3" fill="${tintaAccordo[k]}"/></g>`;
  });
  s+=`</svg>`;
  const legenda=uno?"":`<div class="ruota-legenda">${lista.map((p,j)=>`<span><i style="background:${coloriSerie[j]}"></i>${esc(p.name)}</span>`).join("")}</div>`;
  return `<div class="ruota-box">${legenda}${s}<p class="ruota-nota">Quanto pesa ogni famiglia negli accordi principali di Fragrantica: i primi contano più degli ultimi. Il bordo della ruota vale ${Math.round(max*100)}%.</p></div>`;
}

// ── LA BOCCETTA IN MANO ───────────────────────────────────────────────────
/* Aprire una scheda e' prendere la boccetta dallo scaffale per guardarla da
   vicino: si stacca dalla nicchia, si alza inclinandosi un poco, come presa
   in mano, e si posa in grande accanto ai dettagli. Chiudendo, torna al suo
   posto. Il volo e' una copia dell'immagine che viaggia sopra la pagina;
   segue le due posizioni fotogramma per fotogramma, cosi' arriva giusta anche
   se intanto la pagina scorre o il pannello si apre. */
const DURATA_MANO=640;
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
// la fascia della barra di stato (Dynamic Island) quando Sillage e' aperta dalla schermata Home
const sicuroAlto=()=>{const s=getComputedStyle(document.body,"::before").height;return parseFloat(s)||0};
const cimaLibera=()=>{const b=document.getElementById("strumenti");return (b&&b.offsetParent?b.offsetHeight:0)+14+sicuroAlto()};
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
  accompagna(esame.closest(".esame").getBoundingClientRect().top);
  c.classList.add("in-mano");                 // la nicchia resta vuota, illuminata
  if(riduci.matches){esame.classList.add("posata");return}
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
    ?`<div class="faretto t-tilt-card"><img src="${src}" alt="Flacone di ${esc(p.brand)} ${esc(p.name)}" loading="lazy" decoding="async" class="sfuma" onload="this.classList.add('su')" onerror="this.classList.add('su')"><div class="t-tilt-glare"></div><div class="riflesso"></div></div>
      <div class="specchio" aria-hidden="true"><img src="${src}" alt=""></div>`
    :`<div class="faretto vuoto">${vetroLettera[p.colore]}</div><div class="specchio"></div>`;
  const usi=Object.keys(usoLabels).map(k=>{
    const v=p[k],c=v==="si"?"si":v==="si-mod"?"forse":"no";
    return `<div class="uso ${c}"><span class="punto ${c}"></span>${usoLabels[k]}</div>`;
  }).join("");
  const forze=forzeAccordi(p);
  const accordi=p.accordi.slice(0,3).map((a,i)=>`<span class="accordo" style="color:${coloreAccordo(a)}${forze&&forze[i]?`;--forza:${forze[i]}%`:""}"${forze&&forze[i]?` title="${a}: ${forze[i]}% della forza del primo accordo"`:""}>${a}</span>`).join("");
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
            <span class="targa voto"${p.voti?` title="${Number(p.voti).toLocaleString("it-IT")} voti su Fragrantica"`:""}>${p.rating?`★ ${voto(p.rating)}${p.voti?`<small>${recensioni(p.voti)}</small>`:""}`:"★ n.d."}</span>
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
          ${suDiTe(p)}
          ${p.accordi&&p.accordi.length?`<div class="incisa t-stagger-line t-stagger-line--3">Ruota degli accordi</div>
          <div class="t-stagger-line t-stagger-line--3">${ruotaAccordi([p])}</div>`:""}
          ${bloccoResiduo(p)}
          <p class="racconto t-stagger-line t-stagger-line--3">${rinumera(esc(p.desc))}</p>
          <div class="scheda-azioni t-stagger-line t-stagger-line--3">
            ${p.fragrantica?`<a class="collegamento-esterno" href="${esc(p.fragrantica)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Apri su Fragrantica ↗</a>`:""}
            <button class="collegamento-esterno" onclick="event.stopPropagation();condividiScheda(${p.id})">Condividi la scheda</button>
          </div>${bloccoLegami}${bloccoSimili}${bloccoStrati}
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
/* La forza di ogni accordo, misurata sulle barre di Fragrantica (100 il
   primo). Senza misura si stima dalla posizione, come prima. */
const forzeAccordi=p=>{const f=String(p.accordi_forza||"").split("|").map(Number).filter(n=>n>0);return f.length?f:null};
const pesoAccordo=(p,i)=>{const f=forzeAccordi(p);return f&&f[i]?f[i]/100:1/(1+i*.35)};
// quanto pesa la parte calda: dolce, cuoio-tabacco, spezie e ambra
const densita=p=>{const q=profiloAccordi(p);return q.dolce+q.fumo+q.spezia};
function somiglianza(a,b){
  const pesi=p=>{const m=new Map();(p.accordi||[]).forEach((x,i)=>m.set(x.toLowerCase(),pesoAccordo(p,i)));return m};
  const A=pesi(a),B=pesi(b);
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
  if(aperta)segnaStoria({vista:"collezione",teca:id});else togliDallaStoria("teca");
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
    <button class="foglio-chiudi pannello-chiudi" onclick="chiudiPannello();togliDallaStoria('teca')" aria-label="Chiudi">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
  pan.classList.toggle("con-piramide",!!int.querySelector(".piramide"));
  pan.appendChild(int);
  fine.after(pan);
  tecaNelPannello=c;
  segnaStoria({vista:"collezione",teca:+c.id.slice(5)},!!(history.state||{}).teca);
  riflesso(c);
  prendiInMano(c);
  c.classList.add("aperta");c.setAttribute("aria-expanded","true");
  puntaFreccia();
  int.classList.remove("is-hiding","is-shown");void int.offsetHeight;int.classList.add("is-shown");
  const r=pan.getBoundingClientRect();
  /* Si scorre per mostrare il pannello, ma la card resta sempre visibile,
     sotto la barra degli strumenti (che e' fissa): meglio un pannello da
     scorrere che una card scappata in alto. */
  const barra=document.getElementById("strumenti"),cimaLibera=(barra&&barra.offsetHeight||0)+12+sicuroAlto();
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
