/* Sillage — navigazione, tasto indietro e link diretti, la vetrina che si
   apre, l'app installabile e l'avvio. È l'ultimo file caricato: quando gira
   tutto il resto è già definito. Resta app.js perché il controllo della
   versione nuova cerca proprio js/app.js?v= nella pagina pubblicata. */

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
  if((history.state||{}).vista!==v)segnaStoria({vista:v});
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

// ── IL TASTO INDIETRO E I LINK DIRETTI ──────────────────────────────────
/* Ogni sezione, ogni scheda aperta e ogni pannello hanno il loro posto nella
   cronologia: il tasto indietro (o lo scorrimento da bordo) chiude quello
   che si e' aperto per ultimo invece di uscire dal sito. L'indirizzo dice
   dove si e': #guida, #numeri, #profumo-12; incollato altrove, porta li'.
   Chiudendo a mano si riscrive la voce invece di tornare indietro: un
   ritorno asincrono, mentre si sta gia' andando altrove, smonterebbe il
   salto appena fatto. */
let daStoria=false;
const indirizzoDi=st=>st.profumo?`#profumo-${st.profumo}`:st.teca?`#profumo-${st.teca}`:st.vista&&st.vista!=="collezione"?`#${st.vista}`:location.pathname+location.search;
function segnaStoria(st,sostituisci){
  if(daStoria)return;
  try{history[sostituisci?"replaceState":"pushState"](st,"",indirizzoDi(st))}catch(e){}
}
const sostituisciStoria=st=>segnaStoria(st,true);
function togliDallaStoria(k){
  const st={...(history.state||{})};
  if(!(k in st))return;
  delete st[k];if(k==="teca")delete st.profumo;
  sostituisciStoria(st);
}
addEventListener("popstate",e=>{
  const st=e.state||{vista:"collezione"};
  daStoria=true;
  try{
    if(!st.modale){chiudiOggi();chiudiFiltri()}
    if(!st.teca){
      if(tecaNelPannello)chiudiPannello();
      document.querySelectorAll("#vista-collezione .teca.aperta").forEach(c=>apriTeca(+c.id.slice(5)));
    }
    const ora=document.querySelector(".vista.attiva,#vista-collezione.attiva");
    const v=st.vista||"collezione",id=ora&&ora.id.replace("vista-","");
    if(v!==id)cambiaVista(v);
  }finally{daStoria=false}
});
// letto subito: il primo cambiaVista riscrive l'indirizzo prima che i dati arrivino
const linkIniziale=location.hash.slice(1);
function seguiLinkDiretto(){
  const h=linkIniziale;
  sostituisciStoria({vista:"collezione"});
  const m=h.match(/^profumo-(\d+)$/);
  if(m&&profumi.some(p=>p.id===+m[1])){vaiAlProfumo(+m[1]);return}
  if(document.getElementById("vista-"+h)&&h!=="collezione")cambiaVista(h);
}

// ── LA VETRINA SI APRE ────────────────────────────────────────────────────
/* All'avvio due ante di vetro coprono lo schermo; quando la collezione e'
   pronta si aprono verso l'esterno, come le porte di una vetrina. Sull'iPhone
   l'immagine d'avvio dell'app e' la stessa vetrina chiusa, cosi' il passaggio
   non si vede. Mai meno di mezzo secondo (se no e' un lampo), mai piu' di
   due e mezzo anche se i dati tardano. */
const avvioPagina=performance.now();
function apriVetrina(){
  const el=document.getElementById("apertura");
  if(!el||el.classList.contains("apri"))return;
  if(riduci.matches){el.remove();return}
  setTimeout(()=>{
    el.classList.add("apri");
    setTimeout(()=>el.remove(),1500);
  },Math.max(0,520-(performance.now()-avvioPagina)));
}
setTimeout(apriVetrina,2500);
// immagini gia' in cache: l'onload puo' arrivare prima che l'attributo ci sia
setInterval(()=>document.querySelectorAll("img.sfuma:not(.su)").forEach(i=>{if(i.complete)i.classList.add("su")}),700);
const recensioni=n=>{n=+n;return n>=1000?(n/1000).toLocaleString("it-IT",{maximumFractionDigits:n>=10000?0:1})+"k":String(n)};

// ── APP INSTALLABILE ──────────────────────────────────────────────────────
/* Il service worker rende Sillage un'app da schermata home che si apre anche
   senza rete. Se il browser non lo supporta, il sito funziona come prima. */
let registrazioneSW=null;
if("serviceWorker" in navigator&&location.protocol!=="file:"){
  addEventListener("load",()=>navigator.serviceWorker.register("sw.js").then(r=>registrazioneSW=r).catch(()=>{}));
}

/* ── C'E' UNA VERSIONE NUOVA ──
   Ogni pubblicazione cambia il ?v= con cui index.html richiama app.js. Si
   rilegge la pagina pubblicata (all'avvio, quando l'app torna in primo piano
   e ogni mezz'ora) e, se il numero e' cambiato, compare un avviso: toccandolo
   si ricarica. Serve soprattutto all'app sulla schermata Home, che non ha un
   pulsante per ricaricare. */
const versioneQui=(()=>{const s=document.querySelector('script[src*="app.js"]');const m=s&&s.src.match(/[?&]v=([^&]+)/);return m?m[1]:null})();
let ultimoControllo=0;
async function controllaVersione(){
  if(!versioneQui||!navigator.onLine||Date.now()-ultimoControllo<60e3)return;
  ultimoControllo=Date.now();
  try{
    const r=await fetch("./?controllo="+Date.now(),{cache:"no-store"});
    const m=(await r.text()).match(/js\/app\.js\?v=([^"'&]+)/);
    if(m&&m[1]!==versioneQui)mostraAggiornamento();
    if(registrazioneSW)registrazioneSW.update().catch(()=>{});
  }catch(e){/* senza rete si riprova la prossima volta */}
}
function mostraAggiornamento(){
  if(document.getElementById("aggiornamento"))return;
  const el=document.createElement("div");
  el.id="aggiornamento";el.className="aggiornamento";el.setAttribute("role","status");
  el.innerHTML=`<span class="aggiornamento-punto"></span><span class="aggiornamento-testo"><b>Versione nuova di Sillage</b>Tocca per aggiornare</span>
    <button class="btn-oro" onclick="location.reload()">Aggiorna</button>
    <button class="btn-nudo" onclick="this.parentNode.remove()" aria-label="Più tardi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
  el.querySelector(".aggiornamento-testo").onclick=()=>location.reload();
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add("mostra"));
}
addEventListener("load",()=>setTimeout(controllaVersione,4000));
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")controllaVersione()});
setInterval(controllaVersione,30*60e3);

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
                 seguiLinkDiretto();
                 apriVetrina();
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
