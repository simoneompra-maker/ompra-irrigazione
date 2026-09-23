import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/common/Spinner'
import EmptyState from '../components/common/EmptyState'
import { PallinoQualita } from '../components/common/QualityBadge'
import { giardiniApi, lettureApi } from '../lib/api'
import { calcolaStatistiche } from '../utils/uniformity'
import { supabase } from '../lib/supabaseClient'

export default function GiardiniListPage() {
  const { logout } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [giardini, setGiardini] = useState(null)
  const [uniformita, setUniformita] = useState({}) // giardinoId -> duLq | null
  const [query, setQuery] = useState('')
  const [errore, setErrore] = useState('')

  // Deep link dall'app Sopralluogo:
  // ?giardino=<uuid> apre direttamente la scheda giardino
  // ?sopralluogo=<uuid>&cliente=<uuid> precompila il form "nuovo giardino"
  useEffect(() => {
    const giardinoId = searchParams.get('giardino')
    if (giardinoId) {
      navigate(`/giardini/${giardinoId}`, { replace: true })
      return
    }
    const sopralluogoId = searchParams.get('sopralluogo')
    const clienteId = searchParams.get('cliente')
    if (sopralluogoId || clienteId) {
      navigate(`/giardini/nuovo?${searchParams.toString()}`, { replace: true })
    }
  }, [searchParams, navigate])

  useEffect(() => {
    let attivo = true
    async function carica() {
      try {
        const lista = await giardiniApi.lista()
        if (!attivo) return
        setGiardini(lista)

        // calcola in parallelo l'uniformità dell'ultima sessione per ciascun giardino
        const risultati = await Promise.all(
          lista.map(async (g) => {
            try {
              const { data } = await supabase
                .from('irrigazione_sessioni')
                .select('id')
                .eq('giardino_id', g.id)
                .order('data', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
              if (!data) return [g.id, null]
              const letture = await lettureApi.listaPerSessione(data.id)
              const stats = calcolaStatistiche(letture.map((l) => l.valore_mm))
              return [g.id, stats ? stats.duLq : null]
            } catch {
              return [g.id, null]
            }
          })
        )
        if (!attivo) return
        setUniformita(Object.fromEntries(risultati))
      } catch (err) {
        setErrore(err.message || 'Errore nel caricamento dei giardini')
      }
    }
    carica()
    return () => {
      attivo = false
    }
  }, [])

  const filtrati = useMemo(() => {
    if (!giardini) return []
    const q = query.trim().toLowerCase()
    if (!q) return giardini
    return giardini.filter((g) => {
      const cliente = g.clienti?.nome_completo?.toLowerCase() || ''
      const luogo = g.luogo?.toLowerCase() || ''
      return cliente.includes(q) || luogo.includes(q)
    })
  }, [giardini, query])

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <TopBar
        title="Giardini"
        actions={
          <div className="flex items-center gap-1.5">
            <Link
              to="/impostazioni"
              className="btn w-10 h-10 flex items-center justify-center rounded-full hover:bg-brand-700 text-lg"
              aria-label="Impostazioni"
              title="Impostazioni"
            >
              ⚙️
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="btn text-xs font-semibold bg-brand-700 hover:bg-brand-600 px-3 py-2 rounded-lg shrink-0"
            >
              Esci
            </button>
          </div>
        }
      />

      <div className="max-w-3xl mx-auto px-4 pt-4">
        <div className="flex gap-2 mb-4">
          <input
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Cerca per cliente o luogo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Link
          to="/giardini/nuovo"
          className="btn w-full mb-4 flex items-center justify-center gap-2 bg-brand-700 text-white font-bold py-3.5 rounded-2xl shadow-md hover:bg-brand-800 text-base"
        >
          <span className="text-xl leading-none">+</span> Nuovo giardino
        </Link>

        {errore ? <p className="text-red-600 text-sm mb-3">{errore}</p> : null}

        {giardini === null ? (
          <div className="flex justify-center py-16">
            <Spinner size={28} label="Caricamento giardini…" />
          </div>
        ) : filtrati.length === 0 ? (
          <EmptyState
            icon="🌿"
            title={giardini.length === 0 ? 'Nessun giardino ancora' : 'Nessun risultato'}
            description={
              giardini.length === 0
                ? 'Crea il primo giardino per iniziare a registrare i test di irrigazione.'
                : 'Prova con un altro nome cliente o luogo.'
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {filtrati.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/giardini/${g.id}`}
                  className="btn w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-100 hover:border-brand-300 hover:shadow-md transition-all text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                    {g.mappa_immagine_url ? (
                      <img src={g.mappa_immagine_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      '🌿'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{g.clienti?.nome_completo || 'Cliente sconosciuto'}</p>
                    <p className="text-sm text-gray-500 truncate">{g.luogo || 'Luogo non specificato'}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {uniformita[g.id] !== undefined ? (
                      uniformita[g.id] != null ? (
                        <PallinoQualita duLq={uniformita[g.id]} />
                      ) : (
                        <span className="text-[10px] text-gray-300">nessun test</span>
                      )
                    ) : (
                      <span className="w-3 h-3 rounded-full bg-gray-200 animate-pulse" />
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
