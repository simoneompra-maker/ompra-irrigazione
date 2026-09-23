import { useEffect, useState } from 'react'
import TopBar from '../components/TopBar'
import Spinner from '../components/common/Spinner'
import Button from '../components/common/Button'
import { fabbisognoApi } from '../lib/api'
import { NOMI_MESI } from '../utils/irrigationSchedule'
import { useToast } from '../contexts/ToastContext'

export default function ImpostazioniPage() {
  const { showToast } = useToast()
  const [righe, setRighe] = useState(null)
  const [salvataggio, setSalvataggio] = useState({})

  useEffect(() => {
    fabbisognoApi
      .lista()
      .then(setRighe)
      .catch((err) => showToast(err.message || 'Errore nel caricamento', 'error'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function setValore(mese, valore) {
    setRighe((prev) => prev.map((r) => (r.mese === mese ? { ...r, mm_giorno: valore } : r)))
  }

  async function salva(mese) {
    const riga = righe.find((r) => r.mese === mese)
    const valore = Number(String(riga.mm_giorno).replace(',', '.'))
    if (Number.isNaN(valore) || valore < 0) {
      showToast('Valore non valido', 'error')
      return
    }
    setSalvataggio((s) => ({ ...s, [mese]: true }))
    try {
      await fabbisognoApi.aggiorna(mese, valore)
      showToast(`${NOMI_MESI[mese]} aggiornato`, 'success')
    } catch (err) {
      showToast(err.message || 'Errore nel salvataggio', 'error')
    } finally {
      setSalvataggio((s) => ({ ...s, [mese]: false }))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <TopBar title="Impostazioni" backTo="/" />

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="font-bold text-gray-900 mb-1">Fabbisogno idrico mensile</h2>
          <p className="text-sm text-gray-500 mb-4">
            Millimetri di acqua al giorno necessari nel periodo Aprile–Ottobre. Usati per calcolare la
            programmazione consigliata della centralina nel riepilogo sessione.
          </p>

          {righe === null ? (
            <div className="flex justify-center py-8">
              <Spinner label="Caricamento…" />
            </div>
          ) : (
            <div className="space-y-2">
              {righe.map((r) => (
                <div key={r.mese} className="flex items-center gap-2">
                  <span className="w-24 text-sm font-medium text-gray-700 shrink-0">{NOMI_MESI[r.mese]}</span>
                  <input
                    inputMode="decimal"
                    value={r.mm_giorno}
                    onChange={(e) => setValore(r.mese, e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="text-xs text-gray-400 shrink-0">mm/g</span>
                  <Button size="sm" onClick={() => salva(r.mese)} disabled={salvataggio[r.mese]}>
                    Salva
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
