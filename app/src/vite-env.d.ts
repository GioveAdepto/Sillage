/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** il ponte da usare al posto di quello pubblicato (prove in locale) */
  readonly VITE_PONTE?: string;
  /** il Supabase degli account al posto di quello di CheMetto (prove in locale, con un Supabase finto) */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_CHIAVE?: string;
}
