import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/geist/index.css'
import App from './App.js'
import './index.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element is missing')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
)
