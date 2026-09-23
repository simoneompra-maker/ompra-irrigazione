import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Spinner from './common/Spinner'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50">
        <Spinner size={32} label="Caricamento…" />
      </div>
    )
  }

  if (!session) {
    const parametri = location.search || ''
    return <Navigate to={`/login${parametri ? `?redirect=${encodeURIComponent(location.pathname + parametri)}` : ''}`} replace />
  }

  return children
}
