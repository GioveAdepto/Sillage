import { Link } from "react-router";
import type { ReactNode } from "react";
import type { Profumo } from "../tipi";
import { Mini } from "./comuni";

/* Un profumo nominato da un'altra pagina (Numeri, Guida, Layering, Acquisti): la boccetta piccola e il nome.
   Il tocco porta alla Collezione, sulla sua teca chiusa, che si illumina (#/?vedi=ID, regola dell'utente). */
export const vediIn = (p: Profumo) => `/?vedi=${p.id}`;

export function Tessera({ p, nota, classe = "" }: { p: Profumo; nota?: ReactNode; classe?: string }) {
  return (
    <Link className={"tessera " + classe} to={vediIn(p)}>
      <Mini p={p} />
      <span className="tessera-nome">{p.name}</span>
      <span className="tessera-sotto">{nota ?? p.conc}</span>
    </Link>
  );
}

export function Tessere({ children }: { children: ReactNode }) {
  return <div className="tessere">{children}</div>;
}
