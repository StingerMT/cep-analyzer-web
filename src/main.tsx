import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Global error handler – shows crash reason on screen instead of white page
window.onerror = (msg, src, line, col, err) => {
  document.body.innerHTML = `
    <div style="background:#1e1f22;color:#ed4245;padding:24px;font-family:monospace;white-space:pre-wrap;font-size:13px">
      <b>Runtime Error</b>\n\n${msg}\n\n${src}:${line}:${col}\n\n${err?.stack ?? ''}
    </div>`
  return false
}

window.addEventListener('unhandledrejection', (e) => {
  document.body.innerHTML = `
    <div style="background:#1e1f22;color:#ed4245;padding:24px;font-family:monospace;white-space:pre-wrap;font-size:13px">
      <b>Unhandled Promise Rejection</b>\n\n${e.reason}
    </div>`
})

import App from './App.tsx'

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
)
