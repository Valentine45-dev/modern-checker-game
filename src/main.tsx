import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Outermost net. App has a second boundary around the game itself, so a
        crash mid-game can be escaped without losing the menu too. */}
    <ErrorBoundary resetLabel="Reload the app" onReset={() => window.location.reload()}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

