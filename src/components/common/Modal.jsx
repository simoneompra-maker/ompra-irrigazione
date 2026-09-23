import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const maxW = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }[size] || 'max-w-md'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative bg-white w-full ${maxW} sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] flex flex-col`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title ? (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="btn text-gray-400 hover:text-gray-700 text-2xl leading-none px-2"
              aria-label="Chiudi"
            >
              ×
            </button>
          </div>
        ) : null}
        <div className="px-5 py-4 overflow-y-auto grow">{children}</div>
        {footer ? <div className="px-5 py-4 border-t border-gray-100 shrink-0">{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}
