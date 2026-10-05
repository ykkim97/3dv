import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'pretendard/dist/web/variable/pretendardvariable.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import './shared/styles/index.css'
import App from './app/App.jsx'
import initTooltipManager from './shared/tooltip/tooltipManager';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// initialize global tooltip replacement (replaces native title tooltips)
initTooltipManager();
