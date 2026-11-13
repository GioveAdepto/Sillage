import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/* Un avviso breve in basso, sopra la barra: «Oggi hai già segnato due profumi», «Non salvato: riprova con la rete».
   Letto anche dai lettori di schermo (role=status). */
const Contesto = createContext<(t: string) => void>(() => {});

export function AvvisiProvider({ children }: { children: ReactNode }) {
  const [testo, setTesto] = useState("");
  const [visibile, setVisibile] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const avvisa = useCallback((t: string) => {
    setTesto(t);
    setVisibile(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisibile(false), 3600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Contesto.Provider value={avvisa}>
      {children}
      <div className={"avviso" + (visibile ? " mostra" : "")} role="status" aria-live="polite">
        {testo}
      </div>
    </Contesto.Provider>
  );
}

export const useAvviso = () => useContext(Contesto);
