import { useEffect, useState } from 'react'

/**
 * Persistenza locale (browser) per dati puramente annotativi/facoltativi che
 * non hanno una tabella dedicata sul backend (es. layer "irrigatori").
 */
export function useLocalStorage(chiave, valoreIniziale) {
  const [valore, setValore] = useState(() => {
    try {
      const salvato = window.localStorage.getItem(chiave)
      return salvato ? JSON.parse(salvato) : valoreIniziale
    } catch {
      return valoreIniziale
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(chiave, JSON.stringify(valore))
    } catch {
      // storage pieno o non disponibile: la funzione resta puramente annotativa
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave, valore])

  return [valore, setValore]
}
