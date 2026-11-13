/* Com'è fatto un profumo quando arriva dal ponte (GET /api).
   I nomi dei campi sono quelli del ponte, uguali per l'app di oggi. */

export type Colore = "blu" | "verde" | "rosso";
export type SiNo = "si" | "si-mod" | "no" | "" | null | undefined;

export interface Profumo {
  id: number;
  brand: string;
  name: string;
  conc: string;
  genere: string;
  famiglia: string;
  accordi: string[];
  accordi_forza?: string | null;
  noteElenco?: string[] | null;
  /** «Testa: … · Cuore: … · Fondo: …» */
  note: string;
  longevita?: number | null;
  sillage?: string | null;
  giornoPct?: number | null;
  rating?: number | null;
  voti?: number | null;
  stagione: "pe" | "ai" | "tutto";
  stagioni?: { inverno: number; primavera: number; estate: number; autunno: number } | null;
  momento: "giorno" | "sera" | "entrambi";
  colore: Colore;
  ufficio?: SiNo;
  serata?: SiNo;
  quotidiano?: SiNo;
  formale?: SiNo;
  informale?: SiNo;
  appuntamento?: SiNo;
  casa?: SiNo;
  palestra?: SiNo;
  festivita?: SiNo;
  formatoMl?: number | null;
  tipoPossesso?: string | null;
  numFlaconi?: number | null;
  residuoPct?: number | null;
  dupe?: string | null;
  cloneStato?: string | null;
  img?: string | null;
  attivo?: string | null;
  notePersonali?: string | null;
  desc?: string | null;
  fragrantica?: string | null;
  aggiunto?: string | null;
  nuovo?: boolean | null;
}

export interface Ricetta {
  [campo: string]: unknown;
}

/** Quello che l'app tiene dei dati del ponte (il diario cifrato no: arriva con la tappa 3). */
export interface Dati {
  profumi: Profumo[];
  note: string[];
  layering: Ricetta[];
  consigli: Ricetta[];
  aggiornato?: string | null;
}
