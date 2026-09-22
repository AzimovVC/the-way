import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Дверь на сервер. Одна на приложение, и она **может не открыться**: без ключей в `.env.local`
 * здесь честный `null`, а не заглушка и не клиент, который упадёт на первом запросе.
 *
 * Это не защита от чужой ошибки, а рабочее состояние приложения. Дорога лежит в localStorage и
 * остаётся источником правды: без сервера всё, кроме входа
 * и профиля, работает целиком — и должно работать, потому что то же самое состояние бывает у
 * вошедшего человека в метро.
 *
 * `anon public` уезжает в бандл и читается кем угодно; данные защищают политики RLS
 * (supabase/migrations), а не тайна ключа.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

export const supabase: SupabaseClient | null =
  url.length > 0 && anonKey.length > 0
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Google возвращает человека **на адрес**, и сессию из этого адреса кто-то должен
          // достать. Раньше здесь стояло `false` — входили только кодом из письма, и разбирать было
          // нечего.
          detectSessionInUrl: true,
          // И поэтому же `pkce`, а не подразумеваемый `implicit`: implicit возвращает токены в
          // `#access_token=…`, то есть в том самом хвосте адреса, где живут якоря. PKCE приносит
          // `?code=…` — обычный параметр запроса, который роутеру не принадлежит и в чужой маршрут
          // не превращается. Секрет при этом не лежит в адресной строке и не попадает в историю
          // браузера, а обменивается на сессию отдельным запросом.
          flowType: 'pkce',
        },
      })
    : null

/** Настроен ли сервер. Экранам это нужно словами, а не через сравнение клиента с `null`. */
export const isSupabaseConfigured = supabase !== null
