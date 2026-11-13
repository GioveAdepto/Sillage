import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource/cormorant-garamond/latin-400-italic.css";
import "@fontsource/cormorant-garamond/latin-500-italic.css";
import "@fontsource/jost/latin-400.css";
import "@fontsource/jost/latin-500.css";
import "./stile/token.css";
import "./stile/base.css";
import "./stile/collezione.css";
import "./stile/scheda.css";
import "./stile/pagine.css";
import "./stile/consigliami.css";
import "./stile/diario.css";
import "./stile/viste.css";
import { DatiProvider } from "./dati";
import { MeteoProvider } from "./meteo-contesto";
import { AvvisiProvider } from "./componenti/Avvisi";
import { router } from "./rotte";

createRoot(document.getElementById("radice")!).render(
  <StrictMode>
    <DatiProvider>
      <MeteoProvider>
        <AvvisiProvider>
          <RouterProvider router={router} />
        </AvvisiProvider>
      </MeteoProvider>
    </DatiProvider>
  </StrictMode>
);
