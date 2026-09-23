import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

let contatore = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const showToast = useCallback(
    (message, type = 'info', durata = 3500) => {
      const id = ++contatore
      setToasts((t) => [...t, { id, message, type }])
      timers.current[id] = setTimeout(() => remove(id), durata)
      return id
    },
    [remove]
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[92%] max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl px-4 py-3 shadow-lg text-sm font-medium flex items-start gap-2 ${
              t.type === 'error'
                ? 'bg-red-600 text-white'
                : t.type === 'success'
                  ? 'bg-brand-800 text-white'
                  : 'bg-gray-800 text-white'
            }`}
            onClick={() => remove(t.id)}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve essere usato dentro <ToastProvider>')
  return ctx
}
