import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { scordaCopie, useDati } from "../dati";
import { esci, leggiSessione } from "../accesso";
import ModuloAccesso, { creaVetrina } from "./ModuloAccesso";
import { segnaAperta } from "./Apertura";
import { useMenoMovimento, useTitolo } from "./comuni";

/* L'ingresso: la prima schermata di chi non è entrato. È la vetrina chiusa dell'apertura (le due ante di
   travertino, la schermata d'avvio dell'iPhone), con sopra un cartoncino d'avorio: si entra con l'account di
   CheMetto, oppure ci si registra. Entrando, le ante si aprono sulla propria vetrina. Nessuna vetrina si vede da
   qui: senza account l'app non chiede niente al ponte (dati.tsx).

   Copre anche chi è entrato ma il ponte non riconosce: un account nuovo senza vetrina (sceglie il nome) o un
   accesso che non vale più (rientra). Senza rete si può solo aspettare: per entrare serve la rete. */
export default function Ingresso({
  onVia,
  dopo = "/",
  modoIniziale = "entra",
  torna
}: {
  onVia: () => void;
  /** dove andare una volta dentro: la vetrina, o la scheda pubblica da cui si è venuti (#/p/…) */
  dopo?: string;
  modoIniziale?: "entra" | "registrati";
  /** dalla scheda pubblica: «Torna alla scheda del profumo» */
  torna?: () => void;
}) {
  const { entrato, chi, statoChiave, carica, errore } = useDati();
  const riduci = useMenoMovimento();
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entra" | "registrati">(modoIniziale);
  const [rete, setRete] = useState(() => navigator.onLine !== false);
  const [apri, setApri] = useState(false);
  const [nome, setNome] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  useTitolo("Sillage · Entra");

  useEffect(() => segnaAperta(), []);
  useEffect(() => {
    const su = () => setRete(true);
    const giu = () => setRete(false);
    window.addEventListener("online", su);
    window.addEventListener("offline", giu);
    return () => {
      window.removeEventListener("online", su);
      window.removeEventListener("offline", giu);
    };
  }, []);

  const senzaVetrina = entrato && !!chi?.daCollegare && !chi.persona;
  const nonValido = entrato && !!chi && !chi.persona && !chi.daCollegare;
  // riconosciuto dal ponte (o il ponte non risponde: si apre lo stesso, l'app sa stare senza rete)
  const pronto = entrato && (statoChiave === "giusta" || (statoChiave === "da-provare" && !carica && !!errore));

  useEffect(() => {
    if (!pronto || apri) return;
    navigate(dopo, { replace: true });
    setApri(true);
  }, [pronto, apri, navigate, dopo]);
  // le ante si aprono (1200ms), poi l'ingresso se ne va
  useEffect(() => {
    if (!apri) return;
    const t = setTimeout(onVia, riduci ? 0 : 1300);
    return () => clearTimeout(t);
  }, [apri, onVia, riduci]);

  const usaAltro = async () => {
    await esci();
    scordaCopie();
    setProblema(null);
    window.dispatchEvent(new Event("sillage-accesso"));
  };
  const scegliNome = async () => {
    setLavoro(true);
    setProblema(null);
    const err = await creaVetrina(nome);
    setLavoro(false);
    if (err) setProblema(err);
  };

  let corpo;
  if (senzaVetrina) {
    corpo = (
      <>
        <p className="ingresso-invito">Ancora un passo</p>
        <p className="testo-piccolo">
          L'account {leggiSessione()?.email ? <b>{leggiSessione()?.email}</b> : null} non ha ancora una vetrina. Scegli il nome con cui comparire agli
          altri: avrai la tua vetrina, per ora vuota, e il tuo diario.
        </p>
        <form
          className="chiave-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (nome.trim() && !lavoro) void scegliNome();
          }}
        >
          <label className="cerca">
            <span className="vh">Il tuo nome in Sillage</span>
            <input type="text" autoComplete="nickname" placeholder="Il tuo nome in Sillage" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          {problema ? (
            <p className="stato-chiave sbagliata" role="alert">
              {problema}
            </p>
          ) : null}
          <div className="chiave-azioni">
            <button type="submit" className="btn-filo pieno" disabled={lavoro || !nome.trim() || !rete}>
              {lavoro ? "Preparo…" : "Crea la mia vetrina"}
            </button>
          </div>
        </form>
        <p className="ingresso-cambio">
          Non sei tu?{" "}
          <button type="button" onClick={() => void usaAltro()}>
            Usa un altro account
          </button>
        </p>
      </>
    );
  } else if (entrato && !nonValido) {
    corpo = (
      <p className="ingresso-attesa" role="status">
        Apro la tua vetrina…
      </p>
    );
  } else {
    corpo = (
      <>
        <p className="ingresso-invito">{modo === "entra" ? "Entra con il tuo account di CheMetto" : "Crea il tuo account"}</p>
        <p className="testo-piccolo">
          {modo === "entra"
            ? "La stessa email e la stessa password che usi in CheMetto. Resti dentro, su questo telefono, finché non esci."
            : "Avrai la tua vetrina e il tuo diario. L'account vale anche per CheMetto, se un giorno vorrai usarlo."}
        </p>
        {nonValido ? <p className="stato-chiave sbagliata">L'accesso su questo telefono non vale più: rientra con il tuo account.</p> : null}
        {!rete ? <p className="stato-chiave da-provare">Serve la rete per entrare. Quando torna, riprova da qui.</p> : null}
        <ModuloAccesso modo={modo} disattivo={!rete} />
        <p className="ingresso-cambio">
          {modo === "entra" ? "Non hai un account?" : "Hai già un account?"}{" "}
          <button type="button" onClick={() => setModo(modo === "entra" ? "registrati" : "entra")}>
            {modo === "entra" ? "Registrati" : "Entra"}
          </button>
        </p>
      </>
    );
  }

  return (
    <div className={"ingresso" + (apri ? " apri" : "")}>
      <div className="anta sinistra" aria-hidden="true">
        <i className="maniglia" />
      </div>
      <div className="anta destra" aria-hidden="true">
        <i className="maniglia" />
      </div>
      <div className="ingresso-scorre">
        <section className="ingresso-carta" aria-labelledby="t-ingresso">
          <header className="ingresso-testa">
            <span className="apertura-s" aria-hidden="true">
              S
            </span>
            <h1 id="t-ingresso" className="ingresso-nome">
              Sillage
            </h1>
            <p className="ingresso-sotto">Collezione privata</p>
          </header>
          <i className="ingresso-filo" aria-hidden="true" />
          {corpo}
          {torna && !entrato ? (
            <p className="ingresso-cambio">
              <button type="button" onClick={torna}>
                Torna alla scheda del profumo
              </button>
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
