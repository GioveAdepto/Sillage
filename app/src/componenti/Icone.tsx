/* Le icone dell'anteprima D: tratti sottili, colore dal testo intorno. */
type P = { className?: string };
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "aria-hidden": true } as const;

export const IconaCollezione = (p: P) => (
  <svg {...base} strokeWidth={1.4} {...p}>
    <path d="M10 3h4v3h-4zM8.5 6h7L17 9v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9z" />
    <path d="M9.5 13h5" />
  </svg>
);
export const IconaGoccia = (p: P) => (
  <svg {...base} strokeWidth={1.4} {...p}>
    <path d="M12 3.5c3.2 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.3-6 5.5-10z" />
  </svg>
);
export const IconaDiario = (p: P) => (
  <svg {...base} strokeWidth={1.4} {...p}>
    <path d="M12 6.5C10 5 7 4.6 4 5v13.5c3-.4 6 0 8 1.5 2-1.5 5-1.9 8-1.5V5c-3-.4-6 0-8 1.5zm0 0V20" />
  </svg>
);
export const IconaNumeri = (p: P) => (
  <svg {...base} strokeWidth={1.4} {...p}>
    <path d="M4 20h16M7.5 17v-5M12 17V6M16.5 17v-8" />
  </svg>
);
export const IconaAltro = (p: P) => (
  <svg {...base} strokeWidth={1.4} {...p}>
    <circle cx="5.5" cy="12" r="1.2" />
    <circle cx="12" cy="12" r="1.2" />
    <circle cx="18.5" cy="12" r="1.2" />
  </svg>
);
export const IconaCerca = (p: P) => (
  <svg {...base} strokeWidth={1.5} {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5 5" />
  </svg>
);
export const IconaIndietro = (p: P) => (
  <svg {...base} strokeWidth={1.5} {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </svg>
);
export const IconaAvanti = (p: P) => (
  <svg {...base} strokeWidth={1.5} {...p}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </svg>
);
export const IconaSi = (p: P) => (
  <svg {...base} strokeWidth={1.6} {...p}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);
export const IconaNo = (p: P) => (
  <svg {...base} strokeWidth={1.6} {...p}>
    <path d="M7 12h10" />
  </svg>
);
export const IconaMezzo = (p: P) => (
  <svg {...base} strokeWidth={1.6} {...p}>
    <path d="M5 12.5l4.2 4.2L19 7" strokeDasharray="2.5 2.5" />
  </svg>
);
export const IconaFuori = (p: P) => (
  <svg {...base} strokeWidth={1.5} {...p}>
    <path d="M10 5H5v14h14v-5M14 4h6v6M20 4l-9 9" />
  </svg>
);
export const IconaX = (p: P) => (
  <svg {...base} strokeWidth={1.5} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
