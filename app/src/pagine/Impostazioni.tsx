import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { scordaCopie, useDati } from "../dati";
import { useMeteo } from "../meteo-contesto";
import { PONTE, leggiChiave, scriviAlPonte } from "../ponte";
import { entra, esci, leggiSessione, registra } from "../accesso";
import { useDiario } from "../diario/uso";
import { useTitolo } from "../componenti/comuni";
import { OrigineDati } from "./Segnaposto";

/* Il tuo account: lo stesso tipo di CheMetto, con email e password. La sessione resta su questo telefono finché
   non esci. Chi entra la prima volta con un account che Sillage non conosce sceglie un nome e ha la sua vetrina
   (vuota) e il suo diario; Danilo invece collega il suo account al suo diario usando la chiave che il telefono ha
   già. Uscendo, il telefono scorda la vetrina e il diario di chi c'era (prima devono partire le scritture in coda). */
function Account() {
  const { chi } = useDati();
  const { diario } = useDiario();
  const navigate = useNavigate();
  const [sessione, setSessione] = useState(leggiSessione);
  const [modo, setModo] = useState<"entra" | "registrati">("entra");
  const [nome, setNome] = useState("");
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
  const inCoda = diario.coda().length;

  /** Un account che Sillage non conosce ancora diventa una persona, con la vetrina vuota: si va a vederla. */
  const creaVetrina = async (n: string) => {
    setLavoro(true);
    setProblema(null);
    try {
      const { corpo } = await scriviAlPonte({ azione: "registrati", nome: n.trim() });
      if (corpo && corpo.ok) {
        window.dispatchEvent(new Event("sillage-accesso"));
        navigate("/");
      } else setProblema("La vetrina non è pronta: " + String(corpo?.errore || "il database non ha risposto"));
    } catch {
      setProblema("La vetrina non è pronta: serve la rete. L'account c'è: riprova da qui quando torna.");
    } finally {
      setLavoro(false);
    }
  };
  /** Uscendo, il telefono scorda la vetrina e il diario di chi c'era: chi entra dopo vede solo i suoi. */
  const esciDaQui = async () => {
    await esci();
    scordaCopie();
    window.dispatchEvent(new Event("sillage-accesso"));
  };

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
              <>
                <p className="testo-piccolo">
                  Sei nuovo in Sillage: scegli il nome con cui comparire agli altri. Avrai la tua vetrina, vuota, e il tuo diario.
                </p>
                <label className="cerca">
                  <span className="vh">Il tuo nome in Sillage</span>
                  <input type="text" autoComplete="nickname" placeholder="Il tuo nome in Sillage" value={nome} onChange={(e) => setNome(e.target.value)} />
                </label>
              </>
            )
          ) : null}
          {problema ? <p className="stato-chiave sbagliata">{problema}</p> : null}
          {inCoda && !chi?.daCollegare ? (
            <p className="testo-piccolo">
              Prima di uscire devono partire {inCoda === 1 ? "1 scrittura" : `${inCoda} scritture`} del diario: aspetta la rete.
            </p>
          ) : null}
          <div className="chiave-azioni">
            {chi?.daCollegare && chiave ? (
              <button type="button" className="btn-filo pieno" disabled={lavoro} onClick={collega}>
                {lavoro ? "Collego…" : "Collega l'account al mio diario"}
              </button>
            ) : null}
            {chi?.daCollegare && !chiave ? (
              <button type="button" className="btn-filo pieno" disabled={lavoro || !nome.trim()} onClick={() => void creaVetrina(nome)}>
                {lavoro ? "Preparo…" : "Crea la mia vetrina"}
              </button>
            ) : null}
            <button type="button" className="btn-filo" disabled={!!inCoda && !chi?.daCollegare} onClick={esciDaQui}>
              Esci dall'account
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="vetrine scelta-account" role="group" aria-label="Entra o registrati">
            <button type="button" className="vetrina-bottone" aria-pressed={modo === "entra"} onClick={() => setModo("entra")}>
              Entra
            </button>
            <button type="button" className="vetrina-bottone" aria-pressed={modo === "registrati"} onClick={() => setModo("registrati")}>
              Registrati
            </button>
          </div>
          <p className="testo-piccolo">
            {modo === "entra"
              ? "È lo stesso tipo di account di CheMetto: se lo usi già, entra con quello. Resta su questo telefono finché non esci."
              : "Un account nuovo, con la tua vetrina e il tuo diario. Vale anche per CheMetto, se un giorno vorrai usarlo."}
          </p>
          <form
            className="chiave-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!email.trim() || !password || (modo === "registrati" && !nome.trim())) return;
              setLavoro(true);
              setProblema(null);
              const errore = modo === "entra" ? await entra(email, password) : await registra(email, password);
              if (errore === "conferma") {
                setLavoro(false);
                setProblema("Ti è arrivata un'email: apri il link per confermare l'account, poi torna qui ed entra.");
                return;
              }
              if (errore) {
                setLavoro(false);
                setProblema(errore);
                return;
              }
              setPassword("");
              if (modo === "registrati") await creaVetrina(nome);
              setLavoro(false);
            }}
          >
            {modo === "registrati" ? (
              <label className="cerca">
                <span className="vh">Il tuo nome in Sillage</span>
                <input type="text" autoComplete="nickname" placeholder="Il tuo nome in Sillage" value={nome} onChange={(e) => setNome(e.target.value)} />
              </label>
            ) : null}
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
                autoComplete={modo === "entra" ? "current-password" : "new-password"}
                placeholder={modo === "entra" ? "Password" : "Password (almeno 8 caratteri)"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {problema ? <p className="stato-chiave sbagliata">{problema}</p> : null}
            <div className="chiave-azioni">
              <button type="submit" className="btn-filo pieno" disabled={lavoro || !email.trim() || !password || (modo === "registrati" && !nome.trim())}>
                {modo === "entra" ? (lavoro ? "Entro…" : "Entra") : lavoro ? "Creo l'account…" : "Crea l'account"}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

/* Impostazioni: il tuo account, la posizione per il meteo, da dove arrivano i dati e la versione. La chiave di
   Sillage non si inserisce più (tappa 5 degli account): se il telefono ha ancora quella di prima, lo si dice, e se
   ne va da sola appena l'account collegato basta (src/ponte.ts, scordaChiave). */
export default function Impostazioni() {
  useTitolo("Impostazioni · Sillage");
  const { meteo, conPosto, scorda } = useMeteo();
  const vecchiaChiave = !!leggiChiave();

  return (
    <section className="impostazioni">
      <p className="incisa">Sillage</p>
      <h1 className="titolo-pagina">Impostazioni</h1>
      <div className="filo-ottone" />

      <Account />

      {vecchiaChiave ? (
        <p className="testo-piccolo">
          Su questo telefono c'è ancora la chiave di Sillage di prima: serve finché non entri con il tuo account collegato, poi se ne va da
          sola.
        </p>
      ) : null}

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
