import type { Profumo } from "../tipi";
import { Boccetta } from "./comuni";

/** La scena: binario di luce, faretto, fascio, piedistallo di travertino con la boccetta e la sua ombra.
    `inVolo`: la boccetta è appena arrivata con una View Transition e non ricade dall'alto. */
export default function Piedistallo({ p, inVolo = false, nomeVolo }: { p: Profumo; inVolo?: boolean; nomeVolo?: string }) {
  return (
    <div className={"scena" + (inVolo ? " in-volo" : "")}>
      <span className="alone" />
      <span className="fascio" />
      <span className="binario" />
      <span className="faretto" />
      <span className="pavimento" />
      <div className="posa">
        <div className="piedistallo" />
        <span className="ombra" />
        <div className="sopra">
          <Boccetta p={p} pigra={false} nomeVolo={nomeVolo} />
        </div>
      </div>
    </div>
  );
}
