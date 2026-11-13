import type { Profumo } from "../tipi";
import { profiloAccordi } from "../consiglio";
import { RAGGI_RUOTA } from "../viste/calcoli";

/* La ruota degli accordi (ruotaAccordi in js/collezione.js): sette famiglie, quanto pesa ciascuna negli accordi
   di un profumo (pesati per forza). Con più profumi le aree si sovrappongono, una per colore. */
export const COLORI_SERIE = ["var(--ottone-pieno)", "var(--acqua)", "var(--ambra)"];
const TINTA: Record<string, string> = {
  acqua: "var(--acqua)", agrume: "var(--ottone)", bosco: "var(--bosco)", spezia: "var(--ambra)",
  fumo: "var(--cenere)", dolce: "var(--ottone-pieno)", cipria: "var(--seppia)"
};

export default function Ruota({ lista }: { lista: Profumo[] }) {
  const W = 360, H = 300, cx = W / 2, cy = H / 2 + 2, R = 86, n = RAGGI_RUOTA.length, uno = lista.length === 1;
  const profili = lista.map(profiloAccordi);
  // la scala si adatta al valore più alto, arrotondato al 10%: il bordo della ruota è quel valore
  const max = Math.max(0.3, Math.ceil(Math.max(...profili.flatMap((q) => Object.values(q))) * 10) / 10);
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) => [cx + (Math.cos(ang(i)) * R * v) / max, cy + (Math.sin(ang(i)) * R * v) / max];
  const f1 = (x: number) => x.toFixed(1);
  const anelli: number[] = [];
  for (let v = 0.1; v <= max + 1e-9; v += 0.1) anelli.push(v);
  const etichetta =
    "Ruota degli accordi" +
    (uno ? "" : " a confronto") +
    ": " +
    lista.map((p, j) => p.name + " " + RAGGI_RUOTA.filter(([k]) => profili[j][k]).map(([k, l]) => l + " " + Math.round(profili[j][k] * 100) + "%").join(", ")).join("; ");
  return (
    <svg className="ruota" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={etichetta}>
      {anelli.map((v) => (
        <polygon key={v} className="ruota-anello" points={RAGGI_RUOTA.map((_, i) => pt(i, v).map(f1).join(",")).join(" ")} />
      ))}
      {RAGGI_RUOTA.map((_, i) => {
        const [x, y] = pt(i, max);
        return <line key={i} className="ruota-raggio" x1={cx} y1={cy} x2={f1(x)} y2={f1(y)} />;
      })}
      {profili.map((q, j) => (
        <polygon
          key={j}
          className="ruota-area"
          points={RAGGI_RUOTA.map(([k], i) => pt(i, q[k]).map(f1).join(",")).join(" ")}
          style={{ fill: COLORI_SERIE[j % 3], stroke: COLORI_SERIE[j % 3] }}
        />
      ))}
      {profili.map((q, j) =>
        RAGGI_RUOTA.map(([k, l], i) => {
          if (!q[k]) return null;
          const [x, y] = pt(i, q[k]);
          return (
            <circle key={j + k} cx={f1(x)} cy={f1(y)} r="3.5" style={{ fill: COLORI_SERIE[j % 3] }}>
              <title>
                {lista[j].name} · {l}: {Math.round(q[k] * 100)}%
              </title>
            </circle>
          );
        })
      )}
      {RAGGI_RUOTA.map(([k, l], i) => {
        const [x, y] = pt(i, max * 1.18),
          c = Math.cos(ang(i)),
          sn = Math.sin(ang(i));
        const anc = Math.abs(c) < 0.25 ? "middle" : c > 0 ? "start" : "end";
        const righe = l.split(" e ");
        righe[1] = "e " + righe[1];
        const v = uno ? Math.round(profili[0][k] * 100) : null;
        const tot = righe.length + (uno ? 1 : 0),
          y0 = y - (sn < -0.5 ? (tot - 1) * 12 : sn > 0.5 ? 0 : (tot - 1) * 6) + 4;
        return (
          <g key={k} className="ruota-eti">
            <text x={f1(x)} y={f1(y0)} textAnchor={anc}>
              {righe.map((r, ri) => (
                <tspan key={ri} x={f1(x)} dy={ri ? 12 : 0} className={ri ? "sotto" : undefined}>
                  {r}
                </tspan>
              ))}
              {uno ? (
                <tspan x={f1(x)} dy={13} className={v ? "valore" : "zero"}>
                  {v ? v + "%" : "—"}
                </tspan>
              ) : null}
            </text>
            <circle
              cx={f1(anc === "start" ? x - 8 : anc === "end" ? x + 8 : x)}
              cy={f1(anc === "middle" ? (sn < 0 ? y0 - 11 : y0 - 15) : y0 - 4)}
              r="3"
              style={{ fill: TINTA[k] }}
            />
          </g>
        );
      })}
    </svg>
  );
}
