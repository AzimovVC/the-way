import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Дверь на сервер. Одна на приложение, и она **может не открыться**: без ключей в `.env.local`
 * здесь честный `null`, а не заглушка и не клиент, который упадёт на первом запросе.
 *
 * Это не защита от чужой ошибки, а рабочее состояние приложения. Дорога лежит в localStorage и
 * остаётся источником правды (docs/circle.md, «Дорога в аккаунте»): без сервера всё, кроме входа
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
          // Вход идёт кодом из письма, а не ссылкой, и разбирать адресную строку здесь нечего.
          // Оставленное включённым, это однажды съело бы чужой `#` из маршрута роутера.
          detectSessionInUrl: false,
        },
      })
    : null

/** Настроен ли сервер. Экранам это нужно словами, а не через сравнение клиента с `null`. */
export const isSupabaseConfigured = supabase !== null
