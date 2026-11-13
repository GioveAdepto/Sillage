/* Il meteo, portato da js/dati.js (aggiornaMeteo, piove, finestraMeteo, cieli).
   Viene da Open-Meteo: gratuito, senza chiave. La posizione la chiede il browser, e solo quando
   la chiedi tu dal pulsante in Consigliami; poi resta sul telefono, arrotondata a una decina di
   chilometri, e il meteo si rinfresca da solo quando è più vecchio di mezz'ora. */

export interface OraMeteo {
  /** ora locale del posto, «2026-10-07T15:00» */
  t: string;
  /** temperatura */
  T: number;
  /** percepita */
  P: number;
  /** umidità % */
  u: number;
  /** probabilità di pioggia % */
  pp: number;
  /** millimetri */
  mm: number;
  /** codice del cielo (WMO) */
  c: number;
}
export interface Meteo {
  quando: number;
  temperatura: number;
  percepita: number;
  umidita: number;
  precipitazioni: number;
  codice: number;
  tramonto: string | null;
  tramonti: string[];
  ore: OraMeteo[] | null;
}
export interface Posto {
  lat: number;
  lon: number;
}

/** Le ore in cui il profumo sta sulla pelle, riassunte. */
export interface Finestra {
  ore: OraMeteo[];
  max: number;
  min: number;
  media: number;
  umid: number;
  oraMax: number;
  oraMin: number;
  pioggia: number | null;
  dalle: number;
  alle: number;
  incerto?: boolean;
}

export const CIELI: Record<number, string> = {
  0: "sereno", 1: "quasi sereno", 2: "poco nuvoloso", 3: "coperto", 45: "nebbia", 48: "nebbia",
  51: "pioviggine", 53: "pioviggine", 55: "pioviggine", 56: "pioviggine gelata", 57: "pioviggine gelata",
  61: "pioggia", 63: "pioggia", 65: "pioggia forte", 66: "pioggia gelata", 67: "pioggia gelata",
  71: "neve", 73: "neve", 75: "neve forte", 77: "neve", 80: "rovesci", 81: "rovesci", 82: "rovesci forti",
  85: "neve", 86: "neve", 95: "temporale", 96: "temporale", 99: "temporale"
};

export const piove = (m: Meteo | null) =>
  !!m && (m.precipitazioni > 0 || (m.codice >= 51 && m.codice <= 67) || (m.codice >= 80 && m.codice <= 82) || m.codice >= 95);
export const piovosa = (o: OraMeteo) =>
  o.pp >= 50 || o.mm >= 0.2 || (o.c >= 51 && o.c <= 67) || (o.c >= 80 && o.c <= 82) || o.c >= 95;
export const cieloDi = (m: Meteo | null) => (m ? `${m.temperatura}° ${CIELI[m.codice] || ""}`.trim() : "");

/* Il meteo pesa per le ore in cui il profumo sta sulla pelle, non come media del giorno:
   da quando lo metti fino alla durata che dichiara. La previsione oraria resta buona per 12 ore. */
export function finestraMeteo(meteo: Meteo | null, da: Date, ore: number): Finestra | null {
  const m = meteo && meteo.ore && Date.now() - meteo.quando < 12 * 3600e3 ? meteo : null;
  if (!m || !m.ore) return null;
  const a = da.getTime() - 36e5 + 1,
    b = da.getTime() + ore * 36e5;
  const h = m.ore.filter((o) => {
    const t = new Date(o.t).getTime();
    return t >= a && t < b;
  });
  if (!h.length) return null;
  const P = h.map((o) => o.P),
    max = Math.max(...P),
    min = Math.min(...P),
    ora = (o: OraMeteo) => new Date(o.t).getHours();
  const pioggia = h.find(piovosa);
  return {
    ore: h,
    max,
    min,
    media: Math.round(P.reduce((s, x) => s + x, 0) / P.length),
    umid: Math.round(h.reduce((s, o) => s + o.u, 0) / h.length),
    oraMax: ora(h[P.indexOf(max)]),
    oraMin: ora(h[P.indexOf(min)]),
    pioggia: pioggia ? ora(pioggia) : null,
    dalle: ora(h[0]),
    alle: (ora(h[h.length - 1]) + 1) % 24
  };
}

// ── sul telefono ──────────────────────────────────────────────────────────
const CHIAVE_POSTO = "sillage-app:posto";
const CHIAVE_METEO = "sillage-app:meteo";
function leggi<T>(k: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(k) ?? "null");
  } catch {
    return null;
  }
}
function scrivi(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* pazienza */
  }
}
export const meteoSalvato = () => leggi<Meteo>(CHIAVE_METEO);
export const postoSalvato = () => leggi<Posto>(CHIAVE_POSTO);
export function scordaPosto() {
  try {
    localStorage.removeItem(CHIAVE_POSTO);
    localStorage.removeItem(CHIAVE_METEO);
  } catch {
    /* pazienza */
  }
}

/** Chiede la posizione al browser (solo dal pulsante) e la arrotonda a una decina di chilometri. */
export function chiediPosto(): Promise<Posto | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((r) =>
    navigator.geolocation.getCurrentPosition(
      (p) => r({ lat: +p.coords.latitude.toFixed(1), lon: +p.coords.longitude.toFixed(1) }),
      () => r(null),
      { maximumAge: 864e5, timeout: 15000, enableHighAccuracy: false }
    )
  );
}

/** Scarica otto giorni ora per ora; lo salva sul telefono. */
export async function scaricaMeteo(posto: Posto): Promise<Meteo> {
  const u =
    `https://api.open-meteo.com/v1/forecast?latitude=${posto.lat}&longitude=${posto.lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code` +
    `&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,weather_code` +
    `&daily=sunset&timezone=auto&forecast_days=8`;
  const r = await fetch(u);
  if (!r.ok) throw new Error("Open-Meteo ha risposto " + r.status);
  const d = await r.json(),
    o = d.hourly;
  const meteo: Meteo = {
    quando: Date.now(),
    temperatura: Math.round(d.current.temperature_2m),
    percepita: Math.round(d.current.apparent_temperature),
    umidita: d.current.relative_humidity_2m,
    precipitazioni: d.current.precipitation,
    codice: d.current.weather_code,
    tramonto: d.daily && d.daily.sunset ? d.daily.sunset[0] : null,
    tramonti: (d.daily && d.daily.sunset) || [],
    ore: o
      ? o.time.map((t: string, i: number) => ({
          t,
          T: Math.round(o.temperature_2m[i]),
          P: Math.round(o.apparent_temperature[i]),
          u: o.relative_humidity_2m[i],
          pp: o.precipitation_probability[i] ?? 0,
          mm: o.precipitation[i] ?? 0,
          c: o.weather_code[i]
        }))
      : null
  };
  scrivi(CHIAVE_METEO, meteo);
  return meteo;
}

/** Come aggiornaMeteo(chiedi) dell'app di oggi: la copia fresca basta, altrimenti si riscarica. */
export async function aggiornaMeteo(chiedi: boolean): Promise<{ meteo: Meteo | null; posto: Posto | null }> {
  const salvato = meteoSalvato();
  if (salvato && salvato.ore && Date.now() - salvato.quando < 30 * 6e4) return { meteo: salvato, posto: postoSalvato() };
  let posto = postoSalvato();
  if (!posto) {
    if (!chiedi) return { meteo: salvato, posto: null };
    posto = await chiediPosto();
    if (!posto) return { meteo: salvato, posto: null };
    scrivi(CHIAVE_POSTO, posto);
  }
  try {
    return { meteo: await scaricaMeteo(posto), posto };
  } catch {
    return { meteo: salvato, posto };
  }
}
