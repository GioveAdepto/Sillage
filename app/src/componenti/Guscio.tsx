import { Link, Outlet, ScrollRestoration, useLocation } from "react-router";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { IconaAltro, IconaCollezione, IconaDiario, IconaGoccia, IconaNumeri } from "./Icone";
import { SOTTO_ALTRO } from "../pagine/Segnaposto";
import { DiarioVivo } from "../diario/uso";
import VersioneNuova from "./VersioneNuova";
import Apertura from "./Apertura";
import Ingresso from "./Ingresso";
import { useDati } from "../dati";
import AggiunteVive from "./AggiunteVive";
import SchedaPubblica from "../pagine/SchedaPubblica";

/* Il guscio: la pagina scelta e, in basso, la barra con le cinque voci (il «timone»). Chi non è entrato (o chi il
   ponte non riconosce) vede solo l'ingresso, e niente dietro; entrando, l'ingresso apre le ante sulla vetrina. */
const VOCI: { a: string; nome: string; Icona: ComponentType<{ className?: string }>; anche: (p: string) => boolean }[] = [
  { a: "/", nome: "Collezione", Icona: IconaCollezione, anche: (p) => p === "/" || p.startsWith("/profumo/") || p.startsWith("/p/") },
  { a: "/consigliami", nome: "Consigliami", Icona: IconaGoccia, anche: (p) => p === "/consigliami" },
  { a: "/diario", nome: "Diario", Icona: IconaDiario, anche: (p) => p === "/diario" },
  { a: "/numeri", nome: "Numeri", Icona: IconaNumeri, anche: (p) => p === "/numeri" },
  { a: "/altro", nome: "Altro", Icona: IconaAltro, anche: (p) => p === "/altro" || SOTTO_ALTRO.some((s) => p === "/" + s || p.startsWith("/" + s + "/")) }
];

export default function Guscio() {
  const { pathname } = useLocation();
  const { entrato, chi } = useDati();
  const serve = !entrato || (!!chi && !chi.persona);
  const [ingresso, setIngresso] = useState(serve);
  useEffect(() => {
    if (serve) setIngresso(true);
  }, [serve]);
  const via = useCallback(() => setIngresso(false), []);
  /* La scheda pubblica (#/p/24, il link da CheMetto) si vede anche senza account, da sola: niente barra né vetrina
     dietro. «Entra» porta all'ingresso, che dopo l'accesso torna qui (e da qui alla propria scheda, se il profumo è suo). */
  const pubblica = /^\/p\/[^/]+$/.test(pathname);
  const [entra, setEntra] = useState<"entra" | "registrati" | null>(null);
  // un altro indirizzo (un altro link da CheMetto): di nuovo la scheda, non l'ingresso
  useEffect(() => setEntra(null), [pathname]);
  if (serve && pubblica && !entra)
    return (
      <>
        <main id="contenuto" tabIndex={-1} className="foglio pubblica">
          <SchedaPubblica onEntra={setEntra} />
        </main>
        <VersioneNuova />
        <ScrollRestoration />
      </>
    );
  return (
    <>
      {serve ? null : (
        <>
          <a className="salta" href="#contenuto" onClick={(e) => { e.preventDefault(); document.getElementById("contenuto")?.focus(); }}>
            Vai al contenuto
          </a>
          <main id="contenuto" tabIndex={-1} className="foglio">
            <Outlet />
          </main>
          <nav className="timone" aria-label="Sezioni">
            <ul>
              {VOCI.map(({ a, nome, Icona, anche }) => (
                <li key={a}>
                  <Link className="remo" to={a} aria-current={anche(pathname) ? "page" : undefined}>
                    <Icona />
                    {nome}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <DiarioVivo />
          <AggiunteVive />
        </>
      )}
      <VersioneNuova />
      {ingresso || serve ? (
        <Ingresso onVia={via} dopo={pubblica ? pathname : "/"} modoIniziale={entra ?? "entra"} torna={pubblica && entra ? () => setEntra(null) : undefined} />
      ) : (
        <Apertura />
      )}
      <ScrollRestoration />
    </>
  );
}
