import { useEffect, useState } from "react";
import { useDati } from "../dati";
import { useMeteo } from "../meteo-contesto";
import { PONTE, leggiChiave, scriviAlPonte, scriviChiave } from "../ponte";
import { entra, esci, leggiSessione } from "../accesso";
import { useDiario } from "../diario/uso";
import { useTitolo } from "../componenti/comuni";
import { OrigineDati } from "./Segnaposto";

/* Il tuo account: quello di CheMetto, con email e password. La sessione resta su questo telefono finché non
   esci. Il primo giro (tappa 3) serve a Danilo: entra e collega l'account al suo diario usando la chiave che
   il telefono ha già; da lì la chiave non serve più per leggere e scrivere. */
function Account() {
  const { chi } = useDati();
  const [sessione, setSessione] = useState(leggiSessione);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  useEffect(() => {
    const f = () => setSessione(leggiSessione());
    window.addEventListener("sillage-accesso", f);
    return () => window.removeEventListener("sillage-accesso", f);
  }, []);
  const chiave = leggiChiave();

  const collega = async () => {
    setLavoro(true);
    setProblema(null);
    try {
      const { corpo } = await scriviAlPonte({ azione: "collega" });
      if (corpo && corpo.ok) window.dispatchEvent(new Event("sillage-accesso"));
      else setProblema("Non collegato: " + String(corpo?.errore || "il database non ha risposto"));
    } catch {
      setProblema("Non collegato: serve la rete.");
    } finally {
      setLavoro(false);
    }
  };

  return (
    <section className="sez" aria-labelledby="t-account">
      <div className="sez-testa">
        <h3 id="t-account">Il tuo account</h3>
        <i className="linea" />
      </div>
      {sessione ? (
        <>
          <p
            className={
              "stato-chiave " + (chi?.da === "accesso" ? "giusta" : chi?.daCollegare || chi?.accessoNonValido ? "sbagliata" : "da-provare")
            }
          >
            Sei entrato come <b>{sessione.email}</b>.{" "}
            {chi?.da === "accesso"
              ? `Il diario è quello di ${chi.nome || chi.persona}.`
              : chi?.daCollegare
                ? "Questo account non è ancora collegato a Sillage."
                : chi?.accessoNonValido
                  ? "L'accesso non è più valido: esci e rientra."
                  : "Il database lo riconoscerà appena risponde."}
          </p>
          {chi?.daCollegare ? (
            chiave ? (
              <p className="testo-piccolo">
                Su questo telefono c'è la chiave di Sillage: collegando l'account, il diario e il residuo diventano suoi e la chiave non serve più
                per leggerli e scriverli.
              </p>
            ) : (
              <p className="testo-piccolo">Per collegarlo serve, una volta, la chiave di Sillage su questo telefono (qui sotto).</p>
            )
          ) : null}
          {problema ? <p className="stato-chiave sbagliata">{problema}</p> : null}
          <div className="chiave-azioni">
            {chi?.daCollegare && chiave ? (
              <button type="button" className="btn-filo pieno" disabled={lavoro} onClick={collega}>
                {lavoro ? "Collego…" : "Collega l'account al mio diario"}
              </button>
            ) : null}
            <button type="button" className="btn-filo" onClick={() => void esci()}>
              Esci dall'account
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="testo-piccolo">
            È lo stesso account di CheMetto: email e password. Se lo usi già, entra con quello; resta su questo telefono finché non esci.
          </p>
          <form
            className="chiave-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!email.trim() || !password) return;
              setLavoro(true);
              setProblema(null);
              const errore = await entra(email, password);
              setLavoro(false);
              if (errore) setProblema(errore);
              else setPassword("");
            }}
          >
            <label className="cerca">
              <span className="vh">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="cerca">
              <span className="vh">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {problema ? <p className="stato-chiave sbagliata">{problema}</p> : null}
            <div className="chiave-azioni">
              <button type="submit" className="btn-filo pieno" disabled={lavoro || !email.trim() || !password}>
                {lavoro ? "Entro…" : "Entra"}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

/* Impostazioni: il tuo account, la chiave di Sillage, la posizione per il meteo, da dove arrivano i dati e la
   versione. La chiave resta solo nel localStorage di questo telefono e non si mostra mai per intero. */
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

      <Account />

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
          {!salvata
            ? "Nessuna chiave su questo telefono."
            : statoChiave === "giusta"
              ? "Chiave salvata: il diario è collegato."
              : statoChiave === "sbagliata"
                ? "La chiave salvata non è quella giusta."
                : "Chiave salvata: si prova appena il database risponde."}
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
