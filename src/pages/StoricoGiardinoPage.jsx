import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import Spinner from '../components/common/Spinner'
import EmptyState from '../components/common/EmptyState'
import QualityBadge from '../components/common/QualityBadge'
import StoricoChart from '../components/StoricoChart'
import { giardiniApi, sessioniApi, lettureApi } from '../lib/api'
import { calcolaStatistiche } from '../utils/uniformity'
import { formattaData } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

export default function StoricoGiardinoPage() {
  const { id } = useParams()
  const { showToast } = useToast()

  const [giardino, setGiardino] = useState(null)
  const [righe, setRighe] = useState(null) // [{sessione, statistiche}]
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    let attivo = true
    async function carica() {
      setCaricamento(true)
      try {
        const [g, sessioni] = await Promise.all([giardiniApi.ottieni(id), sessioniApi.lista(id)])
        if (!attivo) return
        setGiardino(g)

        const conStatistiche = await Promise.all(
          sessioni.map(async (s) => {
            const letture = await lettureApi.listaPerSessione(s.id)
            return { sessione: s, statistiche: calcolaStatistiche(letture.map((l) => l.valore_mm)) }
          })
        )
        if (attivo) setRighe(conStatistiche)
      } catch (err) {
        showToast(err.message || 'Errore nel caricamento dello storico', 'error')
      } finally {
        if (attivo) setCaricamento(false)
      }
    }
    carica()
    return () => {
      attivo = false
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function eliminaSessione(sessione) {
    if (!window.confirm(`Eliminare la sessione del ${formattaData(sessione.data)}? Verranno cancellate anche tutte le letture registrate in quella sessione. L'operazione non è reversibile.`)) return
    try {
      await sessioniApi.elimina(sessione.id)
      setRighe((prev) => prev.filter((r) => r.sessione.id !== sessione.id))
      showToast('Sessione eliminata', 'success')
    } catch (err) {
      showToast(err.message || "Errore nell'eliminazione della sessione", 'error')
    }
  }

  const puntiGrafico = useMemo(() => {
    if (!righe) return []
    return [...righe]
      .filter((r) => r.statistiche)
      .sort((a, b) => new Date(a.sessione.data) - new Date(b.sessione.data))
      .map((r) => ({ data: r.sessione.data, duLq: r.statistiche.duLq }))
  }, [righe])

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <TopBar title="Storico giardino" backTo={`/giardini/${id}`} />

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        {giardino ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="font-bold text-gray-900">{giardino.clienti?.nome_completo}</p>
            <p className="text-sm text-gray-500">{giardino.luogo}</p>
          </div>
        ) : null}

        {caricamento ? (
          <div className="flex justify-center py-16">
            <Spinner size={28} label="Caricamento storico…" />
          </div>
        ) : puntiGrafico.length === 0 ? (
          <EmptyState icon="📈" title="Nessuna sessione registrata" description="Avvia una nuova sessione di lettura per iniziare a costruire lo storico." />
        ) : (
          <>
            {puntiGrafico.length > 1 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <h2 className="font-bold text-gray-900 mb-1">Andamento DU (quarto inferiore) nel tempo</h2>
                <StoricoChart punti={puntiGrafico} />
                <div className="flex gap-4 text-xs text-gray-400 mt-2">
                  <span>🟩 ≥80% eccellente</span>
                  <span>🟨 70-79% buono</span>
                  <span>🟥 &lt;70% da migliorare</span>
                </div>
              </div>
            ) : null}

            <div className="space-y-2.5">
              {righe
                .slice()
                .sort((a, b) => new Date(b.sessione.data) - new Date(a.sessione.data))
                .map(({ sessione, statistiche }) => (
                  <div
                    key={sessione.id}
                    className="w-full flex items-center gap-2 bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-100 hover:border-brand-300"
                  >
                    <Link to={`/sessioni/${sessione.id}`} className="btn flex-1 flex items-center justify-between gap-3 text-left">
                      <div>
                        <p className="font-semibold text-gray-900">{formattaData(sessione.data)}</p>
                        <p className="text-sm text-gray-500">
                          {sessione.irrigazione_stazioni
                            ? `${sessione.irrigazione_stazioni.numero ? `#${sessione.irrigazione_stazioni.numero} ` : ''}${sessione.irrigazione_stazioni.nome}`
                            : 'Stazione non specificata'}
                        </p>
                      </div>
                      {statistiche ? <QualityBadge duLq={statistiche.duLq} size="sm" /> : <span className="text-xs text-gray-300">n/d</span>}
                    </Link>
                    <button
                      type="button"
                      className="btn shrink-0 w-9 h-9 rounded-full bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center"
                      onClick={() => eliminaSessione(sessione)}
                      aria-label="Elimina sessione"
                    >
                      🗑
                    </button>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
