import { createHashRouter } from "react-router";
import Guscio from "./componenti/Guscio";
import Collezione from "./pagine/Collezione";
import Scheda from "./pagine/Scheda";
import Altro from "./pagine/Altro";
import Consigliami from "./pagine/Consigliami";
import Diario from "./pagine/Diario";
import Impostazioni from "./pagine/Impostazioni";
import Segnaposto, { IN_ARRIVO } from "./pagine/Segnaposto";

/* Router a cancelletto (#/profumo/24): funziona su qualunque hosting e offline,
   il server non deve conoscere le pagine. */
export const router = createHashRouter([
  {
    path: "/",
    element: <Guscio />,
    children: [
      { index: true, element: <Collezione /> },
      { path: "profumo/:id", element: <Scheda /> },
      { path: "consigliami", element: <Consigliami /> },
      { path: "diario", element: <Diario /> },
      { path: "impostazioni", element: <Impostazioni /> },
      { path: "altro", element: <Altro /> },
      ...IN_ARRIVO.filter((p) => !p.pronta).map((p) => ({ path: p.percorso, element: <Segnaposto pagina={p} /> })),
      { path: "*", element: <Segnaposto /> }
    ]
  }
]);
