import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './landing/landing.css'
import Landing from './landing/Landing'

createRoot(document.getElementById('landing-root')!).render(<StrictMode><Landing /></StrictMode>)
