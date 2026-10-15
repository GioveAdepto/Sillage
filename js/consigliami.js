/* Sillage — scelte rapide, il cassetto dei filtri e Consigliami, con la
   stagione come criterio principale. */

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
  const oggi=`<button class="scelta oggi" onclick="apriOggi()">${ic.stella}Consigliami</button>`;
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
  segnaStoria({...(history.state||{}),modale:"filtri"});
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
  togliDallaStoria("modale");
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
/* I cinque profumi migliori (boccette e campioni insieme) per l'occasione, la
   stagione, l'ora e il meteo, ognuno con il suo perche'. Il diario registra e
   basta: non sposta la classifica, e a parita' decide il rating. I profumi
   mai indossati compaiono a parte, in piccolo, sotto le alternative. Per
   domani vale lo stesso ragionamento, spostato all'ora in cui lo metterai.
   L'ufficio non esclude: dosa. Tutti i profumi entrano, e chi non e' da
   ufficio scende in classifica con il consiglio di quanto metterne. */
const occasioniOggi=[["ufficio","Ufficio"],["quotidiano","Quotidiano"],["appuntamento","Appuntamento"],["formale","Formale"],["casa","In casa"],["festivita","Festività"],["palestra","Palestra"]];
// a che ora, domani, si mette il profumo per quell'occasione
const oraPerOccasione={ufficio:8,quotidiano:9,casa:10,palestra:18,appuntamento:19,formale:19,festivita:19};
let occOggi=null,quandoOggi="oggi";
function inizioPer(quando,occ){
  if(quando instanceof Date)return quando;          // un giorno preciso: il piano della settimana
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
/* La temperatura entra nella stagione (sotto, stagioneDelMomento). Qui
   restano le due cose che la stagione non dice: il caldo umido, che rende
   pesante un orientale denso, e la pioggia, con cui legni e resine rendono
   meglio. */
function effettoMeteo(p,f){
  if(!f)return {s:0,perche:"",contro:""};
  const densi=densita(p)>=.45;
  let s=0,perche="",contro="";
  if(f.max>=24&&f.umid>=70&&densi){s-=1.5;contro=`con ${f.max}° e aria umida un denso pesa`}
  if(f.pioggia!==null&&p.accordi.some(a=>/Legnoso|Terroso|Fumoso|Ambra|Balsamico/.test(a))){s+=1;
    perche=`pioggia dalle ${f.pioggia}: legni e resine rendono bene`}
  return {s,perche,contro};
}

// ── LA STAGIONE, CRITERIO PRINCIPALE ──────────────────────────────────────
/* Quanto un profumo e' "di stagione" non e' piu' un si/no: si confrontano i
   voti per stagione di Fragrantica (quanta gente lo porta d'inverno, in
   primavera, d'estate, d'autunno) con la stagione del momento, che a sua
   volta nasce da due cose:
   - il calendario, sfumato: a meta' ottobre e' quasi tutto autunno, a fine
     novembre gia' un po' inverno;
   - la temperatura percepita nelle ore in cui il profumo sara' addosso:
     un ottobre a 24 gradi chiede profumi da tarda estate.
   Primavera e autunno hanno le stesse temperature: li distingue il
   calendario. Senza meteo vale solo il calendario. */
const STAGIONI=["inverno","primavera","estate","autunno"];
function quoteStagioni(p){
  const v=STAGIONI.map(k=>Math.max(0,+(p.stagioni&&p.stagioni[k])||0)),t=v.reduce((a,b)=>a+b,0);
  return Object.fromEntries(STAGIONI.map((k,i)=>[k,t?v[i]/t:.25]));
}
function stagioneDelMomento(da,f){
  const g=Math.floor((da-new Date(da.getFullYear(),0,0))/864e5),centri={inverno:20,primavera:110,estate:201,autunno:293};
  const cal={};STAGIONI.forEach(k=>{let d=Math.abs(g-centri[k]);d=Math.min(d,365-d);cal[k]=Math.max(0,1-d/91)});
  const norm=o=>{const t=STAGIONI.reduce((a,k)=>a+o[k],0)||1;STAGIONI.forEach(k=>o[k]/=t);return o};
  norm(cal);
  if(!f)return {w:cal,T:null};
  const T=f.media,temp={inverno:Math.max(0,1-Math.abs(T-4)/7),estate:Math.max(0,1-Math.abs(T-26)/7)};
  const mite=Math.max(0,1-Math.abs(T-15)/7);
  // la mezza stagione la decide il calendario: primavera o autunno
  const verso=cal.primavera+cal.estate>=cal.autunno+cal.inverno?"primavera":"autunno";
  temp.primavera=verso==="primavera"?mite:0;temp.autunno=verso==="autunno"?mite:0;
  if(T<=-3)temp.inverno=1;if(T>=33)temp.estate=1;
  norm(temp);
  const kt=f.incerto?.35:.6,w={};STAGIONI.forEach(k=>w[k]=(1-kt)*cal[k]+kt*temp[k]);
  return {w:norm(w),T};
}
// senza previsione oraria (posizione mai data, o rete assente) vale il meteo di adesso, solo per oggi
function finestraPer(p,da,quando){
  let f=finestraMeteo(da,durataSullaPelle(p));
  // oltre i tre giorni e mezzo la previsione e' meno affidabile: la temperatura pesa meno del calendario
  if(f&&da-Date.now()>3.5*864e5)f={...f,incerto:true};
  if(f||quando!=="oggi")return f;
  const m=adesso().meteo;if(!m)return null;
  return {ore:[],max:m.percepita,min:m.percepita,media:m.percepita,umid:m.umidita,oraMax:da.getHours(),oraMin:da.getHours(),
    pioggia:piove(m)?da.getHours():null,dalle:da.getHours(),alle:da.getHours()};
}
function candidatiOggi(occ,quando=quandoOggi){
  const da=inizioPer(quando,occ),a=adesso(da),mo=a.momento;
  return profumi.filter(p=>occ==="ufficio"||p[occ]==="si"||p[occ]==="si-mod").map(p=>{
    const g0=giorniDa(p.id),f=finestraPer(p,da,quando),mt=effettoMeteo(p,f);
    /* Il punteggio e i motivi nascono insieme: ogni voce che sposta la
       classifica lascia una frase, a favore o contro. */
    const pro=[],contro=[];
    let s=mt.s;
    if(occ==="ufficio"){
      if(p.ufficio==="si"){s+=2;pro.push("va bene in ufficio: 2–3 spray")}
      else if(p.ufficio==="si-mod"){s+=.5;contro.push("in ufficio va dosato: 2 spray sul petto")}
      // -3, quanto "fuori stagione": con -1,5 a 8 gradi un gourmand entrava tra i primi cinque
      else{s-=3;contro.push("in ufficio solo 1 spray, sotto i vestiti")}
    }
    else if(p[occ]==="si"){s+=2;pro.push(fraseOccasione[occ])}
    else{s+=.5;contro.push(`${dosatoPer[occ]} va dosato: uno spray`)}
    // la stagione: il peso piu' grande della classifica (da circa -4 a +5)
    const q=quoteStagioni(p),sm=stagioneDelMomento(da,f);
    const S=STAGIONI.reduce((a,k)=>a+sm.w[k]*q[k],0);
    s+=24*(S-.25);
    const suaTop=STAGIONI.reduce((a,k)=>q[k]>q[a]?k:a),oraTop=STAGIONI.reduce((a,k)=>sm.w[k]>sm.w[a]?k:a);
    const clima=sm.T!==null?`con ${f.min===f.max?f.media:f.min+"–"+f.max}° percepiti`:`in ${oraTop}`;
    const quandoSi=k=>(k==="estate"||k==="inverno"?"d'":"in ")+k;
    if(S>=.3)pro.push(`${clima} è di stagione: su Fragrantica lo portano soprattutto ${quandoSi(suaTop)} (${Math.round(q[suaTop]*100)}%)`);
    else if(S<.2)contro.push(`${clima} è fuori stagione: su Fragrantica lo portano soprattutto ${quandoSi(suaTop)} (${Math.round(q[suaTop]*100)}%)`);
    // giorno o sera: conta, ma meno (da -1,5 a +1,5)
    const gp=(p.giornoPct??50)/100,dn=mo==="giorno"?gp-.5:.5-gp;
    s+=3*dn;
    if(dn>=.15)pro.push(mo==="giorno"?`è da giorno (${Math.round(gp*100)}% dei voti)`:`è da sera (${Math.round((1-gp)*100)}% dei voti)`);
    else if(dn<=-.15)contro.push(mo==="giorno"?`è più da sera (${Math.round((1-gp)*100)}% dei voti)`:`è più da giorno (${Math.round(gp*100)}% dei voti)`);
    if(mt.perche)pro.push(mt.perche);
    if(mt.contro)contro.push(mt.contro);
    // un campione mai indossato e' un'occasione per provarlo: lo si dice, ma la classifica non cambia
    if(eCampione(p)&&g0===null)pro.push(`è un campione${p.formatoMl?` da ${p.formatoMl} ml`:""}: buona occasione per provarlo`);
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
  segnaStoria({...(history.state||{}),modale:"oggi"});
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
  togliDallaStoria("modale");
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
    h+=`<div class="oggi-vuoto">Nessun profumo adatto a questa occasione.</div>`;
  }else{
    /* Tutto in vista: la prima in rilievo, seconda e terza affiancate, le altre
       in elenco sotto, sempre nell'ordine del punteggio. */
    const lometto=(p,cls)=>domani?"":`<button class="${cls}${indossatoOggi(p.id)?" fatto":""}" onclick="${indossatoOggi(p.id)?"":`indossa(${p.id},'${occOggi}','${(oraPerOccasione[occOggi]||9)>=17?"sera":a.momento}');`}chiudiOggi()">${indossatoOggi(p.id)?"Già segnato":"Lo metto"}</button>`;
    /* Cinque, non tutte: la prima con tutti i suoi perche', le altre quattro
       con i tre motivi piu' forti e il contro principale. */
    const [primo,...resto]=c.slice(0,5);
    const {p,f}=primo,cl=vetroClasse[p.colore],r=ricettaPer(p,occOggi);
    const altro=r?profumi.find(x=>x.id===[...r.l.s.matchAll(/№\s*(\d+)/g)].map(m=>+m[1]).find(id=>id!==p.id)):null;
    h+=`<div class="oggi-scelta ${cl}">
      <div class="oggi-nicchia"><div class="faretto acceso">${p.img?`<img src="${p.img}" alt="">`:vetroLettera[p.colore]}</div><div class="ripiano"></div></div>
      <div class="oggi-testo">
        <div class="oggi-conto">Il primo consiglio · su ${c.length} ${occOggi==="ufficio"?"valutati":"adatti"}</div>
        <div class="marca">${esc(p.brand)}</div>
        <div class="oggi-nome">${esc(p.name)}</div>
        <div class="oggi-sotto2">${eCampione(p)?`<span class="oggi-campione">Campione</span>`:""}${p.conc} · ${esc(p.famiglia)}${domani?` · domani dalle ${da.getHours()}`:""}</div>
      </div>
    </div>
    <div class="incisa oggi-perche">Perché questo</div>
    ${elencoMotivi(primo.pro,primo.contro)}
    ${striscia(f)}
    ${r&&altro?(()=>{const pr=partiRicetta(r.l),fatto=pr.sotto&&pr.sopra&&layeringFatto(pr.sotto.id,pr.sopra.id);
      return `<div class="oggi-strato-riga"><button class="oggi-strato" onclick="chiudiOggi();vaiAllaRicetta(${r.i})">${miniatura(altro)}
      <span><span class="incisa">Se vuoi osare, con</span><b>${esc(altro.name)}</b><small>${esc(r.nome)}</small></span></button>
      ${!domani&&pr.sotto&&pr.sopra?`<button class="oggi-strato-metto${fatto?" fatto":""}" onclick="faiLayering(${pr.sotto.id},${pr.sopra.id},'${occOggi}','${(oraPerOccasione[occOggi]||9)>=17?"sera":a.momento}')">${fatto?"Segnato":"Lo faccio"}</button>`:""}</div>`})():""}
    <div class="oggi-azioni">
      <button class="${domani?"btn-oro":"btn-ombra"}" onclick="chiudiOggi();vaiAlProfumo(${p.id})">Scheda</button>
      ${lometto(p,"btn-oro")}
    </div>`;
    if(resto.length)h+=`<div class="oggi-sezione incisa">Le alternative</div>`+resto.map((x,i)=>`
      <div class="oggi-alt">
        <button class="oggi-alt-corpo" onclick="chiudiOggi();vaiAlProfumo(${x.p.id})">
          <span class="oggi-posto">${i+2}</span>${miniatura(x.p)}
          <span class="oggi-alt-testo">
            <span class="oggi-alt-nome">${esc(x.p.name)}<small>${esc(x.p.brand)} · ${x.p.conc}${eCampione(x.p)?` · <b class="oggi-campione">campione</b>`:""}</small></span>
            <span class="oggi-alt-perche">${x.pro.slice(0,3).map(maiuscola).join(" · ")}${x.contro.length?`<em> · ma ${x.contro[0]}</em>`:""}</span>
          </span>
        </button>${lometto(x.p,"oggi-alt-metto")}
      </div>`).join("");
    /* Fuori classifica, in piccolo: tra quelli adatti, i mai indossati. Un
       promemoria, non un consiglio. */
    const cinque=new Set(c.slice(0,5).map(x=>x.p.id));
    const mai=c.filter(x=>!cinque.has(x.p.id)&&x.g===null&&x.s>0).slice(0,4);
    if(mai.length)h+=`<div class="oggi-mai"><span class="incisa">Mai indossati, se vuoi riscoprirli</span>${mai.map(x=>
      `<button onclick="chiudiOggi();vaiAlProfumo(${x.p.id})">${esc(x.p.name)}</button>`).join('<span class="sep">·</span>')}</div>`;
  }
  h+=meteo
    ?`<div class="oggi-meteo">Meteo di dove sei, ora per ora, da Open-Meteo · <button class="collegamento" onclick="scordaPosto()">non usarlo più</button></div>`
    :`<button class="oggi-meteo-chiedi" onclick="usaMeteo(true)"${chiedendoPosto?" disabled":""}>${chiedendoPosto?"Cerco la posizione…":"Usa il meteo di dove sei"}</button>
      <div class="oggi-meteo">Serve la posizione, una volta: resta sul telefono, arrotondata a una decina di chilometri.</div>`;
  document.getElementById("oggi-corpo").innerHTML=h;
}
