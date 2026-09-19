import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SocialProvider } from './social/SocialContext'
import { AuthProvider } from './supabase/AuthContext'
import { AppStateProvider } from './state/AppStateContext'
import { RoadSyncProvider } from './state/RoadSyncContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppStateProvider>
        {/* Вход стоит внутри состояния и снаружи людей: он читает своё же имя и ник, а список
            друзей после выхода забывает — и забывать его должен тот, кто про выход знает. */}
        <AuthProvider>
          {/* Дорога с аккаунтом сводится внутри входа: без вошедшего человека синхронизировать
              нечего и не с кем. Сама дорога остаётся снаружи и выше — она живёт без сервера. */}
          <RoadSyncProvider>
            <SocialProvider>
              <App />
            </SocialProvider>
          </RoadSyncProvider>
        </AuthProvider>
      </AppStateProvider>
    </BrowserRouter>
  </StrictMode>,
)
