import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { getLang, useLang } from './i18n'
import { seedState } from './seed'
import { setSeeder } from './store'

setSeeder(seedState)
document.documentElement.lang = getLang()

/** Remount the app when the language changes so every string and number is re-rendered. */
function Root() {
  const lang = useLang()
  return <App key={lang} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>,
)
