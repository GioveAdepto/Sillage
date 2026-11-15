/* L'account: si entra con quello di CheMetto (Supabase Auth del suo progetto), con email e password.
   Niente libreria: bastano tre richieste (entrare, rinnovare, uscire). Il ponte riceve solo il token d'accesso,
   nel corpo della richiesta, e ne controlla la firma (ponte/LEGGIMI.md, «Gli account»).

   La sessione resta nel localStorage di questo telefono (`sillage-app:accesso`) finché non si esce: come la
   chiave, dice chi sei, non dove eri. Il token dura un'ora e si rinnova da solo quando serve; senza rete resta
   quello che c'è, e le scritture aspettano in coda finché il ponte non lo accetta. */

/** Il progetto Supabase di CheMetto; per le prove in locale VITE_SUPABASE_URL punta a un Supabase finto. */
export const SUPABASE: string = import.meta.env.VITE_SUPABASE_URL || "https://cnjzhksnhkyezocjejyy.supabase.co";
/** La chiave pubblica del progetto («publishable»): è fatta per stare nelle app, non apre niente da sola. */
const PUBBLICA: string = import.meta.env.VITE_SUPABASE_CHIAVE || "sb_publishable_wu6m-6yKT7WRxfblU9THgw_pgSkUAJa";

const MEMORIA = "sillage-app:accesso";
export interface Sessione {
  token: string;
  rinnovo: string;
  /** secondi dall'epoca */
  scade: number;
  email: string;
}

export function leggiSessione(): Sessione | null {
  try {
    const s = JSON.parse(localStorage.getItem(MEMORIA) ?? "null");
    return s && s.token && s.rinnovo ? (s as Sessione) : null;
  } catch {
    return null;
  }
}
function scriviSessione(s: Sessione | null) {
  try {
    if (s) localStorage.setItem(MEMORIA, JSON.stringify(s));
    else localStorage.removeItem(MEMORIA);
  } catch {
    /* navigazione privata: la sessione vale finché l'app resta aperta */
  }
  window.dispatchEvent(new Event("sillage-accesso"));
}

interface RispostaAuth {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: { email?: string };
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
}
async function chiedi(percorso: string, corpo: unknown, token?: string): Promise<{ stato: number; d: RispostaAuth }> {
  const r = await fetch(SUPABASE + "/auth/v1/" + percorso, {
    method: "POST",
    headers: { apikey: PUBBLICA, "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(corpo)
  });
  let d: RispostaAuth = {};
  try {
    d = await r.json();
  } catch {
    d = {};
  }
  return { stato: r.status, d };
}
const daRisposta = (d: RispostaAuth, email: string): Sessione | null =>
  d.access_token && d.refresh_token
    ? {
        token: d.access_token,
        rinnovo: d.refresh_token,
        scade: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
        email: d.user?.email || email
      }
    : null;

/** I messaggi di Supabase (in inglese) detti in italiano: cosa è successo e cosa fare. */
function traduci(d: RispostaAuth): string {
  const m = String(d.error_description || d.msg || d.message || d.error || "");
  if (/invalid login credentials/i.test(m)) return "Email o password non corrette.";
  if (/email not confirmed/i.test(m)) return "L'email non è ancora confermata: apri il link che ti è arrivato.";
  if (/rate limit|security purposes/i.test(m)) return "Troppi tentativi ravvicinati: aspetta qualche minuto e riprova.";
  return "Non è andata. Riprova tra poco." + (m ? " (" + m + ")" : "");
}

/** Entra con email e password. Restituisce un messaggio d'errore, o null se è andata. */
export async function entra(email: string, password: string): Promise<string | null> {
  email = email.trim().toLowerCase();
  try {
    const { d } = await chiedi("token?grant_type=password", { email, password });
    const s = daRisposta(d, email);
    if (!s) return traduci(d);
    scriviSessione(s);
    return null;
  } catch {
    return "Nessuna connessione: per entrare serve la rete.";
  }
}

/** Esce dall'account su questo telefono. Supabase lo sa se c'è rete; la sessione si toglie comunque. */
export async function esci() {
  const s = leggiSessione();
  scriviSessione(null);
  if (s) {
    try {
      await chiedi("logout", {}, s.token);
    } catch {
      /* senza rete: il token scade da solo entro un'ora */
    }
  }
}

/* Un rinnovo alla volta: Supabase cambia il token di rinnovo a ogni uso. */
let rinnovoInCorso: Promise<string> | null = null;
async function rinnova(s: Sessione): Promise<string> {
  try {
    const { stato, d } = await chiedi("token?grant_type=refresh_token", { refresh_token: s.rinnovo });
    const nuova = daRisposta(d, s.email);
    if (nuova) {
      scriviSessione(nuova);
      return nuova.token;
    }
    // il rinnovo non vale più (uscita da un altro posto, account tolto): si esce anche qui
    if (stato >= 400 && stato < 500) scriviSessione(null);
    return "";
  } catch {
    return s.token; // senza rete: quello che c'è, il ponte dirà se va ancora bene
  }
}

/** Il token d'accesso da mandare al ponte, rinnovato se sta per scadere; "" se non si è entrati. */
export async function tokenAccesso(): Promise<string> {
  const s = leggiSessione();
  if (!s) return "";
  if (s.scade - 60 > Date.now() / 1000) return s.token;
  if (!rinnovoInCorso) rinnovoInCorso = rinnova(s).finally(() => (rinnovoInCorso = null));
  return rinnovoInCorso;
}
