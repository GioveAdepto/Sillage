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
let profumi = [], noteChips = [], layering = [], consigli = [];
let origineDati = "locale";

function applicaDati(d) {
  if (!Array.isArray(d.profumi) || !d.profumi.length) throw new Error("dati senza profumi");
  profumi   = d.profumi;
  noteChips = d.note      || [];
  layering  = d.layering  || [];
  consigli  = d.consigli  || [];
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

async function leggiRemoto() {
  const freno = new AbortController();
  const scadenza = setTimeout(() => freno.abort(), ORIGINE_DATI.attesaMax);
  try {
    const r = await fetch(ORIGINE_DATI.appsScript, { signal: freno.signal, redirect: "follow" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(scadenza);
  }
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

/* Ordine di preferenza: foglio Google → ultima copia in cache → JSON del repo.
   Il ripiego locale è sempre presente, quindi la pagina non resta mai vuota. */
async function caricaDati() {
  if (ORIGINE_DATI.appsScript) {
    try {
      const d = await leggiRemoto();
      applicaDati(d);
      origineDati = "foglio";
      scriviCache(d);
      return;
    } catch (err) {
      console.warn("Sillage: foglio non raggiungibile —", err.message);
      const cache = leggiCache();
      if (cache) {
        try { applicaDati(cache); origineDati = "cache"; return; }
        catch (e) { /* cache corrotta: si prosegue con i JSON locali */ }
      }
    }
  }
  applicaDati(await leggiLocale());
  origineDati = ORIGINE_DATI.appsScript ? "locale-ripiego" : "locale";
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
const coloriAccordo=["#d9906f","#93b98a","#7fa8cf","#c8a35e","#bd96dc"];
const ordinamenti={
  alpha:{lbl:"Nome A → Z",fn:p=>p.name.toLowerCase()},
  brand:{lbl:"Marchio A → Z",fn:p=>p.brand.toLowerCase()+p.name},
  rating:{lbl:"Rating più alto",fn:p=>-(p.rating||0)},
  famiglia:{lbl:"Famiglia olfattiva",fn:p=>p.famiglia.toLowerCase()},
  stagione:{lbl:"Stagione",fn:p=>({pe:0,tutto:1,ai:2}[p.stagione]??3)},
  longevita:{lbl:"Longevità più lunga",fn:p=>-p.longevita},
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
const selezione=()=>profumi.filter(p=>passa(p,filtriAttivi,noteAttive))
  .sort((a,b)=>{const fn=ordinamenti[ordine].fn,va=fn(a),vb=fn(b);return typeof va==="number"?va-vb:va<vb?-1:va>vb?1:0});
const quanti=(f,n)=>profumi.filter(p=>passa(p,f,n)).length;

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
  const accordi=p.accordi.slice(0,3).map((a,j)=>`<span class="accordo" style="color:${coloriAccordo[j]}">${a}</span>`).join("");
  const presa=insiemeConfronto.has(p.id);
  return `<article class="teca ${cl}${presa?" presa":""}" id="teca-${p.id}" style="animation-delay:${Math.min(i*26,320)}ms"
    tabindex="0" role="button" aria-expanded="false" onclick="apriTeca(${p.id})"
    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();apriTeca(${p.id})}">
    <div class="corpo">
      <div class="esposizione">
        <div class="nicchia">${nicchia}<div class="ripiano"></div></div>
        <div class="cartellino">
          <div class="riga-marca"><span class="marca">${esc(p.brand)}</span><span class="catalogo">№ ${p.id}</span></div>
          <h2 class="nome">${esc(p.name)}</h2>
          <div class="targhette">
            ${p.nuovo?`<span class="targa nuovo">Nuovo</span>`:""}
            <span class="targa grado">${p.conc}</span>
            <span class="targa voto">${p.rating?`★ ${p.rating}`:"★ n.d."}</span>
            ${p.dupe?`<span class="targa copia">Copia di ${esc(p.dupe.split(" (")[0])}</span>`:""}
          </div>
        </div>
        <div class="gemma ${cl}" title="${vetroNome[p.colore]}">${vetroLettera[p.colore]}</div>
      </div>
      <p class="note-riga">${evidenzia(p.note)}</p>
      <div class="accordi">${accordi}</div>
      <div class="contrassegni">
        <span class="segno stag">${stagLbl(p.stagione)}</span>
        <span class="segno">${momLbl(p.momento)}</span>
        <span class="segno ore">${p.longevita}h</span>
        <span class="segno">${p.famiglia}</span>
      </div>
      <div class="scheda-int">
        <div class="incisa">Quando indossarlo</div>
        <div class="usi">${usi}</div>
        <p class="racconto">${esc(p.desc)}</p>
      </div>
    </div>
    <button class="btn-affianca${presa?" presa":""}" id="affianca-${p.id}"
      onclick="event.stopPropagation();aggiungiAlConfronto(${p.id})"
      aria-label="${presa?"Togli dal confronto":"Aggiungi al confronto"}">${presa?spunta:piu}</button>
  </article>`;
}

function apriTeca(id){
  const c=document.getElementById("teca-"+id);
  if(!c)return;
  const aperta=c.classList.toggle("aperta");
  c.setAttribute("aria-expanded",aperta?"true":"false");
}

function disegna(){
  const lista=selezione();
  document.getElementById("vista-collezione").innerHTML=lista.length
    ? lista.map(costruisciTeca).join("")
    : `<div class="deserto">Nessuna boccetta con questi filtri.<span>Togli un filtro per allargare la ricerca.</span></div>`;
  const tot=profumi.length;
  document.getElementById("conteggio").innerHTML=lista.length===tot
    ? `<b>${tot}</b> boccette`
    : `<b>${lista.length}</b> di ${tot}`;
  const n=filtriAttivi.size+noteAttive.size;
  const bollo=document.getElementById("bollo-filtri");
  bollo.textContent=n||"";bollo.classList.toggle("mostra",n>0);
  document.getElementById("btn-filtri").classList.toggle("acceso",n>0);
  document.getElementById("btn-mostra").textContent=lista.length===tot?"Mostra la collezione":`Mostra ${lista.length} ${lista.length===1?"boccetta":"boccette"}`;
  document.getElementById("foglio-sotto").textContent=n===0?"Tutta la collezione":`${lista.length} di ${tot} boccette`;
  disegnaAttivi();disegnaRapidi();aggiornaConteggiFoglio();
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
  document.getElementById("rapidi").innerHTML=
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
function apriFiltri(){document.getElementById("fondale-filtri").classList.add("aperto");aggiornaConteggiFoglio()}
function chiudiFiltri(){document.getElementById("fondale-filtri").classList.remove("aperto")}
function chiudiFondale(e){if(e.target===document.getElementById("fondale-filtri"))chiudiFiltri()}

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
  if(btn){btn.classList.toggle("presa",presa);btn.innerHTML=presa?spunta:piu;
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
  pal.textContent=n||"";pal.classList.toggle("mostra",n>0);
  if(document.getElementById("vista-confronta").classList.contains("attiva"))disegnaConfronto();
}
function disegnaConfronto(){
  const ids=[...insiemeConfronto],cont=document.getElementById("cf-contenuto"),vuoto=document.getElementById("cf-vuoto");
  if(ids.length<2){cont.innerHTML="";vuoto.style.display="block";return}
  vuoto.style.display="none";
  const lista=ids.map(id=>profumi.find(p=>p.id===id)).filter(Boolean);
  const votati=lista.filter(p=>p.rating);
  const megR=votati.length?Math.max(...votati.map(p=>p.rating)):null,megL=Math.max(...lista.map(p=>p.longevita));
  let h=`<div class="cf-tabella"><div class="cf-griglia col${lista.length}">`;
  h+=`<div class="cf-eti" style="border-bottom:1px solid var(--filo-2)"></div>`;
  lista.forEach(p=>{
    h+=`<div class="cf-testa">
      <div class="cf-x" onclick="togliDalConfronto(${p.id})" title="Togli dal confronto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></div>
      <div class="cf-foto">${p.img?`<img src="${p.img}" alt="${esc(p.name)}">`:""}</div>
      <div class="cf-marca">${esc(p.brand)}</div>
      <div class="cf-nome">${esc(p.name)}</div>
      <span class="cf-grado">${p.conc} · № ${p.id}</span>
    </div>`;
  });
  const riga=(lbl,fn)=>{h+=`<div class="cf-eti">${lbl}</div>`;lista.forEach(p=>{h+=fn(p)})};
  h+=`<div class="cf-sez incisa">Profilo</div>`;
  riga("Rating",p=>`<div class="cf-cella${p.rating&&p.rating===megR?" meglio":""}">${p.rating?`★ ${p.rating}`:"n.d."}</div>`);
  riga("Longevità",p=>`<div class="cf-cella${p.longevita===megL?" meglio":""}">${p.longevita}h</div>`);
  riga("Stagione",p=>`<div class="cf-cella"><span class="cf-segno stag">${stagLbl(p.stagione)}</span></div>`);
  riga("Momento",p=>`<div class="cf-cella" style="font-size:12px">${momLbl(p.momento)}</div>`);
  riga("Famiglia",p=>`<div class="cf-cella"><span class="cf-segno">${p.famiglia}</span></div>`);
  riga("Copia di",p=>`<div class="cf-cella" style="font-size:12px">${p.dupe?esc(p.dupe.split(" (")[0]):"—"}</div>`);
  h+=`<div class="cf-sez incisa">Accordi principali</div>`;
  riga("Top accordi",p=>`<div class="cf-cella" style="flex-direction:column;gap:4px">${p.accordi.slice(0,4).map((a,j)=>`<span style="font-size:12px;color:${coloriAccordo[j]}">${a}</span>`).join("")}</div>`);
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
  {k:"ufficio",t:"Ufficio e lavoro",sub:"Spazi chiusi condivisi: due spray, sul petto e non sul collo",i:ic.ufficio,c:"acqua",nota:"Gli orientali e i gourmand restano fuori: in una stanza chiusa la scia diventa invadente entro un'ora."},
  {k:"appuntamento",t:"Appuntamento e serata",sub:"Dove la scia è un vantaggio",i:ic.cuore,c:"ambra"},
  {k:"quotidiano",t:"Quotidiano e casual",sub:"Il guardaroba di tutti i giorni",i:ic.sole,c:"bosco"},
  {k:"formale",t:"Formale e cerimonia",sub:"Eleganza misurata, mai dolciastra",i:ic.calice,c:"oro"},
  {k:"palestra",t:"Palestra e sport",sub:"Leggeri, puliti, senza dolcezza",i:ic.fulmine,c:"acqua",nota:"Da evitare: orientali, gourmand e cuoiati. Con il calore corporeo diventano nauseanti."},
  {k:"festivita",t:"Festività e inverno",sub:"Avvolgenti, per le sere più fredde",i:ic.stella,c:"oro"},
  {k:"casa",t:"In casa e relax",sub:"Per il piacere di sentirli addosso",i:ic.casa,c:"bosco"}
];
const vocePr=p=>`${esc(p.name)} <span class="n">${p.conc} · № ${p.id}</span>`;
function disegnaGuida(){
  let h=`<div class="premessa">Ogni sezione nasce dalla collezione reale: aggiungi una boccetta e compare qui da sola, nella stagione giusta. I numeri sono quelli incisi sui cartellini.</div>`;
  sezioniGuida.forEach((s,idx)=>{
    const si=profumi.filter(p=>p[s.k]==="si"), mod=profumi.filter(p=>p[s.k]==="si-mod");
    let corpo="";
    [["tutto","Tutto l'anno"],["pe","Primavera / Estate"],["ai","Autunno / Inverno"]].forEach(([st,lbl])=>{
      const l=si.filter(p=>p.stagione===st);
      if(l.length)corpo+=`<div class="voce"><div class="voce-eti incisa">${lbl}</div><div class="voce-testo">${l.map(vocePr).join('<span class="sep">·</span>')}</div></div>`;
    });
    if(mod.length)corpo+=`<div class="voce"><div class="voce-eti incisa">Con moderazione</div><div class="voce-testo">${mod.map(p=>vocePr(p)+` <span class="n">(${stagBreve(p.stagione)})</span>`).join('<span class="sep">·</span>')}</div></div>`;
    if(!si.length&&!mod.length)corpo+=`<div class="voce"><div class="voce-nota">Nessuna boccetta in collezione per questa occasione.</div></div>`;
    if(s.nota)corpo+=`<div class="voce"><div class="voce-nota">${s.nota}</div></div>`;
    const n=si.length+mod.length;
    h+=`<section class="cassetto${idx===0?" aperto":""}" id="g-${s.k}">
      <div class="cassetto-testa" onclick="commuta('g-${s.k}')">
        <div class="ct-sx">
          <div class="ct-icona" style="background:${tinta[s.c]}1a;border-color:${tinta[s.c]}33;color:${tinta[s.c]}">${s.i}</div>
          <div><div class="ct-titolo">${s.t}</div><div class="ct-sotto">${n} boccette · ${s.sub}</div></div>
        </div>
        <svg class="freccia" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      <div class="cassetto-corpo">${corpo}</div>
    </section>`;
  });
  document.getElementById("vista-guida").innerHTML=h;
}

// ── LAYERING ──────────────────────────────────────────────────────────────
const bolloIcona={uff:ic.ufficio,app:ic.cuore,sera:ic.stella,casa:ic.casa,lab:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2v7.5L4.5 19A2 2 0 0 0 6.2 22h11.6a2 2 0 0 0 1.7-3L14 9.5V2M9 2h6M7.5 15h9"/></svg>'};
function disegnaLayering(){
  let h=`<div class="premessa">Prima il più intenso e persistente, poi il più leggero sopra: il denso fa da fondamenta, il leggero porta l'apertura. Punto di partenza: due spray del primo, uno del secondo, e dieci minuti di pazienza prima di giudicare.</div>
  <div class="tavola"><div class="tavola-t incisa">Le quattro regole</div>
    ${[["Prima il più denso","Legnoso, ambrato o gourmand sotto; acquatico, agrumato o floreale sopra. Il pesante dura di più e regge la struttura."],
       ["Dosi asimmetriche","Non serve la stessa quantità per entrambi. Due più uno è quasi sempre il punto di equilibrio."],
       ["Aspetta prima di giudicare","I profumi cambiano sulla pelle: quello che stona nei primi minuti spesso si armonizza quando le note di testa evaporano."],
       ["Almeno uno monocorda","Due profumi molto strutturati litigano. Meglio che uno sia centrato su una nota dominante."]]
      .map(([t,d])=>`<div class="asta"><div style="color:var(--ottone);font-size:13.5px;font-weight:600;margin-bottom:5px">${t}</div><div style="font-size:13.5px;color:var(--carta-2);line-height:1.62">${d}</div></div>`).join("")}
  </div>`;
  let gruppo="";
  layering.forEach((l,i)=>{
    if(l.g!==gruppo){gruppo=l.g;h+=`<div class="divisorio incisa">${gruppo}</div>`}
    h+=`<article class="ricetta" id="lay-${i}">
      <div class="ricetta-testa" onclick="commuta('lay-${i}')">
        <div class="ricetta-bollo" style="color:${l.t==="app"?tinta.ambra:l.t==="uff"?tinta.bosco:l.t==="lab"?"#bd96dc":tinta.oro}">${bolloIcona[l.t]}</div>
        <div><div class="ricetta-nome">${l.n}</div><div class="ricetta-sotto">${l.s}</div></div>
      </div>
      <div class="ricetta-corpo">
        <div class="passo"><span class="passo-nome">Come si fa</span><span class="passo-testo">${l.come}</span></div>
        <div class="passo"><span class="passo-nome">Risultato olfattivo</span><span class="passo-testo">${l.ris}</span></div>
        <div class="passo"><span class="passo-nome">Perché funziona</span><span class="passo-testo">${l.perche}</span></div>
        <div class="passo"><span class="passo-nome">Quando</span><span class="passo-testo">${l.quando}</span></div>
      </div>
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
function disegnaAcquisti(){
  let h=collegamentoProfilo+`<div class="premessa">Le famiglie assenti o poco coperte, lette sulla collezione com'è oggi: ${profumi.length} boccette. In fondo, quello che gli ultimi acquisti hanno già risolto.</div>`;
  let gruppo="";
  consigli.forEach((c,i)=>{
    if(c.g!==gruppo){gruppo=c.g;h+=`<div class="divisorio incisa">${gruppo}</div>`}
    h+=`<article class="ricetta" id="acq-${i}">
      <div class="ricetta-testa" onclick="commuta('acq-${i}')">
        <div class="ricetta-bollo" style="color:var(--ottone)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg></div>
        <div><div class="ricetta-nome">${c.n}</div><div class="ricetta-sotto">${c.gap}</div></div>
      </div>
      <div class="ricetta-corpo">${c.voci.map(v=>`<div class="passo"><span class="passo-nome">${v.t}</span><span class="passo-testo">${v.d}</span></div>`).join("")}</div>
    </article>`;
  });
  document.getElementById("vista-acquisti").innerHTML=h;
}

// ── NUMERI ────────────────────────────────────────────────────────────────
function disegnaNumeri(){
  const tot=profumi.length,perStag=k=>profumi.filter(p=>p.stagione===k).length;
  const votati=profumi.filter(p=>p.rating);
  const mediaR=(votati.reduce((a,p)=>a+p.rating,0)/votati.length).toFixed(2);
  const mediaL=(profumi.reduce((a,p)=>a+p.longevita,0)/tot).toFixed(1);
  let h=collegamentoProfilo+`<div class="numeri">
    <div class="numero"><div class="numero-n">${tot}</div><div class="numero-l">Boccette</div></div>
    <div class="numero"><div class="numero-n">${profumi.filter(p=>p.dupe).length}</div><div class="numero-l">Cloni e dupe</div></div>
    <div class="numero"><div class="numero-n">${perStag("pe")}</div><div class="numero-l">Primavera / Estate</div></div>
    <div class="numero"><div class="numero-n">${perStag("ai")}</div><div class="numero-l">Autunno / Inverno</div></div>
    <div class="numero"><div class="numero-n">${mediaR}</div><div class="numero-l">Rating medio · ${votati.length} valutati</div></div>
    <div class="numero"><div class="numero-n">${mediaL}h</div><div class="numero-l">Longevità media</div></div>
  </div>`;
  h+=`<div class="tavola"><div class="tavola-t incisa">Famiglia olfattiva</div>`;
  ["rosso","verde","blu"].forEach(c=>{
    const n=profumi.filter(p=>p.colore===c).length;
    h+=`<div class="asta"><div class="asta-eti"><span>${vetroNome[c]}</span><span>${n}</span></div><div class="binario"><div class="riempio ${vetroClasse[c]}" style="width:${Math.round(n/tot*100)}%"></div></div></div>`;
  });
  h+=`</div><div class="tavola"><div class="tavola-t incisa">Occasione d'uso</div>`;
  Object.keys(usoLabels).forEach(k=>{
    const n=profumi.filter(p=>p[k]==="si"||p[k]==="si-mod").length,pct=Math.round(n/tot*100);
    h+=`<div class="asta"><div class="asta-eti"><span>${usoLabels[k]}</span><span>${n} · ${pct}%</span></div><div class="binario"><div class="riempio" style="width:${pct}%"></div></div></div>`;
  });
  h+=`</div>`;
  const perR={};votati.forEach(p=>{(perR[p.rating]=perR[p.rating]||[]).push(p)});
  h+=`<div class="tavola"><div class="tavola-t incisa">Rating Fragrantica</div>`;
  Object.keys(perR).sort((a,b)=>b-a).forEach(r=>{
    h+=`<div class="asta"><div class="asta-eti"><span>${perR[r].map(p=>p.name).join(" · ")}</span><span>★ ${r}</span></div><div class="binario"><div class="riempio" style="width:${r/5*100}%"></div></div></div>`;
  });
  const senza=profumi.filter(p=>!p.rating);
  if(senza.length)h+=`<div class="asta"><div class="asta-eti"><span>${senza.map(p=>p.name).join(" · ")}</span><span>n.d.</span></div><div class="binario"></div></div>`;
  h+=`</div>`;
  const perL={};profumi.forEach(p=>{(perL[p.longevita]=perL[p.longevita]||[]).push(p)});
  const maxL=Math.max(...profumi.map(p=>p.longevita));
  h+=`<div class="tavola"><div class="tavola-t incisa">Longevità dichiarata</div>`;
  Object.keys(perL).sort((a,b)=>b-a).forEach(l=>{
    const ns=perL[l].map(p=>p.name);
    h+=`<div class="asta"><div class="asta-eti"><span>${ns.slice(0,4).join(", ")}${ns.length>4?"…":""}</span><span>${l}h · ${ns.length}</span></div><div class="binario"><div class="riempio acqua" style="width:${l/maxL*100}%"></div></div></div>`;
  });
  h+=`</div>`;
  h+=`<div class="tavola"><div class="tavola-t incisa">Di quale profumo sono la copia</div>`;
  profumi.filter(p=>p.dupe).forEach(p=>{
    h+=`<div class="asta" style="margin-bottom:13px"><div class="asta-eti"><span style="color:var(--carta)">${esc(p.name)} <span style="color:var(--carta-3);font-size:11.5px">№ ${p.id}</span></span></div>
      <div style="font-size:13px;color:var(--ottone);line-height:1.5">→ ${esc(p.dupe)}</div></div>`;
  });
  h+=`</div>`;
  document.getElementById("vista-numeri").innerHTML=h;
}

// ── NAVIGAZIONE ───────────────────────────────────────────────────────────
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
  window.scrollTo({top:0,behavior:"instant"});
}
function commuta(id){document.getElementById(id)?.classList.toggle("aperto")}
document.addEventListener("keydown",e=>{if(e.key==="Escape")chiudiFiltri()});

// ── AVVIO ─────────────────────────────────────────────────────────────────
async function avvia() {
  document.getElementById("cerca").addEventListener("input", e => { testoCerca = e.target.value; disegna() });
  try {
    await caricaDati();
  } catch (err) {
    console.error("Sillage:", err);
    document.getElementById("vista-collezione").innerHTML =
      `<div class="deserto">Non riesco a caricare la collezione.<span>${esc(err.message)}</span></div>`;
    document.getElementById("conteggio").textContent = "—";
    return;
  }
  document.body.dataset.origine = origineDati;
  costruisciFoglio();
  disegna(); disegnaGuida(); disegnaLayering(); disegnaAcquisti(); disegnaNumeri();
  cambiaVista("collezione");
}
avvia();
