/* Un modello FINTO al posto dell'API di Anthropic, per provare la lettura della cartolina sul ponte locale
   (porta 8897): nessuna chiamata vera, nessun costo. Controlla la richiesta come la farebbe l'API (chiave, versione,
   modello, immagine, schema) e risponde con scritte fisse nel formato del modello.

   Si lancia dalla cartella app/:   node strumenti/modello-finto.mjs
   poi il ponte locale con  --var ANTHROPIC_API_KEY:finta --var ANTHROPIC_URL:http://127.0.0.1:8897/v1/messages */
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

export const richieste = [];
export const RISPOSTE = {
  cartolina: { nome: "Profumo di Prova", marchio: "Casa Finta", genere: "unisex", voto: 4.1, voti: 1234, durata_ore: 7, scia: "Forte",
    accordi: ["Legnoso", "Aromatico", "Terroso", "Muschiato", "Speziato Fresco"], note: ["Vetiver", "Cipresso"] },
  piramide: { testa: ["Cipresso"], cuore: ["Vetiver"], fondo: ["Legno di Cashmere", "Muschio"], senza_livello: [] }
};

export function avvia(porta = 8897) {
  const server = createServer(async (req, res) => {
    let corpo = "";
    for await (const pezzo of req) corpo += pezzo;
    const r = (stato, o) => { res.writeHead(stato, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    let b;
    try { b = JSON.parse(corpo); } catch { return r(400, { type: "error", error: { type: "invalid_request_error", message: "JSON non valido" } }); }
    const img = b.messages?.[0]?.content?.find((c) => c.type === "image");
    const schema = b.output_config?.format?.schema;
    richieste.push({ chiave: req.headers["x-api-key"], versione: req.headers["anthropic-version"], modello: b.model, img: !!img?.source?.data, schema: !!schema });
    if (req.headers["x-api-key"] !== "finta") return r(401, { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } });
    if (!img || !schema || b.model !== "claude-haiku-5-5") return r(400, { type: "error", error: { type: "invalid_request_error", message: "richiesta incompleta" } });
    const tipo = schema.required.includes("testa") ? "piramide" : "cartolina";
    r(200, { id: "msg_finto", type: "message", role: "assistant", model: b.model, stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(RISPOSTE[tipo]) }], usage: { input_tokens: 1600, output_tokens: 80 } });
  });
  return new Promise((ok) => server.listen(porta, "127.0.0.1", () => ok({ chiudi: () => new Promise((f) => server.close(f)) })));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await avvia();
  console.log("modello finto su http://127.0.0.1:8897/v1/messages");
}
