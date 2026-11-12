import { Link } from "react-router";
import { useEffect } from "react";
import { useDati } from "../dati";

/* Le pagine che non ci sono ancora: un segnaposto onesto che dice cosa arriverà e quando. */
export interface PaginaInArrivo {
  percorso: string;
  titolo: string;
  /** una riga per l'indice di Altro */
  breve: string;
  tappa: string;
  cosa: string[];
}

export const IN_ARRIVO: PaginaInArrivo[] = [
  {
    percorso: "consigliami",
    titolo: "Consigliami",
    breve: "Cosa mettere oggi, domani o stasera",
    tappa: "Tappa 2",
    cosa: [
      "Oggi, domani o stasera, e l'occasione",
      "Prima la stagione (voti di Fragrantica, calendario e meteo ora per ora), poi l'occasione, poi giorno o sera",
      "La prima scelta sul piedistallo, con i motivi, e le alternative",
      "Lo stesso punteggio dell'app di oggi, verificato con un prima/dopo"
    ]
  },
  {
    percorso: "diario",
    titolo: "Diario",
    breve: "Quando hai messo cosa",
    tappa: "Tappa 3",
    cosa: [
      "Il mese e il giorno, con gli usi e i layering",
      "Appunti col voto",
      "«Lo metto oggi» dalla scheda di ogni profumo",
      "La chiave di Sillage e la coda delle scritture che aspetta la rete"
    ]
  },
  {
    percorso: "numeri",
    titolo: "Numeri",
    breve: "Statistiche, stagioni, classifiche",
    tappa: "Tappa 4",
    cosa: ["Statistiche della collezione", "Stagioni e classifiche", "Storico delle aggiunte", "Mappa olfattiva"]
  },
  {
    percorso: "layering",
    titolo: "Layering",
    breve: "Ricette a due strati",
    tappa: "Tappa 4",
    cosa: ["Le ricette a due strati, sotto e sopra", "Da ogni scheda, le ricette in cui entra quel profumo"]
  },
  {
    percorso: "guida",
    titolo: "Guida",
    breve: "Cosa mettere per ogni occasione",
    tappa: "Tappa 4",
    cosa: ["I profumi giusti per ufficio, serata, appuntamento, palestra e le altre occasioni"]
  },
  {
    percorso: "acquisti",
    titolo: "Acquisti",
    breve: "Le lacune e cosa comprare",
    tappa: "Tappa 4",
    cosa: ["Le lacune della collezione", "Consigli d'acquisto"]
  },
  {
    percorso: "confronta",
    titolo: "Confronta",
    breve: "Fino a tre profumi affiancati",
    tappa: "Tappa 4",
    cosa: ["Fino a tre profumi affiancati, scelti dalla Collezione"]
  },
  {
    percorso: "impostazioni",
    titolo: "Impostazioni",
    breve: "Chiave, posizione per il meteo, dati",
    tappa: "Tappe 2 e 3",
    cosa: ["La chiave di Sillage", "La posizione per il meteo", "Da dove arrivano i dati e la versione dell'app"]
  }
];

/** Le pagine che stanno sotto «Altro» nella barra in basso. */
export const SOTTO_ALTRO = ["layering", "guida", "acquisti", "confronta", "impostazioni", "aggiungi"];

const dataOra = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "non si sa quando";

export function OrigineDati() {
  const { origine, dati, carica, errore } = useDati();
  const da =
    origine === "ponte"
      ? "dal database, appena letti"
      : origine === "copia"
        ? "dalla copia salvata sul telefono" + (errore ? " (il database ora non risponde)" : "")
        : "nessuna copia ancora";
  return (
    <p className="origine">
      Dati {carica && origine !== "ponte" ? "in arrivo…" : da}
      {dati ? <> · aggiornati il {dataOra(dati.aggiornato)}</> : null}
    </p>
  );
}

export default function Segnaposto({ pagina }: { pagina?: PaginaInArrivo }) {
  useEffect(() => {
    document.title = (pagina?.titolo ?? "Pagina non trovata") + " · Sillage";
  }, [pagina]);

  if (!pagina)
    return (
      <section className="segnaposto">
        <p className="incisa">Sillage</p>
        <h1 className="titolo-pagina">Pagina non trovata</h1>
        <div className="filo-ottone" />
        <p className="testo">Questo indirizzo non porta a nessuna pagina.</p>
        <Link className="btn-filo" to="/">
          Torna alla collezione
        </Link>
      </section>
    );

  return (
    <section className="segnaposto">
      <p className="incisa">In allestimento · {pagina.tappa}</p>
      <h1 className="titolo-pagina">{pagina.titolo}</h1>
      <div className="filo-ottone" />
      <p className="testo">
        Questa pagina non c'è ancora nella nuova Sillage. Nel frattempo funziona nell'app di oggi. Quando arriva, qui ci sarà:
      </p>
      <ul className="elenco-arrivo">
        {pagina.cosa.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      {pagina.percorso === "impostazioni" ? <OrigineDati /> : null}
      <Link className="btn-filo" to="/">
        Torna alla collezione
      </Link>
    </section>
  );
}
