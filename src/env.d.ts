/// <reference types="vite/client" />

/**
 * Ключи Supabase, названные по именам. Через `import.meta.env` читается что угодно и молча отдаёт
 * `undefined`, поэтому опечатка в имени переменной выглядела бы как «сервер не настроен» — ровно
 * тем же состоянием, что и честно пустой `.env.local`.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
