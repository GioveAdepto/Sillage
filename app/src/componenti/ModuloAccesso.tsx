import { useState } from "react";
import { scriviAlPonte } from "../ponte";
import { entra, registra } from "../accesso";

/* Il modulo per entrare o registrarsi con l'account di CheMetto: lo usano l'ingresso (la prima schermata di chi
   non è entrato, Ingresso.tsx) e Impostazioni (il telefono che ha ancora solo la chiave di prima). Chi si
   registra sceglie anche il nome con cui comparire agli altri, e ha subito la sua vetrina, vuota. */

/** Un account che Sillage non conosce ancora diventa una persona, con la vetrina vuota. Restituisce un messaggio
    d'errore, o null se la vetrina è pronta (e l'app rilegge chi sei). */
export async function creaVetrina(nome: string): Promise<string | null> {
  try {
    const { corpo } = await scriviAlPonte({ azione: "registrati", nome: nome.trim() });
    if (corpo && corpo.ok) {
      window.dispatchEvent(new Event("sillage-accesso"));
      return null;
    }
    return "La vetrina non è pronta: " + String(corpo?.errore || "il database non ha risposto");
  } catch {
    return "La vetrina non è pronta: serve la rete. L'account c'è: riprova quando torna.";
  }
}

export default function ModuloAccesso({
  modo,
  dopo,
  disattivo
}: {
  modo: "entra" | "registrati";
  /** dopo un'entrata o una vetrina creata (per esempio: torna alla collezione) */
  dopo?: () => void;
  /** per esempio senza rete: il bottone non si preme */
  disattivo?: boolean;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lavoro, setLavoro] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const manca = !email.trim() || !password || (modo === "registrati" && !nome.trim());

  return (
    <form
      className="chiave-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (manca || lavoro) return;
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
        if (modo === "registrati") {
          const errVetrina = await creaVetrina(nome);
          setLavoro(false);
          if (errVetrina) return setProblema(errVetrina);
        } else setLavoro(false);
        dopo?.();
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
      {problema ? (
        <p className="stato-chiave sbagliata" role="alert">
          {problema}
        </p>
      ) : null}
      <div className="chiave-azioni">
        <button type="submit" className="btn-filo pieno" disabled={lavoro || manca || disattivo}>
          {modo === "entra" ? (lavoro ? "Entro…" : "Entra") : lavoro ? "Creo l'account…" : "Crea l'account"}
        </button>
      </div>
    </form>
  );
}
