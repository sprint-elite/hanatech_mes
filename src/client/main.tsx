import { createRoot } from 'react-dom/client'
import { initTheme } from './lib/theme'
import { App } from './ui/App'
import './styles.css'

initTheme()

createRoot(document.getElementById('root')!).render(<App />)

