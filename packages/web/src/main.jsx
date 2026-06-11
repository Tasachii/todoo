import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: 1 },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)

// No service worker inside the native app: Capacitor serves assets from the
// app bundle (custom scheme), so there is nothing to cache and SW registration
// can fail on capacitor://.
if (
  'serviceWorker' in navigator &&
  import.meta.env.PROD &&
  !window.Capacitor?.isNativePlatform?.()
) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  )
}
