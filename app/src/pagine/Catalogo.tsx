import { Link } from "react-router";
import { useMemo, useState } from "react";
import type { Profumo } from "../tipi";
import { useDati } from "../dati";
import { piega } from "../profumo";
import { Mini, useTitolo } from "../componenti/comuni";
import { CeLho, useDalPonte } from "../componenti/CeLho";
import { IconaCerca } from "../componenti/Icone";

/* Il catalogo di Sillage: tutti i profumi già schedati (da chiunque), con «Ce l'ho» per metterli nella propria
   vetrina senza dover cercare i dati. Non dice chi li ha. Serve essere entrati. */
type Voce = Pick<Profumo, "id" | "brand" | "name" | "conc" | "img" | "famiglia">;

export default function Catalogo() {
  useTitolo("Il catalogo · Sillage");
  const { chi } = useDati();
  const [q, setQ] = useState("");
  const { dati, errore } = useDalPonte<{ profumi: Voce[] }>(chi?.persona ? { azione: "catalogo" } : null);
  const lista = useMemo(() => {
    const t = piega(q.trim());
    const tutti = [...(dati?.profumi ?? [])].sort((a, b) => (a.brand + a.name).localeCompare(b.brand + b.name, "it"));
    return t ? tutti.filter((p) => piega(`${p.brand} ${p.name} ${p.famiglia ?? ""}`).includes(t)) : tutti;
  }, [dati, q]);

  return (
    <section className="catalogo">
      <p className="incisa">Sillage</p>
      <h1 className="titolo-pagina">Il catalogo</h1>
      <div className="filo-ottone" />
      <p className="testo">
        Tutti i profumi già schedati in Sillage, con i loro dati di Fragrantica. Se ne hai uno, tocca «Ce l'ho»: entra nella tua vetrina,
        come boccetta o come campione.
      </p>
      {!chi?.persona ? (
        <p className="stato-chiave assente">
          Per aggiungere profumi alla tua vetrina entra con il tuo account in{" "}
          <Link className="collegamento" to="/impostazioni">
            Impostazioni
          </Link>
          .
        </p>
      ) : errore ? (
        <p className="stato-chiave sbagliata">Il catalogo non si legge: {errore}.</p>
      ) : !dati ? (
        <p className="testo-piccolo">Apro il catalogo…</p>
      ) : (
        <>
          <label className="cerca">
            <IconaCerca />
            <span className="vh">Cerca nel catalogo</span>
            <input type="search" placeholder="Cerca marca, nome o famiglia" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <p className="testo-piccolo">
            {lista.length} {lista.length === 1 ? "profumo" : "profumi"}
          </p>
          <ul className="classifica catalogo-lista">
            {lista.map((p) => (
              <li key={p.id} className="cl-riga catalogo-riga">
                <Mini p={p as Profumo} />
                <span className="cl-mezzo">
                  <span className="cl-nome">
                    {p.name}
                    <small>{p.conc}</small>
                  </span>
                  <span className="catalogo-marca">{p.brand}</span>
                </span>
                <CeLho id={p.id} nome={p.name} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
