import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import Spinner from '../components/common/Spinner'
import Button from '../components/common/Button'
import { Input, Select, Textarea } from '../components/common/FormField'
import MicrofonoTrascrizione from '../components/MicrofonoTrascrizione'
import { giardiniApi, stazioniApi, puntiApi, sessioniApi, lettureApi } from '../lib/api'
import { caricaFile } from '../lib/storage'
import { useToast } from '../contexts/ToastContext'
import { oggiISO } from '../utils/format'

// Bozza salvata in localStorage mentre si compila, così se si torna indietro (es. per
// controllare come sono disposti i punti sulla mappa) e poi si rientra in questa schermata
// i valori già scritti non vengono persi. Le foto (File) non sono serializzabili e non
// vengono salvate nella bozza: solo i mm, la nota e le impostazioni del test.
function chiaveBozza(giardinoId) {
  return `irrigazione:bozza-sessione:${giardinoId}`
}

export default function NuovaSessionePage() {
  const { id: giardinoId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [giardino, setGiardino] = useState(null)
  const [stazioni, setStazioni] = useState([])
  const [punti, setPunti] = useState([])
  const [caricamento, setCaricamento] = useState(true)

  const [bozzaIniziale] = useState(() => {
    try {
      const raw = window.localStorage.getItem(chiaveBozza(giardinoId))
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const [stazioneId, setStazioneId] = useState(bozzaIniziale?.stazioneId || '')
  const [durataMinuti, setDurataMinuti] = useState(bozzaIniziale?.durataMinuti || '')
  const [data, setData] = useState(bozzaIniziale?.data || oggiISO())
  const [nota, setNota] = useState(bozzaIniziale?.nota || '')
  const [modalita, setModalita] = useState(bozzaIniziale?.modalita || 'campo') // 'campo' | 'foto'

  const [valori, setValori] = useState(bozzaIniziale?.valori || {}) // punto_id -> stringa valore mm
  const [foto, setFoto] = useState({}) // punto_id -> {file, anteprima}
  const [fotoGenerali, setFotoGenerali] = useState([]) // foto caricate in modalità 'da foto', libere

  const [indiceAttivo, setIndiceAttivo] = useState(0) // per il tastierino, punto attualmente in focus
  const [salvataggio, setSalvataggio] = useState(false)

  useEffect(() => {
    if (bozzaIniziale && Object.keys(bozzaIniziale.valori || {}).length > 0) {
      showToast('Bozza precedente ripristinata: i valori già inseriti sono ancora qui', 'success')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(
        chiaveBozza(giardinoId),
        JSON.stringify({ stazioneId, durataMinuti, data, nota, modalita, valori })
      )
    } catch {
      // storage pieno o non disponibile: la bozza resta solo in memoria per questa visita
    }
  }, [giardinoId, stazioneId, durataMinuti, data, nota, modalita, valori])

  useEffect(() => {
    let attivo = true
    async function carica() {
      setCaricamento(true)
      try {
        const [g, s, p] = await Promise.all([
          giardiniApi.ottieni(giardinoId),
          stazioniApi.lista(giardinoId),
          puntiApi.lista(giardinoId),
        ])
        if (!attivo) return
        setGiardino(g)
        setStazioni(s)
        setPunti(p.filter((pt) => pt.attivo !== false))
      } catch (err) {
        showToast(err.message || 'Errore nel caricamento', 'error')
      } finally {
        if (attivo) setCaricamento(false)
      }
    }
    carica()
    return () => {
      attivo = false
    }
  }, [giardinoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const puntiOrdinati = useMemo(
    () => [...punti].sort((a, b) => (parseInt(a.codice, 10) || 0) - (parseInt(b.codice, 10) || 0)),
    [punti]
  )

  const compilati = puntiOrdinati.filter((p) => valori[p.id] !== undefined && valori[p.id] !== '').length

  function setValore(puntoId, v) {
    // consente solo numeri con virgola/punto decimale
    if (v !== '' && !/^\d*[.,]?\d*$/.test(v)) return
    setValori((prev) => ({ ...prev, [puntoId]: v }))
  }

  function onFotoPunto(puntoId, file) {
    if (!file) return
    setFoto((prev) => ({ ...prev, [puntoId]: { file, anteprima: URL.createObjectURL(file) } }))
  }

  function onFotoGenerica(fileList) {
    const nuove = Array.from(fileList).map((f) => ({ file: f, anteprima: URL.createObjectURL(f) }))
    setFotoGenerali((prev) => [...prev, ...nuove])
  }

  async function salvaSessione() {
    const puntiConValore = puntiOrdinati.filter((p) => valori[p.id] !== undefined && valori[p.id] !== '')
    if (puntiConValore.length === 0) {
      showToast('Inserisci almeno un valore letto', 'error')
      return
    }
    setSalvataggio(true)
    try {
      const sessione = await sessioniApi.crea({
        giardino_id: giardinoId,
        stazione_id: stazioneId || null,
        data,
        durata_minuti: durataMinuti ? Number(durataMinuti) : null,
        note: nota || null,
      })

      const letture = []
      for (const p of puntiConValore) {
        const valoreNum = Number(String(valori[p.id]).replace(',', '.'))
        if (Number.isNaN(valoreNum)) continue
        let fotoUrl = null
        if (foto[p.id]?.file) {
          try {
            fotoUrl = await caricaFile(foto[p.id].file, `letture/${sessione.id}`)
          } catch {
            // la foto non blocca il salvataggio della lettura
          }
        }
        letture.push({ sessione_id: sessione.id, punto_id: p.id, valore_mm: valoreNum, foto_url: fotoUrl })
      }

      await lettureApi.salvaMassivo(letture)

      // foto generali caricate in modalità "da foto" senza un punto specifico:
      // vengono comunque conservate su storage per riferimento futuro dell'operatore.
      for (const f of fotoGenerali) {
        try {
          await caricaFile(f.file, `sessioni/${sessione.id}`)
        } catch {
          // non bloccante
        }
      }

      try {
        window.localStorage.removeItem(chiaveBozza(giardinoId))
      } catch {
        // non bloccante
      }
      showToast('Sessione salvata', 'success')
      navigate(`/sessioni/${sessione.id}`)
    } catch (err) {
      showToast(err.message || 'Errore nel salvataggio della sessione', 'error')
    } finally {
      setSalvataggio(false)
    }
  }

  if (caricamento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size={32} label="Caricamento…" />
      </div>
    )
  }

  if (!giardino) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar title="Prosegui" backTo={`/giardini/${giardinoId}`} />
        <p className="text-center text-gray-500 mt-10">Giardino non trovato.</p>
      </div>
    )
  }

  if (puntiOrdinati.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar title="Prosegui" backTo={`/giardini/${giardinoId}`} />
        <p className="text-center text-gray-500 mt-10 px-6">
          Non ci sono ancora punti censiti su questo giardino. Torna alla scheda giardino e posiziona almeno un
          punto sulla mappa prima di avviare una sessione di lettura.
        </p>
      </div>
    )
  }

  const puntoAttivo = puntiOrdinati[Math.min(indiceAttivo, puntiOrdinati.length - 1)]

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <TopBar title="Prosegui con le letture" backTo={`/giardini/${giardinoId}`} />

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Stazione attiva (opzionale)" value={stazioneId} onChange={(e) => setStazioneId(e.target.value)}>
              <option value="">Non specificata</option>
              {stazioni.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.numero ? `#${s.numero} ` : ''}
                  {s.nome}
                </option>
              ))}
            </Select>
            <Input
              label="Durata test (minuti)"
              type="number"
              min={1}
              placeholder="es. 15"
              value={durataMinuti}
              onChange={(e) => setDurataMinuti(e.target.value)}
            />
          </div>
          <Input label="Data test" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>

        {/* Toggle modalità */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            type="button"
            className={`btn flex-1 py-2.5 rounded-lg text-sm font-bold ${modalita === 'campo' ? 'bg-white shadow text-brand-800' : 'text-gray-500'}`}
            onClick={() => setModalita('campo')}
          >
            📋 Sul campo
          </button>
          <button
            type="button"
            className={`btn flex-1 py-2.5 rounded-lg text-sm font-bold ${modalita === 'foto' ? 'bg-white shadow text-brand-800' : 'text-gray-500'}`}
            onClick={() => setModalita('foto')}
          >
            📷 Da foto
          </button>
        </div>

        <p className="text-sm text-gray-500 text-center">
          {compilati} / {puntiOrdinati.length} punti compilati
        </p>

        {modalita === 'campo' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="btn w-10 h-10 rounded-full bg-gray-100 text-lg font-bold disabled:opacity-30"
                disabled={indiceAttivo === 0}
                onClick={() => setIndiceAttivo((i) => Math.max(0, i - 1))}
              >
                ‹
              </button>
              <div className="text-center">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Punto</p>
                <p className="text-3xl font-black text-brand-800">{puntoAttivo.codice}</p>
              </div>
              <button
                type="button"
                className="btn w-10 h-10 rounded-full bg-gray-100 text-lg font-bold disabled:opacity-30"
                disabled={indiceAttivo === puntiOrdinati.length - 1}
                onClick={() => setIndiceAttivo((i) => Math.min(puntiOrdinati.length - 1, i + 1))}
              >
                ›
              </button>
            </div>

            <TastierinoMm valore={valori[puntoAttivo.id] || ''} onChange={(v) => setValore(puntoAttivo.id, v)} />

            <div className="flex flex-wrap gap-1.5 justify-center pt-1">
              {puntiOrdinati.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setIndiceAttivo(i)}
                  className={`btn w-9 h-9 rounded-lg text-xs font-bold border ${
                    i === indiceAttivo
                      ? 'bg-brand-700 text-white border-brand-700'
                      : valori[p.id]
                        ? 'bg-brand-50 text-brand-800 border-brand-200'
                        : 'bg-white text-gray-400 border-gray-200'
                  }`}
                >
                  {p.codice}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Foto generali del test (opzionale)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => onFotoGenerica(e.target.files)}
                className="block w-full text-sm text-gray-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-brand-100 file:text-brand-800 file:font-semibold"
              />
              {fotoGenerali.length > 0 ? (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {fotoGenerali.map((f, i) => (
                    <img key={i} src={f.anteprima} alt="" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
              {puntiOrdinati.map((p) => (
                <div key={p.id} className="p-4 flex items-center gap-3">
                  <label className="w-14 h-14 rounded-xl bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer">
                    {foto[p.id]?.anteprima ? (
                      <img src={foto[p.id].anteprima} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">📷</span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => onFotoPunto(p.id, e.target.files?.[0])}
                    />
                  </label>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 font-semibold">Punto {p.codice}</p>
                    <input
                      inputMode="decimal"
                      placeholder="mm"
                      value={valori[p.id] || ''}
                      onChange={(e) => setValore(p.id, e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nota con dettatura */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
          <Textarea
            label="Nota"
            placeholder="Condizioni meteo, anomalie osservate, pressione…"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
          <MicrofonoTrascrizione
            onTrascrizione={(testo) => setNota((prev) => (prev ? `${prev} ${testo}` : testo))}
          />
        </div>

        <Button full size="lg" onClick={salvaSessione} disabled={salvataggio}>
          {salvataggio ? 'Salvataggio…' : 'Salva sessione e letture'}
        </Button>
      </div>
    </div>
  )
}

function TastierinoMm({ valore, onChange }) {
  function premi(tasto) {
    if (tasto === 'canc') {
      onChange(valore.slice(0, -1))
      return
    }
    if (tasto === ',') {
      if (valore.includes(',') || valore.includes('.')) return
      onChange(valore + ',')
      return
    }
    onChange(valore + tasto)
  }

  const tasti = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'canc']

  return (
    <div>
      <div className="text-center mb-3">
        <span className="text-5xl font-black text-gray-900 tabular-nums">{valore || '0'}</span>
        <span className="text-xl font-bold text-gray-400 ml-1">mm</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tasti.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => premi(t)}
            className="btn h-14 rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-2xl font-bold text-gray-800 border border-gray-200"
          >
            {t === 'canc' ? '⌫' : t}
          </button>
        ))}
      </div>
    </div>
  )
}
