import { useEffect, useState } from "react";
import { scriviAlPonte } from "../ponte";
import { useDati } from "../dati";
import { useAvviso } from "./Avvisi";

/* «Ce l'ho»: aggiunge alla propria vetrina un profumo già schedato in Sillage (catalogo comune o vetrina di un
   altro), come boccetta o come campione. I dati del profumo sono quelli della scheda: niente da cercare. */

/** Una richiesta al ponte con le proprie credenziali; l'errore detto in italiano. */
export async function chiedi(parametri: Record<string, string>): Promise<Record<string, unknown>> {
  const { stato, corpo } = await scriviAlPonte(parametri);
  if (stato >= 400 || !corpo) throw new Error("il database non ha risposto");
  if (corpo.errore) throw new Error(String(corpo.errore));
  return corpo;
}

/** Legge dal ponte una cosa sola (catalogo, vetrine, una vetrina): null mentre arriva. */
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

export function CeLho({ id, nome }: { id: number; nome: string }) {
  const { perId, riprova, chi } = useDati();
  const avvisa = useAvviso();
  const [scegli, setScegli] = useState(false);
  const [invio, setInvio] = useState(false);
  if (perId.has(id)) return <span className="ce-gia">Nella tua vetrina</span>;
  if (!chi?.persona) return null;
  const aggiungi = async (tipo: "full" | "campione") => {
    setInvio(true);
    try {
      await chiedi({ azione: "possesso", op: "aggiungi", id: String(id), tipo });
      avvisa(`${nome} è nella tua vetrina`);
      riprova();
    } catch (e) {
      avvisa("Non aggiunto: " + ((e as Error).message || "riprova"));
    } finally {
      setInvio(false);
      setScegli(false);
    }
  };
  if (!scegli)
    return (
      <button type="button" className="btn-filo ce-lho" onClick={() => setScegli(true)}>
        Ce l'ho
      </button>
    );
  return (
    <span className="ce-scelta" role="group" aria-label={`Come hai ${nome}?`}>
      <button type="button" className="btn-filo pieno" disabled={invio} onClick={() => aggiungi("full")}>
        Boccetta
      </button>
      <button type="button" className="btn-filo" disabled={invio} onClick={() => aggiungi("campione")}>
        Campione
      </button>
    </span>
  );
}
