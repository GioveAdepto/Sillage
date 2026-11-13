/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** il ponte da usare al posto di quello pubblicato (prove in locale) */
  readonly VITE_PONTE?: string;
}
