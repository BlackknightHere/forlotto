import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { ConfirmProvider } from './components/Confirm.jsx'
import '@fontsource/ibm-plex-sans-thai/400.css'
import '@fontsource/ibm-plex-sans-thai/500.css'
import '@fontsource/ibm-plex-sans-thai/600.css'
import '@fontsource/ibm-plex-sans-thai/700.css'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <ConfirmProvider>
    <App />
  </ConfirmProvider>,
)
