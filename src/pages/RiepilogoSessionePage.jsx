import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import TopBar from '../components/TopBar'
import Spinner from '../components/common/Spinner'
import Button from '../components/common/Button'
import QualityBadge from '../components/common/QualityBadge'
import MapView from '../components/mappa/MapView'
import { Input } from '../components/common/FormField'
import { sessioniApi, lettureApi, fabbisognoApi, clientiApi } from '../lib/api'
import { calcolaStatistiche, coloreHeatmap } from '../utils/uniformity'
import { calcolaProgrammazione, DEFAULT_PERCENTUALE_DEFICIT, DEFAULT_CICLI_SETTIMANA } from '../utils/irrigationSchedule'
import { esportaPdfSessione, esportaPdfRiepilogoVisita } from '../utils/pdfExport'
import { formattaData, numero } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

export default function RiepilogoSessionePage() {
  const { id } = useParams()
  const { showToast } = useToast()

  const [sessione, setSessione] = useState(null)
  const [letture, setLetture] = useState([])
  const [cliente, setCliente] = useState(null)
  const [fabbisogno, setFabbisogno] = useState([])
  const [sessioniStessoGiorno, setSessioniStessoGiorno] = useState([])
  const [caricamento, setCaricamento] = useState(true)

  const [percentualeDeficit, setPercentualeDeficit] = useState(DEFAULT_PERCENTUALE_DEFICIT * 100)
  const [cicliSettimana, setCicliSettimana] = useState(DEFAULT_CICLI_SETTIMANA)

  useEffect(() => {
    let attivo = true
    async function carica() {
      setCaricamento(true)
      try {
        const s = await sessioniApi.ottieni(id)
        if (!attivo) return
        if (!s) {
          setSessione(null)
          return
        }
        setSessione(s)
        const [l, f, c] = await Promise.all([
          lettureApi.listaPerSessione(id),
          fabbisognoApi.lista(),
          s.irrigazione_giardini?.cliente_id ? clientiApi.ottieni(s.irrigazione_giardini.cliente_id) : Promise.resolve(null),
        ])
        if (!attivo) return
        setLetture(l)
        setFabbisogno(f)
        setCliente(c)

        if (s.giardino_id) {
          const altre = await sessioniApi.listaPerData(s.giardino_id, s.data)
          if (attivo) setSessioniStessoGiorno(altre)
        }
      } catch (err) {
        showToast(err.message || 'Errore nel caricamento della sessione', 'error')
      } finally {
        if (attivo) setCaricamento(false)
      }
    }
    carica()
    return () => {
      attivo = false
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const statistiche = useMemo(() => calcolaStatistiche(letture.map((l) => l.valore_mm)), [letture])

  const programmazione = useMemo(() => {
    if (!sessione?.stazione_id || !sessione?.durata_minuti || !statistiche || fabbisogno.length === 0) return null
    return calcolaProgrammazione({
      fabbisogno,
      mediaMm: statistiche.media,
      durataMinuti: sessione.durata_minuti,
      percentualeDeficit: percentualeDeficit / 100,
      cicliSettimana,
    })
  }, [sessione, statistiche, fabbisogno, percentualeDeficit, cicliSettimana])

  const heatPoints = useMemo(() => {
    if (!statistiche) return []
    return letture
      .filter((l) => l.irrigazione_punti?.pos_x != null && l.irrigazione_punti?.pos_y != null)
      .map((l) => ({
        id: l.punto_id,
        x: l.irrigazione_punti.pos_x,
        y: l.irrigazione_punti.pos_y,
        label: l.irrigazione_punti.codice,
        color: coloreHeatmap(l.valore_mm, statistiche.min, statistiche.max),
      }))
  }, [letture, statistiche])

  const righeOrdinate = useMemo(
    () =>
      [...letture]
        .sort((a, b) => (parseInt(a.irrigazione_punti?.codice, 10) || 0) - (parseInt(b.irrigazione_punti?.codice, 10) || 0))
        .map((l) => ({ codice: l.irrigazione_punti?.codice || '—', valore_mm: l.valore_mm })),
    [letture]
  )

  const altreStazioniStessoGiorno = sessioniStessoGiorno.filter((s) => s.id !== id)

  async function esportaSingola() {
    esportaPdfSessione({
      cliente,
      giardino: sessione.irrigazione_giardini,
      sessione,
      righe: righeOrdinate,
      statistiche,
      programmazione,
    })
  }

  async function esportaVisita() {
    try {
      const sezioni = await Promise.all(
        sessioniStessoGiorno.map(async (s) => {
          const l = await lettureApi.listaPerSessione(s.id)
          const stats = calcolaStatistiche(l.map((x) => x.valore_mm))
          const prog =
            s.stazione_id && s.durata_minuti && stats && fabbisogno.length > 0
              ? calcolaProgrammazione({
                  fabbisogno,
                  mediaMm: stats.media,
                  durataMinuti: s.durata_minuti,
                  percentualeDeficit: percentualeDeficit / 100,
                  cicliSettimana,
                })
              : null
          const righe = [...l]
            .sort((a, b) => (parseInt(a.irrigazione_punti?.codice, 10) || 0) - (parseInt(b.irrigazione_punti?.codice, 10) || 0))
            .map((x) => ({ codice: x.irrigazione_punti?.codice || '—', valore_mm: x.valore_mm }))
          return { sessione: s, statistiche: stats, programmazione: prog, righe }
        })
      )
      esportaPdfRiepilogoVisita({ cliente, giardino: sessione.irrigazione_giardini, data: sessione.data, sezioni })
    } catch (err) {
      showToast(err.message || 'Errore nella generazione del PDF', 'error')
    }
  }

  if (caricamento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size={32} label="Caricamento sessione…" />
      </div>
    )
  }

  if (!sessione) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar title="Sessione" backTo="/" />
        <p className="text-center text-gray-500 mt-10">Sessione non trovata.</p>
      </div>
    )
  }

  const giardino = sessione.irrigazione_giardini

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <TopBar title="Riepilogo sessione" backTo={`/giardini/${sessione.giardino_id}`} />

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="font-bold text-gray-900">{cliente?.nome_completo || giardino?.clienti?.nome_completo}</p>
          <p className="text-sm text-gray-500">{giardino?.luogo}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-600">
            <span>📅 {formattaData(sessione.data)}</span>
            {sessione.irrigazione_stazioni ? (
              <span>🚰 {sessione.irrigazione_stazioni.numero ? `#${sessione.irrigazione_stazioni.numero} ` : ''}{sessione.irrigazione_stazioni.nome}</span>
            ) : null}
            {sessione.durata_minuti ? <span>⏱ {sessione.durata_minuti} min</span> : null}
          </div>
          {sessione.note ? <p className="text-sm text-gray-500 mt-2 italic">"{sessione.note}"</p> : null}
        </div>

        {statistiche ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">Statistiche di uniformità</h2>
              <QualityBadge duLq={statistiche.duLq} />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <StatBox label="Media" valore={`${numero(statistiche.media)} mm`} />
              <StatBox label="Min" valore={`${numero(statistiche.min)} mm`} />
              <StatBox label="Max" valore={`${numero(statistiche.max)} mm`} />
              <StatBox label="Punti" valore={statistiche.n} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-center">
              <StatBox label="DU (quarto inf.)" valore={`${numero(statistiche.duLq, 0)}%`} />
              <StatBox label="CU Christiansen" valore={`${numero(statistiche.cu, 0)}%`} />
            </div>
          </div>
        ) : null}

        <div>
          <h2 className="font-bold text-gray-900 mb-2">Mappa a colori (heatmap)</h2>
          <MapView imageUrl={giardino?.mappa_immagine_url} heatPoints={heatPoints} showZoomControls />
          <p className="text-xs text-gray-400 mt-1.5">🔴 valore basso · 🟢 valore alto (relativo a min/max di questa sessione)</p>
        </div>

        {sessione.stazione_id && sessione.durata_minuti ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <h2 className="font-bold text-gray-900">Programmazione consigliata</h2>

            {giardino?.centralina_modello ? (
              <p className="text-xs bg-brand-50 text-brand-800 rounded-lg px-3 py-2">
                🎛️ Promemoria centralina: <strong>{giardino.centralina_modello}</strong>
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Deficit irriguo (%)"
                type="number"
                min={10}
                max={100}
                value={percentualeDeficit}
                onChange={(e) => setPercentualeDeficit(Number(e.target.value))}
              />
              <Input
                label="Cicli/settimana"
                type="number"
                min={1}
                max={14}
                value={cicliSettimana}
                onChange={(e) => setCicliSettimana(Number(e.target.value))}
              />
            </div>

            {programmazione ? (
              <>
                <div className="bg-brand-50 rounded-xl p-3 text-center">
                  <p className="text-sm text-gray-600">Programma base ({programmazione.picco.nome})</p>
                  <p className="text-2xl font-black text-brand-800">
                    {Math.round(programmazione.minutiBase)} min <span className="text-base font-semibold text-gray-500">· {programmazione.cicliSettimana} cicli/settimana</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Portata stimata: {numero(programmazione.portata, 2)} mm/min</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 text-xs uppercase">
                        <th className="py-1.5">Mese</th>
                        <th className="py-1.5 text-right">% stagionale</th>
                        <th className="py-1.5 text-right">Minuti</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programmazione.mesi.map((m) => (
                        <tr key={m.mese} className={`border-t border-gray-100 ${m.ePicco ? 'bg-brand-50/60 font-semibold' : ''}`}>
                          <td className="py-1.5">{m.nome}{m.ePicco ? ' 🏔' : ''}</td>
                          <td className="py-1.5 text-right">{numero(m.percentuale, 0)}%</td>
                          <td className="py-1.5 text-right">{Math.round(m.minuti)} min</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Dati insufficienti per calcolare la programmazione.</p>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            Imposta stazione e durata del test in questa sessione per vedere la programmazione consigliata della centralina.
          </div>
        )}

        <div className="space-y-2.5">
          <Button full onClick={esportaSingola}>
            📄 Esporta PDF sessione
          </Button>
          {altreStazioniStessoGiorno.length > 0 ? (
            <Button full variant="secondary" onClick={esportaVisita}>
              📑 Esporta PDF riepilogo visita ({sessioniStessoGiorno.length} stazioni testate il {formattaData(sessione.data)})
            </Button>
          ) : null}
          <Link
            to={`/giardini/${sessione.giardino_id}/storico`}
            className="btn w-full flex items-center justify-center gap-2 bg-white border border-brand-300 text-brand-800 font-bold py-3.5 rounded-2xl hover:bg-brand-50"
          >
            📈 Vedi storico giardino
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, valore }) {
  return (
    <div className="bg-gray-50 rounded-xl py-2.5 px-1">
      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className="text-lg font-bold text-gray-900">{valore}</p>
    </div>
  )
}
