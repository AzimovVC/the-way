import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SocialProvider } from './social/SocialContext'
import { AuthProvider } from './supabase/AuthContext'
import { AppStateProvider } from './state/AppStateContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppStateProvider>
        {/* Вход стоит внутри состояния и снаружи людей: он читает своё же имя и ник, а список
            друзей после выхода забывает — и забывать его должен тот, кто про выход знает. */}
        <AuthProvider>
          <SocialProvider>
            <App />
          </SocialProvider>
        </AuthProvider>
      </AppStateProvider>
    </BrowserRouter>
  </StrictMode>,
)
