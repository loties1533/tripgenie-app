import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useThemeStore, useAuthStore, useSearchStore } from './store'
import Home        from './pages/Home'
import Trips       from './pages/Trips'
import TripDetail  from './pages/TripDetail'
import Login       from './pages/Login'
import Preferences from './pages/Preferences'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 }
  }
})

function ThemeInit() {
  const { init } = useThemeStore()
  useEffect(() => { init() }, [])
  return null
}

function AppCleanup() {
  const { user } = useAuthStore()
  const { clearPack } = useSearchStore()
  useEffect(() => {
    // Si pas connecté au démarrage, on vide le vieux voyage du cache
    if (!user) clearPack()
  }, [])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeInit />
        <AppCleanup />
        <Routes>
          <Route path="/"            element={<Home />} />
          <Route path="/trips"       element={<Trips />} />
          <Route path="/trip/:id"    element={<TripDetail />} />
          <Route path="/login"       element={<Login />} />
          <Route path="/preferences" element={<Preferences />} />
        </Routes>
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            style: {
              fontFamily: '"DM Sans", sans-serif',
              fontSize:   '14px',
            }
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
