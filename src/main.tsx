import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { SocialProvider } from './social/SocialContext'
import { AppStateProvider } from './state/AppStateContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppStateProvider>
        <SocialProvider>
          <App />
        </SocialProvider>
      </AppStateProvider>
    </BrowserRouter>
  </StrictMode>,
)
