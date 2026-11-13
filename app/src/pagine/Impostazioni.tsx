import { useState } from "react";
import { useDati } from "../dati";
import { useMeteo } from "../meteo-contesto";
import { PONTE, leggiChiave, scriviChiave } from "../ponte";
import { useDiario } from "../diario/uso";
import { useTitolo } from "../componenti/comuni";
import { OrigineDati } from "./Segnaposto";

/* Impostazioni: la chiave di Sillage, la posizione per il meteo, da dove arrivano i dati e la versione.
   La chiave resta solo nel localStorage di questo telefono e non si mostra mai per intero. */
export default function Impostazioni() {
  useTitolo("Impostazioni · Sillage");
  const { statoChiave } = useDati();
  const { meteo, conPosto, scorda } = useMeteo();
  const { diario } = useDiario();
  const [nuova, setNuova] = useState("");
  const salvata = leggiChiave();
  const inCoda = diario.coda().length;

  return (
    <section className="impostazioni">
      <p className="incisa">Sillage</p>
      <h1 className="titolo-pagina">Impostazioni</h1>
      <div className="filo-ottone" />

      <section className="sez" aria-labelledby="t-chiave">
        <div className="sez-testa">
          <h3 id="t-chiave">La chiave di Sillage</h3>
          <i className="linea" />
        </div>
        <p className="testo-piccolo">
          Protegge il diario, il residuo e il catalogo. Si inserisce una volta e resta solo su questo telefono: viaggia verso il database dentro
          la richiesta, mai nell'indirizzo.
        </p>
        <p className={"stato-chiave " + statoChiave}>
          {statoChiave === "giusta"
            ? "Chiave giusta: il diario è collegato."
            : statoChiave === "sbagliata"
              ? "La chiave salvata non è quella giusta."
              : statoChiave === "da-provare"
                ? "Chiave salvata: si prova appena il database risponde."
                : "Nessuna chiave su questo telefono."}
          {inCoda ? ` ${inCoda} ${inCoda === 1 ? "scrittura aspetta" : "scritture aspettano"} di partire.` : ""}
        </p>
        <form
          className="chiave-form"
          onSubmit={(e) => {
            e.preventDefault();
            const k = nuova.trim();
            if (!k) return;
            scriviChiave(k);
            setNuova("");
          }}
        >
          <label className="cerca">
            <span className="vh">Chiave di Sillage</span>
            <input
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={salvata ? "Incolla una chiave nuova per cambiarla" : "Incolla la chiave"}
              value={nuova}
              onChange={(e) => setNuova(e.target.value)}
            />
          </label>
          <div className="chiave-azioni">
            <button type="submit" className="btn-filo pieno" disabled={!nuova.trim()}>
              Salva la chiave
            </button>
            {salvata ? (
              <button type="button" className="btn-filo" onClick={() => scriviChiave("")}>
                Togli la chiave
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="sez" aria-labelledby="t-meteo">
        <div className="sez-testa">
          <h3 id="t-meteo">Il meteo</h3>
          <i className="linea" />
        </div>
        {conPosto ? (
          <>
            <p className="testo-piccolo">
              Consigliami usa il meteo di dove sei, ora per ora, da Open-Meteo. La posizione resta su questo telefono, arrotondata a una decina
              di chilometri{meteo ? `; ultimo aggiornamento alle ${new Date(meteo.quando).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : ""}.
            </p>
            <button type="button" className="btn-filo" onClick={scorda}>
              Non usare più la posizione
            </button>
          </>
        ) : (
          <p className="testo-piccolo">Nessuna posizione: Consigliami ragiona con il calendario. Si attiva dal pulsante in fondo a Consigliami.</p>
        )}
      </section>

      <section className="sez" aria-labelledby="t-dati">
        <div className="sez-testa">
          <h3 id="t-dati">I dati</h3>
          <i className="linea" />
        </div>
        <OrigineDati />
        <p className="testo-piccolo">
          Database: {new URL(PONTE).host}
          {PONTE.includes("127.0.0.1") || PONTE.includes("localhost") ? " (ponte locale di prova)" : ""} · versione dell'app{" "}
          {import.meta.env.MODE === "production" ? "nuova, in prova" : "di sviluppo"}
        </p>
      </section>
    </section>
  );
}
