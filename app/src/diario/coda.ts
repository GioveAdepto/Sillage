/* Il diario d'uso e la sua coda delle scritture, portati da js/collezione.js (diario, segna, segnaLayering,
   aggiornaVoce, sincronizzaDiario). Niente React qui: le prove (strumenti/prova-coda.mjs) lo usano in Node.

   Le voci confermate arrivano dal ponte (azione=leggi, con la chiave). Quelle appena toccate aspettano in una
   coda sul telefono finché il ponte non le conferma: il pulsante risponde subito anche senza rete, e niente va
   perso se l'app si chiude, perché la coda è salvata prima di ogni invio. */

export type Uso = { occasione?: string; momento?: string };
export interface Voce extends Uso {
  data: string;
  id: number;
  /** l'identità della voce: 13 cifre (Date.now) per un profumo, 14 per metà di un layering (…1 sotto, …2 sopra) */
  t: string;
  nota?: string;
  voto?: number | string | null;
}
export interface Operazione extends Voce {
  op: "metti" | "togli" | "nota";
}

/** Dove la coda e la copia delle voci confermate restano tra un'apertura e l'altra. */
export interface Memoria {
  leggi(k: string): string | null;
  scrivi(k: string, v: string): void;
}
/** Manda una scrittura al ponte (la chiave la aggiunge chi trasporta). Lancia un errore se la rete manca. */
export type Trasporto = (parametri: Record<string, string>) => Promise<{ stato: number; corpo: Record<string, unknown> | null }>;

export const MAX_GIORNO = 2;
const CODA = "sillage-app:diario-coda";
const CONFERMATE = "sillage-app:diario";

export const oggiISO = (d = new Date()) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export const ruoloStrato = (v: Voce) => (String(v.t).length === 14 ? +String(v.t).slice(-1) : 0);
export const coppiaDi = (v: Voce) => String(v.t).slice(0, 13);
const rifiutoChiave = (e: Record<string, unknown> | null) => !!e && /^chiave/.test(String(e.errore || ""));

export type Esito = { ok: true } | { ok: false; avviso: string };

export class Diario {
  private ascoltatori = new Set<() => void>();
  private versione = 0;
  /** l'invio in corso, se c'è; `ancora`: qualcuno ha chiesto un altro giro nel frattempo */
  private corsa: Promise<void> | null = null;
  private ancora = false;
  /** il ponte ha rifiutato la chiave (o manca): le voci restano in coda */
  serveChiave = false;
  /** l'ultimo rifiuto definitivo del ponte, da dire una volta */
  ultimoRifiuto: string | null = null;

  constructor(
    private memoria: Memoria,
    private trasporto: Trasporto,
    private ora: () => number = () => Date.now()
  ) {}

  // ── stato e ascolto (per React: useSyncExternalStore) ──
  ascolta = (f: () => void) => {
    this.ascoltatori.add(f);
    return () => this.ascoltatori.delete(f);
  };
  istantanea = () => this.versione;
  private avvisa() {
    this.versione++;
    this.ascoltatori.forEach((f) => f());
  }

  private leggiJSON<T>(k: string, vuoto: T): T {
    try {
      const v = JSON.parse(this.memoria.leggi(k) ?? "null");
      return Array.isArray(v) ? (v as T) : vuoto;
    } catch {
      return vuoto;
    }
  }
  coda(): Operazione[] {
    return this.leggiJSON<Operazione[]>(CODA, []);
  }
  private scriviCoda(c: Operazione[]) {
    this.memoria.scrivi(CODA, JSON.stringify(c));
  }
  confermate(): Voce[] {
    return this.leggiJSON<Voce[]>(CONFERMATE, []);
  }
  /** Il diario come lo dice il ponte (azione=leggi). */
  impostaConfermate(v: Voce[]) {
    this.memoria.scrivi(CONFERMATE, JSON.stringify(v.map((x) => ({ ...x, t: String(x.t), id: +x.id }))));
    this.serveChiave = false;
    this.avvisa();
  }
  /** Il ponte ha risposto senza diario: la chiave manca o è sbagliata. */
  segnalaChiave() {
    if (!this.serveChiave) {
      this.serveChiave = true;
      this.avvisa();
    }
  }

  /** Le voci da mostrare: le confermate, più quelle in coda, meno quelle tolte, con gli appunti in attesa sopra. */
  voci(): Voce[] {
    const coda = this.coda(),
      tolte = new Set(coda.filter((o) => o.op === "togli").map((o) => String(o.t))),
      m = new Map<string, Voce>();
    this.confermate().forEach((v) => m.set(String(v.t), v));
    coda.filter((o) => o.op === "metti").forEach(({ op: _op, ...o }) => m.set(String(o.t), o));
    coda
      .filter((o) => o.op === "nota")
      .forEach((o) => {
        const v = m.get(String(o.t));
        if (v) m.set(String(o.t), { ...v, nota: o.nota, voto: o.voto, occasione: o.occasione, momento: o.momento });
      });
    return [...m.values()].filter((v) => !tolte.has(String(v.t)));
  }
  vociDelGiorno(data: string, ids?: Set<number>) {
    return this.voci().filter((v) => v.data === data && (!ids || ids.has(+v.id)));
  }
  /** I giorni (fino a oggi) in cui un profumo è stato indossato, in ordine. */
  giorniDi(id: number) {
    const oggi = oggiISO(new Date(this.ora()));
    return this.voci()
      .filter((v) => +v.id === id && v.data <= oggi)
      .map((v) => v.data)
      .sort();
  }
  giorniDa(id: number): number | null {
    const v = this.giorniDi(id);
    if (!v.length) return null;
    const [y, m, d] = oggiISO(new Date(this.ora())).split("-").map(Number);
    const [y2, m2, d2] = v[v.length - 1].split("-").map(Number);
    return Math.round((new Date(y, m - 1, d).getTime() - new Date(y2, m2 - 1, d2).getTime()) / 864e5);
  }
  indossatoOggi(id: number) {
    const oggi = oggiISO(new Date(this.ora()));
    return this.voci().some((v) => +v.id === id && v.data === oggi);
  }
  /** Il layering di un giorno, se c'è: gli id di sotto e sopra. */
  layeringDel(data: string): { sotto: number; sopra: number } | null {
    const v = this.vociDelGiorno(data).filter(ruoloStrato);
    const sotto = v.find((x) => ruoloStrato(x) === 1),
      sopra = v.find((x) => ruoloStrato(x) === 2);
    return sotto && sopra ? { sotto: +sotto.id, sopra: +sopra.id } : null;
  }
  /** Le voci da cambiare insieme: il profumo di quel giorno, o tutta la coppia se è un layering. */
  vociUso(id: number, data: string) {
    const v = this.vociDelGiorno(data),
      x = v.find((y) => +y.id === id);
    if (!x) return [];
    return ruoloStrato(x) ? v.filter((y) => ruoloStrato(y) && coppiaDi(y) === coppiaDi(x)) : [x];
  }

  // ── scritture ──
  private togliDallaCoda(coda: Operazione[], v: Voce) {
    // tolta prima che il ponte la vedesse: basta cancellarla dalla coda
    const i = coda.findIndex((o) => o.op === "metti" && String(o.t) === String(v.t));
    if (i >= 0) coda.splice(i, 1);
    else coda.push({ op: "togli", id: +v.id, data: v.data, t: String(v.t) });
  }
  /** Mette o toglie un profumo in un giorno. Togliere metà di un layering lo toglie tutto.
      `ids`: i profumi in collezione (le voci di profumi tolti dal catalogo non contano). */
  segna(id: number, data: string, uso?: Uso, ids?: Set<number>): Esito {
    const coda = this.coda(),
      giorno = this.vociDelGiorno(data, ids),
      gia = giorno.find((v) => +v.id === id);
    if (gia) {
      const insieme = ruoloStrato(gia) ? giorno.filter((v) => ruoloStrato(v) && coppiaDi(v) === coppiaDi(gia)) : [gia];
      insieme.forEach((v) => this.togliDallaCoda(coda, v));
      this.scriviCoda(coda);
    } else {
      if (giorno.length >= MAX_GIORNO)
        return { ok: false, avviso: `${data === oggiISO(new Date(this.ora())) ? "Oggi" : "Quel giorno"} hai già segnato due profumi: togline uno prima.` };
      coda.push({ op: "metti", id, data, t: String(this.ora()), ...(uso || {}) });
      this.scriviCoda(coda);
    }
    this.avvisa();
    void this.sincronizza();
    return { ok: true };
  }
  /** Il layering occupa il giorno intero. Se quel giorno c'era già uno dei due come singolo, diventa parte
      della coppia; un terzo profumo invece va tolto prima. */
  segnaLayering(sotto: number, sopra: number, data: string, uso?: Uso, ids?: Set<number>, nomeDi?: (id: number) => string): Esito {
    if (!sotto || !sopra || sotto === sopra) return { ok: false, avviso: "Servono due profumi diversi." };
    const coda = this.coda(),
      giorno = this.vociDelGiorno(data, ids);
    const altro = giorno.find((v) => +v.id !== sotto && +v.id !== sopra);
    if (altro)
      return { ok: false, avviso: `Quel giorno c'è già ${nomeDi?.(+altro.id) || "un altro profumo"}: toglilo prima di segnare un layering.` };
    giorno.forEach((v) => this.togliDallaCoda(coda, v));
    const base = String(this.ora());
    coda.push({ op: "metti", id: sotto, data, t: base + "1", ...(uso || {}) }, { op: "metti", id: sopra, data, t: base + "2", ...(uso || {}) });
    this.scriviCoda(coda);
    this.avvisa();
    void this.sincronizza();
    return { ok: true };
  }
  /** Cambia appunto, voto, occasione o momento di una voce. Se la voce aspetta ancora in coda si corregge lì;
      se il ponte l'ha già, parte un op=nota con tutti i campi. */
  aggiornaVoce(t: string, cambi: Partial<Voce>) {
    t = String(t);
    const coda = this.coda(),
      m = coda.find((o) => o.op === "metti" && String(o.t) === t);
    if (m) Object.assign(m, cambi);
    else {
      const v = this.voci().find((x) => String(x.t) === t);
      if (!v) return;
      const i = coda.findIndex((o) => o.op === "nota" && String(o.t) === t);
      if (i >= 0) coda.splice(i, 1);
      coda.push({
        op: "nota", id: +v.id, data: v.data, t,
        nota: v.nota || "", voto: v.voto || "", occasione: v.occasione || "", momento: v.momento || "",
        ...cambi
      });
    }
    this.scriviCoda(coda);
    this.avvisa();
    void this.sincronizza();
  }

  /** Manda la coda al ponte, una voce alla volta, in ordine. Si ferma al primo intoppo e riprova più tardi
      (al ritorno della rete, alla prossima scrittura, alla prossima apertura). */
  sincronizza(): Promise<void> {
    // un invio alla volta; chi lo chiede mentre uno è in corso ottiene un altro giro subito dopo,
    // così una voce segnata mentre la precedente viaggia non aspetta il tocco successivo
    if (this.corsa) {
      this.ancora = true;
      return this.corsa;
    }
    this.corsa = (async () => {
      try {
        do {
          this.ancora = false;
          await this.giro();
        } while (this.ancora);
      } finally {
        this.corsa = null;
      }
    })();
    return this.corsa;
  }

  private async giro(): Promise<void> {
    try {
      // si rilegge la coda a ogni passo: un appunto rimasto indietro («resta») parte nello stesso giro
      // freno: se il telefono non riuscisse a salvare la coda, la stessa voce non ripartirebbe all'infinito
      let passi = this.coda().length * 2 + 4;
      for (let o = this.coda()[0]; o && passi-- > 0; o = this.coda()[0]) {
        const uso = { occasione: o.occasione || "", momento: o.momento || "" };
        const parametri: Record<string, string> = {
          azione: "diario", op: o.op, id: String(o.id), data: o.data, t: String(o.t),
          ...(o.op === "nota"
            ? { nota: o.nota || "", voto: String(o.voto || ""), ...uso }
            : o.op === "metti" && (uso.occasione || uso.momento)
              ? uso
              : {})
        };
        const r = await this.trasporto(parametri); // senza rete lancia: si riprova più tardi
        const e = r.corpo;
        // un errore HTTP (il ponte ha avuto un problema, 500) non ha deciso niente: la voce resta.
        // Il ponte risponde 200 anche quando rifiuta una voce: quei rifiuti si leggono nel corpo, qui sotto.
        if (r.stato >= 400) break;
        // senza la chiave giusta la voce resta in coda, e l'app la chiede
        if (rifiutoChiave(e)) {
          this.segnalaChiave();
          break;
        }
        // «sconosciuta:» (profumo o azione che il ponte non conosce ancora) o risposta strana: si aspetta
        if (!e || (!e.ok && (!e.errore || /sconosciuta:/.test(String(e.errore))))) break;
        // un ponte senza occasione e momento risponde ok ma non li scrive: si aspetta
        if (o.op === "nota" && e.ok && !e.uso) break;
        // un rifiuto definitivo (voce non valida, troppe voci, voce non trovata) toglie la voce dalla coda
        if (!e.ok) this.ultimoRifiuto = String(e.errore);
        let resta: Operazione | null = null; // quello che il ponte deve ancora sapere di questa voce
        const confermate = this.confermate();
        let nuove = confermate;
        if (e.ok && o.op === "nota") {
          nuove = confermate.map((v) => (String(v.t) === String(o.t) ? { ...v, nota: o.nota, voto: o.voto, ...uso } : v));
        } else if (e.ok && o.op === "metti") {
          nuove = confermate.filter((v) => String(v.t) !== String(o.t)).concat({ data: o.data, id: +o.id, t: String(o.t), ...(e.uso ? uso : {}) });
          // cambiata mentre viaggiava: si manda il resto dopo
          const ora = this.coda().find((x) => x.op === "metti" && String(x.t) === String(o.t)) || o;
          if ((!e.uso && (ora.occasione || ora.momento)) || (ora.occasione || "") !== uso.occasione || (ora.momento || "") !== uso.momento || ora.nota || ora.voto)
            resta = {
              op: "nota", id: +o.id, data: o.data, t: String(o.t),
              nota: ora.nota || "", voto: ora.voto || "", occasione: ora.occasione || "", momento: ora.momento || ""
            };
        } else if (e.ok) nuove = confermate.filter((v) => String(v.t) !== String(o.t));
        this.memoria.scrivi(CONFERMATE, JSON.stringify(nuove));
        this.scriviCoda(
          this.coda()
            .filter((x) => !(x.op === o.op && String(x.t) === String(o.t)))
            .concat(resta ? [resta] : [])
        );
        this.avvisa();
      }
    } catch {
      /* rete assente: si riprova al ritorno della rete o al prossimo tocco */
    }
  }
}
