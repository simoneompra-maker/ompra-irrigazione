import { useEffect, useRef, useState } from 'react'
import { clientiApi } from '../lib/api'
import { Input } from './common/FormField'
import Spinner from './common/Spinner'

/**
 * Campo con autocomplete sulla tabella `clienti` condivisa. Se il cliente
 * selezionato viene passato dall'esterno (deep link), mostra direttamente
 * il suo nome senza richiedere una nuova ricerca.
 */
export default function ClienteAutocomplete({ clienteSelezionato, onSeleziona, onNuovoCliente }) {
  const [query, setQuery] = useState('')
  const [risultati, setRisultati] = useState([])
  const [caricamento, setCaricamento] = useState(false)
  const [aperto, setAperto] = useState(false)
  const timerRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function onClickFuori(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setAperto(false)
    }
    document.addEventListener('mousedown', onClickFuori)
    return () => document.removeEventListener('mousedown', onClickFuori)
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!query || query.trim().length < 2) {
      setRisultati([])
      return
    }
    timerRef.current = setTimeout(async () => {
      setCaricamento(true)
      try {
        const res = await clientiApi.cerca(query)
        setRisultati(res)
      } catch {
        setRisultati([])
      } finally {
        setCaricamento(false)
      }
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [query])

  if (clienteSelezionato) {
    return (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Cliente <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center justify-between rounded-xl border border-brand-300 bg-brand-50 px-4 py-2.5">
          <div>
            <p className="font-semibold text-gray-900">{clienteSelezionato.nome_completo}</p>
            {clienteSelezionato.localita || clienteSelezionato.indirizzo ? (
              <p className="text-sm text-gray-500">
                {[clienteSelezionato.indirizzo, clienteSelezionato.localita].filter(Boolean).join(', ')}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn text-sm font-semibold text-brand-700 underline"
            onClick={() => onSeleziona(null)}
          >
            Cambia
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        label="Cliente"
        required
        placeholder="Cerca per nome o cognome…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setAperto(true)
        }}
        onFocus={() => setAperto(true)}
      />
      {aperto && (query.trim().length >= 2) ? (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {caricamento ? (
            <div className="px-4 py-3">
              <Spinner size={18} label="Ricerca…" />
            </div>
          ) : risultati.length > 0 ? (
            risultati.map((c) => (
              <button
                key={c.id}
                type="button"
                className="btn w-full text-left px-4 py-2.5 hover:bg-brand-50 border-b border-gray-50 last:border-0"
                onClick={() => {
                  onSeleziona(c)
                  setAperto(false)
                  setQuery('')
                }}
              >
                <p className="font-semibold text-gray-900">{c.nome_completo}</p>
                {c.localita || c.indirizzo ? (
                  <p className="text-xs text-gray-500">{[c.indirizzo, c.localita].filter(Boolean).join(', ')}</p>
                ) : null}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500">Nessun cliente trovato.</div>
          )}
          <button
            type="button"
            className="btn w-full text-left px-4 py-3 text-brand-700 font-semibold hover:bg-brand-50 border-t border-gray-100"
            onClick={() => {
              setAperto(false)
              onNuovoCliente()
            }}
          >
            + Nuovo cliente
          </button>
        </div>
      ) : null}
    </div>
  )
}
