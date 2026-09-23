import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'

import LoginPage from './pages/LoginPage'
import GiardiniListPage from './pages/GiardiniListPage'
import NuovoGiardinoPage from './pages/NuovoGiardinoPage'
import GiardinoPage from './pages/GiardinoPage'
import NuovaSessionePage from './pages/NuovaSessionePage'
import RiepilogoSessionePage from './pages/RiepilogoSessionePage'
import StoricoGiardinoPage from './pages/StoricoGiardinoPage'
import ImpostazioniPage from './pages/ImpostazioniPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <GiardiniListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/giardini/nuovo"
              element={
                <ProtectedRoute>
                  <NuovoGiardinoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/giardini/:id"
              element={
                <ProtectedRoute>
                  <GiardinoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/giardini/:id/sessioni/nuova"
              element={
                <ProtectedRoute>
                  <NuovaSessionePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/giardini/:id/storico"
              element={
                <ProtectedRoute>
                  <StoricoGiardinoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sessioni/:id"
              element={
                <ProtectedRoute>
                  <RiepilogoSessionePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/impostazioni"
              element={
                <ProtectedRoute>
                  <ImpostazioniPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<LoginPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
