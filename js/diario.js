/* Sillage — il diario e il piano della settimana. */

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
// ── LA SETTIMANA ──────────────────────────────────────────────────────────
/* Un suggerimento al giorno, da lunedi' a domenica, con gli stessi criteri di
   Consigliami: la stagione (voti di Fragrantica contro calendario e
   temperatura percepita nelle ore in cui lo porti), poi l'occasione, poi
   giorno o sera. I giorni passati mostrano quello che hai messo davvero.
   Il piano distribuisce: un profumo gia' proposto o indossato in settimana
   non torna, finche' c'e' un'alternativa che sta in piedi. Non e' il diario
   che pesa sulla classifica, e' il piano che evita sette volte lo stesso.
   Si ricalcola a ogni apertura con l'ultima previsione. */
const occSettimana={};           // l'occasione cambiata a mano, solo finche' resta aperto
let giornoSettimana=null;
const ciclo=["ufficio","quotidiano","appuntamento","formale","casa","festivita","palestra"];
const nomeOcc=Object.fromEntries(occasioniOggi);
function iconaCielo(f){
  if(!f)return "";
  const h=f.ore.filter(o=>{const x=new Date(o.t).getHours();return x>=8&&x<=21});
  if(h.some(piovosa))return h.some(o=>o.c>=71&&o.c<=77)?"❄":"☂";
  const c=h.map(o=>o.c).sort((a,b)=>a-b)[Math.floor(h.length/2)]??0;
  return c<=1?"☀":c<=3?"⛅":c===45||c===48?"≋":"☁";
}
function pianoSettimana(){
  const oggi=new Date();oggi.setHours(0,0,0,0);
  const lun=new Date(oggi);lun.setDate(oggi.getDate()-((oggi.getDay()+6)%7));
  const g=vociPerGiorno(),usati=new Set(),giorni=[];
  for(let i=0;i<7;i++){const d=new Date(lun);d.setDate(lun.getDate()+i);(g.get(oggiISO(d))||[]).forEach(v=>usati.add(+v.id))}
  const scegli=(occ,quando)=>{
    const c=candidatiOggi(occ,quando);
    const x=c.find(y=>!usati.has(y.p.id)&&y.s>(c[0].s-4))||c[0];   // un'alternativa, ma non una cattiva
    if(x)usati.add(x.p.id);
    return x||null;
  };
  for(let i=0;i<7;i++){
    const d=new Date(lun);d.setDate(lun.getDate()+i);
    const iso=oggiISO(d),eOggi=iso===oggiISO(),passato=d<oggi,fine=d.getDay()===0||d.getDay()===6;
    const occ=occSettimana[iso]||(fine?"quotidiano":"ufficio");
    const indossati=(g.get(iso)||[]).map(v=>profumi.find(p=>p.id===+v.id)).filter(Boolean);
    const cielo=finestraMeteo(new Date(new Date(d).setHours(7,0,0,0)),16);
    let prop=null,sera=null;
    if(!passato){
      const ora=new Date(d);ora.setHours(oraPerOccasione[occ]??9,0,0,0);
      prop=scegli(occ,eOggi&&ora<new Date()?new Date():ora);
      if(fine){const s=new Date(d);s.setHours(19,0,0,0);if(!eOggi||s>new Date())sera=scegli("appuntamento",s)}
    }
    giorni.push({d,iso,eOggi,passato,fine,occ,indossati,cielo,prop,sera,incerto:(d-oggi)/864e5>=4});
  }
  return giorni;
}
function settimanaHTML(){
  if(!profumi.length)return "";
  const gs=pianoSettimana(),nomiG=["dom","lun","mar","mer","gio","ven","sab"];
  if(!giornoSettimana||!gs.some(x=>x.iso===giornoSettimana))giornoSettimana=oggiISO();
  let h=`<section class="settimana"><div class="settimana-testa"><span class="incisa">Questa settimana</span>
    <span class="settimana-nota">${meteo?"con il meteo ora per ora":"senza meteo: solo la stagione"}</span></div><div class="settimana-giorni">`;
  gs.forEach(x=>{
    const p=x.passato?x.indossati[0]:x.prop&&x.prop.p;
    h+=`<button class="sett-giorno${x.eOggi?" oggi":""}${x.passato?" passato":""}${x.iso===giornoSettimana?" scelto":""}" onclick="scegliGiornoSettimana('${x.iso}')">
      <span class="sett-data"><b>${nomiG[x.d.getDay()]}</b> ${x.d.getDate()}</span>
      <span class="sett-cielo">${x.cielo?`${iconaCielo(x.cielo)} ${x.cielo.min}–${x.cielo.max}°`:"&nbsp;"}</span>
      ${p?miniatura(p):`<span class="mini vuota"></span>`}
      <span class="sett-nome">${p?esc(p.name):x.passato?"niente":"—"}</span>
      <span class="sett-occ">${x.passato?(x.indossati.length>1?`+${x.indossati.length-1}`:"&nbsp;"):nomeOcc[x.occ]}${x.sera?" · sera":""}</span>
    </button>`;
  });
  h+=`</div>`;
  const x=gs.find(y=>y.iso===giornoSettimana);
  if(x&&!x.passato&&x.prop){
    const blocco=(c,titolo)=>`<div class="sett-proposta">
      <button class="sett-proposta-testa" onclick="vaiAlProfumo(${c.p.id})">${miniatura(c.p)}
        <span><span class="incisa">${titolo}</span><b>${esc(c.p.name)}</b><small>${esc(c.p.brand)} · ${c.p.conc}${eCampione(c.p)?" · campione":""}</small></span></button>
      ${elencoMotivi(c.pro.slice(0,4),c.contro.slice(0,2))}
      ${x.eOggi?`<button class="oggi-alt-metto${indossatoOggi(c.p.id)?" fatto":""}" onclick="indossa(${c.p.id});disegnaDiario()">${indossatoOggi(c.p.id)?"Già segnato":"Lo metto"}</button>`:""}
    </div>`;
    h+=`<div class="sett-dettaglio">
      <div class="sett-dettaglio-t"><b>${maiuscola(x.d.toLocaleDateString("it-IT",{weekday:"long",day:"numeric",month:"long"}))}</b>
        ${x.cielo?`<span>${x.cielo.min}–${x.cielo.max}° percepiti${x.cielo.pioggia!==null?`, pioggia dalle ${x.cielo.pioggia}`:""}</span>`:""}
        ${x.incerto&&x.cielo?`<span class="sett-incerto">previsione incerta</span>`:""}</div>
      <div class="ventaglio sett-occasioni">${ciclo.map(k=>`<button class="scelta${k===x.occ?" on":""}" onclick="occasioneSettimana('${x.iso}','${k}')">${nomeOcc[k]}</button>`).join("")}</div>
      ${blocco(x.prop,nomeOcc[x.occ])}${x.sera?blocco(x.sera,"La sera"):""}
    </div>`;
  }else if(x&&x.passato){
    h+=`<div class="sett-dettaglio sett-passato">${x.indossati.length?`Hai indossato ${x.indossati.map(p=>`<button class="collegamento" onclick="vaiAlProfumo(${p.id})">${esc(p.name)}</button>`).join(" e ")}.`:"Niente segnato in questo giorno."}</div>`;
  }
  return h+`</section>`;
}
function scegliGiornoSettimana(iso){giornoSettimana=iso;disegnaDiario()}
function occasioneSettimana(iso,k){occSettimana[iso]=k;giornoSettimana=iso;disegnaDiario()}

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
  h+=settimanaHTML();
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
    ${singoli.map(({x,p})=>`<div class="diario-voce">
        <button class="diario-voce-apri" onclick="vaiAlProfumo(${p.id})">${miniatura(p)}<span class="diario-voce-testo"><b>${esc(p.name)}</b><small>${esc(p.brand)}</small></span></button>
        ${xTogli(p,"Togli "+esc(p.name)+" da questo giorno")}</div>${bloccoAppunto(x,p)}`).join("")}
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
