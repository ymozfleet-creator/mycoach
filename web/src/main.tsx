import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AppProvider } from './lib/store'
import { registerSW } from 'virtual:pwa-register'

// 新しい版を公開したら、開いている画面も自動で最新に切り替える
registerSW({ immediate: true, onRegisteredSW(_url, r) { if (r) setInterval(() => r.update(), 30 * 60e3) } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider><App /></AppProvider>
  </StrictMode>,
)
