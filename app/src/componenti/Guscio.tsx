import { Link, Outlet, ScrollRestoration, useLocation } from "react-router";
import type { ComponentType } from "react";
import { IconaAltro, IconaCollezione, IconaDiario, IconaGoccia, IconaNumeri } from "./Icone";
import { SOTTO_ALTRO } from "../pagine/Segnaposto";

/* Il guscio: la pagina scelta e, in basso, la barra con le cinque voci (il «timone»). */
const VOCI: { a: string; nome: string; Icona: ComponentType<{ className?: string }>; anche: (p: string) => boolean }[] = [
  { a: "/", nome: "Collezione", Icona: IconaCollezione, anche: (p) => p === "/" || p.startsWith("/profumo/") },
  { a: "/consigliami", nome: "Consigliami", Icona: IconaGoccia, anche: (p) => p === "/consigliami" },
  { a: "/diario", nome: "Diario", Icona: IconaDiario, anche: (p) => p === "/diario" },
  { a: "/numeri", nome: "Numeri", Icona: IconaNumeri, anche: (p) => p === "/numeri" },
  { a: "/altro", nome: "Altro", Icona: IconaAltro, anche: (p) => p === "/altro" || SOTTO_ALTRO.some((s) => p === "/" + s) }
];

export default function Guscio() {
  const { pathname } = useLocation();
  return (
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
      <ScrollRestoration />
    </>
  );
}
