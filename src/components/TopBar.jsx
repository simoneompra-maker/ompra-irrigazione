import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function TopBar({ title, backTo, actions }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-30 bg-brand-800 text-white shadow-md">
      <div className="flex items-center gap-2 px-3 py-3 max-w-3xl mx-auto">
        {backTo !== undefined ? (
          <button
            type="button"
            className="btn shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-brand-700 text-xl"
            onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
            aria-label="Indietro"
          >
            ←
          </button>
        ) : (
          <span className="text-2xl">💧</span>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-base truncate">{title}</h1>
        </div>
        {actions}
        {!actions ? (
          <button
            type="button"
            onClick={async () => {
              await logout()
            }}
            className="btn text-xs font-semibold bg-brand-700 hover:bg-brand-600 px-3 py-2 rounded-lg shrink-0"
            title={user?.email}
          >
            Esci
          </button>
        ) : null}
      </div>
    </header>
  )
}
