/* Sillage — le altre viste: confronto, guida, layering, acquisti, numeri
   (con la mappa olfattiva), la scheda da condividere e gli appunti del
   diario. */

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
      <div class="cf-foto">${p.img?`<img src="${p.img}" alt="${esc(p.name)}" class="sfuma" onload="this.classList.add('su')" onerror="this.classList.add('su')">`:""}</div>
      <div class="cf-marca">${esc(p.brand)}</div>
      <div class="cf-nome">${esc(p.name)}</div>
      <span class="cf-grado">${p.conc} · № ${numeroDi(p.id)}</span>
      <span class="cf-serie" style="background:${coloriSerie[lista.indexOf(p)%coloriSerie.length]}" title="Colore nella ruota degli accordi"></span>
    </div>`;
  });
  const riga=(lbl,fn)=>{h+=`<div class="cf-eti">${lbl}</div>`;lista.forEach(p=>{h+=fn(p)})};
  h+=`<div class="cf-sez incisa">Profilo</div>`;
  riga("Rating",p=>`<div class="cf-cella${p.rating&&p.rating===megR?" meglio":""}">${p.rating?`★ ${voto(p.rating)}${p.voti?`<small class="cf-voti">${Number(p.voti).toLocaleString("it-IT")} voti</small>`:""}`:"n.d."}</div>`);
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
  {k:"ufficio",breve:"Ufficio",t:"Ufficio e lavoro",sub:"Spazi chiusi condivisi: due spray, sul petto e non sul collo",i:ic.ufficio,c:"acqua",nota:"In ufficio non si esclude: si dosa. Orientali e gourmand con 1 spray sotto i vestiti, mai sul collo."},
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
  ?`<img src="${p.img}" alt="" loading="lazy" class="sfuma" onload="this.classList.add('su')" onerror="this.classList.add('su')">`
  :`<b class="${vetroClasse[p.colore]||""}">${vetroLettera[p.colore]||"·"}</b>`}</span>`:"";
const tessera=(p,cls="",nota="")=>`<button class="tessera ${cls}" onclick="vaiAlProfumo(${p.id})">
  ${miniatura(p)}<span class="tessera-nome">${esc(p.name)}</span><span class="tessera-sotto">${nota||p.conc}</span></button>`;
const intesta=(titolo,testo)=>`<header class="intesta"><h2>${titolo}</h2><p>${testo}</p></header>`;
const chevron=`<span class="t-acc-chevron"><svg class="freccia" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 9 6 6 6-6"/></svg></span>`;

/* Sette occasioni: una alla volta, scelta da una fila di pillole, invece di
   sette cassetti con dentro elenchi di nomi. La stagione in corso viene per
   prima. */
// ogni apertura riparte da capo: l'occasione proposta e' quella dell'ora
let occasioneGuida=null;
function scegliOccasione(k){occasioneGuida=k;disegnaGuida()}
function disegnaGuida(){
  const B=boccette(),ora=stagioneOra();
  if(!occasioneGuida)occasioneGuida=occasioneProbabile();
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
  // ufficio: anche chi non e' da ufficio, a parte e chiuso, con il suo dosaggio
  if(s.k==="ufficio"){const no=B.filter(p=>p.ufficio==="no");
    if(no.length)gruppi+=`<details class="os-gruppo os-altri"><summary class="os-gruppo-eti"><span class="incisa">Con 1 spray, sotto i vestiti</span><span class="os-q">${no.length}</span></summary>
      <div class="tessere">${no.map(p=>tessera(p,"moderato",`${p.conc} · 1 spray`)).join("")}</div></details>`}
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
let filtroStrati="tutte";
function scegliStrati(k){filtroStrati=k;disegnaLayering()}

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
  const finendo=boccette().filter(p=>{const r=livelloResiduo(p);return r&&r.v<=25});
  if(finendo.length)h+=`<div class="tavola finendo"><div class="tavola-t incisa">Stanno finendo</div>
    <div class="tessere">${finendo.map(p=>tessera(p,"",livelloResiduo(p).l.toLowerCase())).join("")}</div></div>`;
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
  </div>${mappaOlfattiva()}<div class="tavole">`;
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
      <div class="tessere">${dimenticate.map(({p,g})=>tessera(p,"",g===null?"mai":quandoFu(g))).join("")}</div>
      ${statisticheStagioni(D,B)}`;
  }
  h+=`</div></div>`+collegamentoProfilo;
  document.getElementById("vista-numeri").innerHTML=h;
}

/* Il diario per stagione (della data, non del profumo): cosa porti di piu'
   d'inverno, in primavera, d'estate, d'autunno. E la rotazione del mese:
   quante boccette diverse hai messo sul totale. */
function statisticheStagioni(D,B){
  const stagioneDi=iso=>{const [,m,g]=iso.split("-").map(Number),k=m*100+g;
    return k>=321&&k<621?"primavera":k>=621&&k<923?"estate":k>=923&&k<1221?"autunno":"inverno"};
  const per={};D.forEach(v=>{const s=stagioneDi(v.data);(per[s]=per[s]||new Map()).set(+v.id,((per[s].get(+v.id))||0)+1)});
  const mese=oggiISO().slice(0,7),diverse=new Set(D.filter(v=>v.data.startsWith(mese)).map(v=>+v.id).filter(id=>B.some(p=>p.id===id))).size;
  const righe=["inverno","primavera","estate","autunno"].filter(s=>per[s]).map(s=>{
    const top=[...per[s].entries()].sort((a,b)=>b[1]-a[1]).slice(0,3),tot=[...per[s].values()].reduce((a,b)=>a+b,0);
    return `<div class="stag-riga"><span class="stag-nome">${maiuscola(s)}<small>${tot} ${tot===1?"voce":"voci"}</small></span>
      <span class="stag-top">${top.map(([id,n])=>{const p=profumi.find(x=>x.id===id);return p?`<button class="stag-p" onclick="vaiAlProfumo(${id})">${miniatura(p)}<small>${n}×</small></button>`:""}).join("")}</span></div>`}).join("");
  return `<div class="incisa diario-sotto">Per stagione</div>${righe||`<p class="diario-invito">Ancora poche voci.</p>`}
    <div class="incisa diario-sotto">Rotazione del mese</div>
    <div class="rotazione"><div class="binario"><div class="riempio" style="width:${Math.round(diverse/B.length*100)}%"></div></div>
      <span>${diverse} boccette diverse su ${B.length}</span></div>`;
}

// ── CONDIVIDI LA SCHEDA ───────────────────────────────────────────────────
/* Un'immagine verticale della scheda (1080×1350, il formato dei post):
   boccetta nella sua nicchia, nome, accordi con la loro forza, stagioni,
   voto. Dove il telefono lo permette si apre il foglio di condivisione,
   altrimenti si scarica. */
async function condividiScheda(id){
  const p=profumi.find(x=>x.id===id);if(!p)return;
  try{await document.fonts.load("40px Marcellus");await document.fonts.load("600 20px Manrope")}catch(e){}
  const W=1080,H=1350,cv=document.createElement("canvas");cv.width=W;cv.height=H;const g=cv.getContext("2d");
  const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#221d16");bg.addColorStop(1,"#12100d");g.fillStyle=bg;g.fillRect(0,0,W,H);
  const luce=g.createRadialGradient(W/2,-80,40,W/2,-80,900);luce.addColorStop(0,"rgba(255,238,205,.22)");luce.addColorStop(1,"rgba(255,238,205,0)");g.fillStyle=luce;g.fillRect(0,0,W,H);
  g.strokeStyle="rgba(200,163,94,.55)";g.lineWidth=2;g.strokeRect(36,36,W-72,H-72);
  // la boccetta, nella nicchia
  const nx=W/2-190,ny=110,nw=380,nh=450;
  g.save();g.beginPath();g.roundRect(nx,ny,nw,nh,26);g.clip();g.fillStyle="#0c0a08";g.fillRect(nx,ny,nw,nh);
  if(p.img){const im=new Image();im.src=p.img;try{await im.decode();g.drawImage(im,nx,ny,nw,nh)}catch(e){}}
  // i bordi sfumano nel buio della nicchia, come nella vetrina
  const sf=g.createRadialGradient(nx+nw/2,ny+nh*.48,nh*.28,nx+nw/2,ny+nh*.48,nh*.62);
  sf.addColorStop(0,"rgba(12,10,8,0)");sf.addColorStop(1,"rgba(12,10,8,.92)");g.fillStyle=sf;g.fillRect(nx,ny,nw,nh);
  const v=g.createLinearGradient(0,ny,0,ny+nh);v.addColorStop(0,"rgba(255,243,216,.18)");v.addColorStop(.5,"rgba(0,0,0,0)");v.addColorStop(1,"rgba(12,10,8,.35)");g.fillStyle=v;g.fillRect(nx,ny,nw,nh);
  g.restore();g.strokeStyle="rgba(243,223,175,.7)";g.lineWidth=2;g.beginPath();g.roundRect(nx,ny,nw,nh,26);g.stroke();
  g.fillStyle="#f0d9a4";g.fillRect(nx+30,ny+nh+14,nw-60,2);
  // nome
  g.textAlign="center";g.fillStyle="#8d8474";g.font="600 26px Manrope";g.fillText(p.brand.toUpperCase().split("").join(" "),W/2,650);
  g.fillStyle="#f3ede1";let fs=74;g.font=`${fs}px Marcellus`;while(g.measureText(p.name).width>W-160&&fs>40){fs-=4;g.font=`${fs}px Marcellus`}
  g.fillText(p.name,W/2,735);
  g.fillStyle="#c8a35e";g.font="500 28px Manrope";
  g.fillText([p.conc,p.rating?`★ ${voto(p.rating)}`:"",p.longevita?p.longevita+"h":"",p.sillage||""].filter(Boolean).join("   ·   "),W/2,790);
  // accordi con la loro forza
  const f=forzeAccordi(p)||p.accordi.map((_,i)=>Math.round(100/(1+i*.35)));
  p.accordi.slice(0,5).forEach((a,i)=>{const y=860+i*58,x=150,w=(W-300)*(f[i]||50)/100;
    g.fillStyle="rgba(255,255,255,.06)";g.beginPath();g.roundRect(x,y,W-300,40,8);g.fill();
    g.fillStyle=coloreAccordo(a);g.globalAlpha=.85;g.beginPath();g.roundRect(x,y,w,40,8);g.fill();g.globalAlpha=1;
    g.fillStyle="#12100d";g.textAlign="left";g.font="600 22px Manrope";g.fillText(a,x+16,y+28)});
  // stagioni
  const q=quoteStagioni(p),nomi=[["inverno","Inverno"],["primavera","Primavera"],["estate","Estate"],["autunno","Autunno"]];
  nomi.forEach(([k,l],i)=>{const x=150+i*((W-300)/4),y=1175;g.textAlign="center";
    g.fillStyle="#b9b0a0";g.font="500 22px Manrope";g.fillText(l,x+(W-300)/8,y);
    g.fillStyle="#c8a35e";g.font="32px Marcellus";g.fillText(Math.round(q[k]*100)+"%",x+(W-300)/8,y+44)});
  g.textAlign="center";g.fillStyle="#f0d9a4";g.font="30px Marcellus";g.fillText("S I L L A G E",W/2,H-70);
  const blob=await new Promise(r=>cv.toBlob(r,"image/png"));
  const nome=`sillage-${piega(p.brand+"-"+p.name).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}.png`;
  const file=new File([blob],nome,{type:"image/png"});
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:p.name});return}catch(e){if(e.name==="AbortError")return}}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=nome;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

// ── GLI APPUNTI DEL DIARIO ────────────────────────────────────────────────
/* A ogni voce del diario si puo' aggiungere una riga e un voto da 1 a 5 su
   com'e' andata quel giorno: quanto e' durato, se ha funzionato, chi l'ha
   notato. Col tempo dice come rende un profumo su di te, non in media su
   Fragrantica. Il voto non entra nella classifica di Consigliami: resta un
   ricordo tuo, mostrato nella scheda. */
let appuntoAperto=null,votoBozza=0;
const stelle=(n,cls="")=>`<span class="stelle ${cls}">${[1,2,3,4,5].map(i=>`<i class="${i<=n?"on":""}">★</i>`).join("")}</span>`;
function bloccoAppunto(v,p){
  if(!v||ruoloStrato(v))return "";
  const t=String(v.t);
  if(appuntoAperto===t)return `<div class="appunto-editor" onclick="event.stopPropagation()">
    <div class="appunto-stelle">${[1,2,3,4,5].map(i=>`<button class="${i<=votoBozza?"on":""}" onclick="votaBozza(${i})" aria-label="${i} su 5">★</button>`).join("")}<span>${GIUDIZI[votoBozza]}</span></div>
    <input id="appunto-testo" class="diario-cerca" maxlength="200" placeholder="Una riga: quanto è durato, se ha funzionato…" value="${esc(v.nota||"")}">
    <div class="appunto-azioni"><button class="btn-ombra" onclick="appuntoAperto=null;disegnaDiario()">Annulla</button>
      <button class="btn-oro" onclick="salvaAppunto('${t}',${p.id},'${v.data}')">Salva</button></div></div>`;
  return (v.nota||v.voto)
    ?`<button class="appunto" onclick="apriAppunto('${t}',${+v.voto||0})">${v.voto?stelle(+v.voto):""}${v.nota?`<span>${esc(v.nota)}</span>`:""}</button>`
    :`<button class="appunto vuoto" onclick="apriAppunto('${t}',0)">+ Aggiungi un appunto</button>`;
}
const GIUDIZI=["Com'è andata?","Male","Così così","Bene","Molto bene","Perfetto"];
// le stelle si aggiornano sul posto: ridisegnare il diario perderebbe quello che stai scrivendo
function votaBozza(i){
  votoBozza=i===votoBozza?0:i;
  const b=document.querySelector(".appunto-stelle");if(!b)return;
  b.querySelectorAll("button").forEach((x,k)=>x.classList.toggle("on",k<votoBozza));
  b.querySelector("span").textContent=GIUDIZI[votoBozza];
}
function apriAppunto(t,voto){appuntoAperto=String(t);votoBozza=voto;disegnaDiario();setTimeout(()=>document.getElementById("appunto-testo")?.focus(),50)}
function apriAppuntoDiOggi(id){
  const v=diario().find(x=>+x.id===id&&x.data===oggiISO()&&!ruoloStrato(x));if(!v)return;
  giornoDiario=oggiISO();meseDiario=giornoDiario.slice(0,7);
  cambiaVista("diario");apriAppunto(v.t,+v.voto||0);
  document.getElementById("diario-giorno")?.scrollIntoView({block:"start"});
}
function salvaAppunto(t,id,data){
  const nota=(document.getElementById("appunto-testo")?.value||"").trim().slice(0,200);
  aggiornaVoce(t,{nota,voto:votoBozza||""});appuntoAperto=null;
  disegnaDiario();dopoDiario(id);sincronizzaDiario();
}
/* ── Occasione e momento ──
   Per ogni voce del diario: dove l'hai portato (ufficio, appuntamento...) e
   se di giorno o di sera. Un layering ne ha uno solo per la coppia. */
const momenti=[["giorno","Di giorno",'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/></svg>'],
  ["sera","Di sera",'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>']];
// le voci da cambiare insieme: il profumo di quel giorno, o tutta la coppia se e' un layering
function vociUso(id,data){
  const v=vociDelGiorno(data),x=v.find(y=>+y.id===id);
  if(!x)return [];
  return ruoloStrato(x)?v.filter(y=>ruoloStrato(y)&&coppiaDi(y)===coppiaDi(x)):[x];
}
const testoUso=v=>v?[nomeOcc[v.occasione],v.momento==="sera"?"sera":v.momento==="giorno"?"giorno":""].filter(Boolean).join(", ").toLowerCase().replace(/^./,c=>c.toUpperCase()):"";
function sceltaUso(voci,cls=""){
  if(!voci.length)return "";
  const v=voci[0],ts=voci.map(x=>String(x.t)).join(",");
  return `<div class="uso ${cls}" onclick="event.stopPropagation()">
    <label class="uso-occ"><span class="uso-occ-testo">${v.occasione?nomeOcc[v.occasione]:"Occasione"}</span>
      <select onchange="cambiaUso('${ts}','occasione',this.value)" aria-label="Occasione">
        <option value=""${v.occasione?"":" selected"}>Nessuna</option>
        ${ciclo.map(k=>`<option value="${k}"${v.occasione===k?" selected":""}>${nomeOcc[k]}</option>`).join("")}</select>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 9 6 6 6-6"/></svg></label>
    <span class="uso-mom">${momenti.map(([k,n,ic])=>`<button class="${v.momento===k?"on":""}" onclick="cambiaUso('${ts}','momento','${v.momento===k?"":k}')" aria-label="${n}" aria-pressed="${v.momento===k}" title="${n}">${ic}</button>`).join("")}</span>
  </div>`;
}
function cambiaUso(ts,campo,valore){
  const ids=new Set();
  String(ts).split(",").forEach(t=>{aggiornaVoce(t,{[campo]:valore});const v=diario().find(x=>String(x.t)===t);if(v)ids.add(+v.id)});
  ids.forEach(id=>dopoDiario(id));
  sincronizzaDiario();
}
// nella scheda: com'e' andato su di te, dagli appunti, e dove lo porti di solito
function usoAbituale(p){
  const v=diario().filter(x=>+x.id===p.id&&x.occasione);
  if(v.length<2)return "";
  const conta={};v.forEach(x=>conta[x.occasione]=(conta[x.occasione]||0)+1);
  const [occ,n]=Object.entries(conta).sort((a,b)=>b[1]-a[1])[0];
  const sere=v.filter(x=>x.momento==="sera").length,giorni=v.filter(x=>x.momento==="giorno").length;
  const mom=sere>giorni?", di sera":giorni>sere?", di giorno":"";
  return `<span class="su-di-te-uso">Di solito: <b>${nomeOcc[occ].toLowerCase()}${mom}</b> <small>${n} su ${v.length}</small></span>`;
}
function suDiTe(p){
  const v=diario().filter(x=>+x.id===p.id&&(x.voto||x.nota)).sort((a,b)=>a.data<b.data?1:-1);
  const abituale=usoAbituale(p);
  if(!v.length&&!abituale)return "";
  const voti=v.filter(x=>x.voto).map(x=>+x.voto),media=voti.length?voti.reduce((a,b)=>a+b,0)/voti.length:0;
  const ultima=v.find(x=>x.nota);
  return `<div class="su-di-te t-stagger-line t-stagger-line--2"><span class="incisa">Su di te</span>
    ${media?`<span class="su-di-te-voto">${stelle(Math.round(media))}<b>${media.toLocaleString("it-IT",{maximumFractionDigits:1})}</b><small>${voti.length} ${voti.length===1?"volta":"volte"}</small></span>`:""}
    ${ultima?`<span class="su-di-te-nota">«${esc(ultima.nota)}» <small>${dataLunga(ultima.data)}</small></span>`:""}
    ${abituale}</div>`;
}

// ── LA MAPPA OLFATTIVA ────────────────────────────────────────────────────
/* Tutte le boccette su due assi. In orizzontale da fresco a caldo, dalla
   forza degli accordi: marino e agrumato da una parte, dolce, cuoio, spezie
   e ambra dall'altra. In verticale da discreto a potente: la scia
   (moderata, forte, enorme), la durata e la concentrazione. Le zone vuote sono quelle dove
   un acquisto aggiungerebbe qualcosa che non hai. */
let mappaCampioni=false;
function posizioneOlfattiva(p){
  const q=profiloAccordi(p);
  const caldo=q.dolce+q.fumo+q.spezia+q.cipria*.4-(q.acqua+q.agrume+q.bosco*.3);
  const sil={moderato:.15,forte:.55,enorme:.95}[String(p.sillage||"").toLowerCase()]??.5;
  const conc={cologne:.1,edc:.1,edt:.4,edp:.65,parfum:.9,extrait:1,elixir:.9}[String(p.conc||"").toLowerCase()]??.5;
  const forza=.4*sil+.38*Math.max(0,Math.min(1,((p.longevita||6)-4)/7))+.22*conc;
  return {x:Math.max(0,Math.min(1,(caldo+1)/2)),y:Math.max(0,Math.min(1,forza))};
}
function mappaOlfattiva(){
  const lista=(mappaCampioni?profumi:boccette()).filter(p=>p.accordi&&p.accordi.length);
  const W=360,H=420,m=34,R=12,X=x=>m+x*(W-2*m),Y=y=>H-m-y*(H-2*m);
  // ognuno al suo posto, poi un po' di spinta finche' non si coprono piu'
  const pt=lista.map(p=>{const o=posizioneOlfattiva(p);return {p,x:X(o.x),y:Y(o.y),tx:X(o.x),ty:Y(o.y),o}});
  for(let k=0;k<160;k++){
    for(let i=0;i<pt.length;i++)for(let j=i+1;j<pt.length;j++){
      const a=pt[i],b=pt[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.01;
      if(d<2*R+2){const s=(2*R+2-d)/2;dx/=d;dy/=d;a.x-=dx*s;a.y-=dy*s;b.x+=dx*s;b.y+=dy*s}
    }
    pt.forEach(a=>{a.x+=(a.tx-a.x)*.04;a.y+=(a.ty-a.y)*.04;a.x=Math.max(m-6,Math.min(W-m+6,a.x));a.y=Math.max(m-6,Math.min(H-m+6,a.y))});
  }
  // le nove zone e quante boccette ci cadono
  const zona=o=>Math.min(2,Math.floor(o.x*3))+3*Math.min(2,Math.floor(o.y*3));
  const conta=Array(9).fill(0);pt.filter(a=>!eCampione(a.p)).forEach(a=>conta[zona(a.o)]++);
  const nomiX=["fresche","di mezzo","calde"],nomiY=["discrete","medie","potenti"];
  let s=`<svg class="mappa" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mappa olfattiva della collezione">`;
  for(let i=0;i<9;i++){const cx=i%3,cy=Math.floor(i/3),x0=m+cx*(W-2*m)/3,y0=H-m-(cy+1)*(H-2*m)/3;
    s+=`<rect class="mappa-zona${conta[i]?"":" vuota"}" x="${x0+1}" y="${y0+1}" width="${(W-2*m)/3-2}" height="${(H-2*m)/3-2}" rx="6"/>`;
    if(!conta[i])s+=`<text class="mappa-vuota" x="${x0+(W-2*m)/6}" y="${y0+(H-2*m)/6+3}">vuota</text>`}
  s+=`<text class="mappa-asse" x="${m}" y="${H-10}">fresco</text><text class="mappa-asse" x="${W-m}" y="${H-10}" text-anchor="end">caldo</text>
    <text class="mappa-asse" x="16" y="${H-m}" transform="rotate(-90 16 ${H-m})">discreto</text><text class="mappa-asse" x="16" y="${m}" text-anchor="end" transform="rotate(-90 16 ${m})">potente</text>`;
  s+=`<defs>${pt.map((a,i)=>`<clipPath id="mp${i}"><circle cx="${a.x.toFixed(1)}" cy="${a.y.toFixed(1)}" r="${R}"/></clipPath>`).join("")}</defs>`;
  pt.forEach((a,i)=>{const c=eCampione(a.p);
    s+=`<g class="mappa-punto${c?" campione":""}" onclick="vaiAlProfumo(${a.p.id})"><title>${esc(a.p.name)}</title>
      <circle cx="${a.x.toFixed(1)}" cy="${a.y.toFixed(1)}" r="${R+1.5}" class="mappa-anello"/>
      ${a.p.img?`<image href="${a.p.img}" x="${(a.x-R*1.25).toFixed(1)}" y="${(a.y-R*1.5).toFixed(1)}" width="${R*2.5}" height="${R*3}" preserveAspectRatio="xMidYMid slice" clip-path="url(#mp${i})"/>`:""}</g>`});
  s+=`</svg>`;
  const vuote=[];for(let i=0;i<9;i++)if(!conta[i])vuote.push(`${nomiX[i%3]} e ${nomiY[Math.floor(i/3)]}`);
  return `<div class="tavola mappa-tavola"><div class="tavola-t incisa">Mappa olfattiva
      <button class="collegamento mappa-campioni" onclick="mappaCampioni=!mappaCampioni;disegnaNumeri()">${mappaCampioni?"Solo boccette":"Anche i campioni"}</button></div>
    ${s}<p class="mappa-nota">${vuote.length?`Nessuna boccetta tra le ${vuote.join(", tra le ")}.`:"Ogni zona ha almeno una boccetta."} Tocca un profumo per aprirlo.</p></div>`;
}
