import { useState } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Input } from '../components/common/FormField'
import Button from '../components/common/Button'

export default function LoginPage() {
  const { session, loading, login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')
  const [invio, setInvio] = useState(false)

  if (!loading && session) {
    const redirect = searchParams.get('redirect') || '/'
    return <Navigate to={redirect} replace />
  }

  async function onSubmit(e) {
    e.preventDefault()
    setErrore('')
    setInvio(true)
    try {
      await login(email.trim(), password)
      const redirect = searchParams.get('redirect') || '/'
      navigate(redirect, { replace: true })
    } catch (err) {
      setErrore(
        err?.message?.includes('Invalid login')
          ? 'Email o password non corrette.'
          : err?.message || 'Errore di accesso, riprova.'
      )
    } finally {
      setInvio(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-800 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">💧</div>
          <h1 className="text-2xl font-bold text-white">Test Irrigazione</h1>
          <p className="text-brand-200 mt-1 text-sm">OMPRA · Uniformità catch-cup test</p>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@esempio.it"
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          {errore ? <p className="text-sm text-red-600 font-medium">{errore}</p> : null}
          <Button type="submit" full size="lg" disabled={invio}>
            {invio ? 'Accesso in corso…' : 'Accedi'}
          </Button>
        </form>
        <p className="text-center text-brand-200 text-xs mt-6">
          Accesso riservato agli operatori OMPRA
        </p>
      </div>
    </div>
  )
}
