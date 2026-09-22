import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// Из 'vitest/config', а не из 'vite': тот же defineConfig плюс типы блока test ниже.
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'The Way',
        short_name: 'The Way',
        description: 'Путь-трекер привычек: один путь к своей цели.',
        theme_color: '#14141a',
        background_color: '#14141a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Everything the app needs is already in localStorage — the service
        // worker only needs to cache the built app shell for offline use.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  build: {
    /**
     * Порог предупреждения о размере куска.
     *
     * Умолчание — 500 кБ, и оно меряет **минифицированный** размер, до сжатия; человеку же уезжает
     * gzip, а это другое число. У нас первый кусок — 595 кБ, то есть 173 кБ в gzip, и состоит он
     * из трёх вещей, каждая на критическом пути:
     *
     * - **React с роутером** — без них нет ни кадра;
     * - **`@supabase/supabase-js`, 215 кБ** — самая тяжёлая внешняя вещь, и вынести её нельзя:
     *   дверь стоит **перед** приложением (решение 7 в docs/circle.md), `AuthGate` спрашивает
     *   сессию в первый кадр. Отдельным куском она осталась бы на том же пути, только двумя
     *   запросами вместо одного;
     * - **дорога** — движок пути, карточка дня и экраны итогов. То, ради чего приложение открывают.
     *
     * Всё, что можно было увести, уже уведено: вкладки приезжают своими кусками (`lazy` в App.tsx),
     * и это сняло 47 кБ gzip с первого открытия. DevPanel в сборку не попадает вовсе — проверено
     * поиском по бандлу, а не предположением.
     *
     * Поэтому 700, а не «побольше, чтобы не мешало»: запас над сегодняшним числом невелик нарочно.
     * Предупреждение, поднятое до недостижимого, перестаёт быть предупреждением, а это — единственное
     * место, где рост веса вообще кем-то замечается.
     */
    chunkSizeWarningLimit: 700,
  },
  test: {
    // Доказательства геометрии пути перебирают год дороги парами — O(n²), ~0.7 с на самый тяжёлый
    // случай, когда он идёт один. Но каждый тестовый файл поднимает свой воркер, и на загруженной
    // машине те же 0.7 с растягиваются за пять секунд: тест падает по таймауту, сообщая о нагрузке,
    // а не о геометрии. Из-за этого добавление любого нового тестового файла выглядит как поломка
    // пути. Запас взят с перебором — таймаут здесь ловит зависший тест, а не медленный.
    testTimeout: 30_000,
  },
})
