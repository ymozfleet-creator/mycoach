import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AppProvider } from './lib/store'
import { registerSW } from 'virtual:pwa-register'

// 新しい版を公開したら、開いている画面も自動で最新に切り替える

// 更新直後に古い画面部品を読み込めなかった場合は、一度だけ自動で再読み込みする
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('mcmt_reloaded')) return
  sessionStorage.setItem('mcmt_reloaded', '1'); location.reload()
})
window.addEventListener('load', () => setTimeout(() => sessionStorage.removeItem('mcmt_reloaded'), 10000))

registerSW({ immediate: true, onRegisteredSW(_url, r) { if (r) setInterval(() => r.update(), 30 * 60e3) } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider><App /></AppProvider>
  </StrictMode>,
)
