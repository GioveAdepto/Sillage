import { useEffect, useState } from "react";
import { scriviAlPonte } from "../ponte";

/* Letture dal ponte fatte con le proprie credenziali, fuori dai dati dell'app: le vetrine degli altri. */

/** Una richiesta al ponte con le proprie credenziali; l'errore detto in italiano. */
export async function chiedi(parametri: Record<string, string>): Promise<Record<string, unknown>> {
  const { stato, corpo } = await scriviAlPonte(parametri);
  if (stato >= 400 || !corpo) throw new Error("il database non ha risposto");
  if (corpo.errore) throw new Error(String(corpo.errore));
  return corpo;
}

/** Legge dal ponte una cosa sola (le vetrine, una vetrina): null mentre arriva. */
export function useDalPonte<T>(parametri: Record<string, string> | null) {
  const [esito, setEsito] = useState<{ dati: T | null; errore: string | null }>({ dati: null, errore: null });
  const chiave = parametri ? JSON.stringify(parametri) : "";
  useEffect(() => {
    if (!parametri) return;
    let vivo = true;
    setEsito({ dati: null, errore: null });
    chiedi(parametri)
      .then((d) => vivo && setEsito({ dati: d as T, errore: null }))
      .catch((e: Error) => vivo && setEsito({ dati: null, errore: /fetch|network|load failed/i.test(e.message) ? "serve la rete" : e.message }));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave]);
  return esito;
}
