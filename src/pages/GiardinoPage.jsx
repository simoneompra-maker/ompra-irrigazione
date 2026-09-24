import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import MapView from '../components/mappa/MapView'
import Spinner from '../components/common/Spinner'
import Modal from '../components/common/Modal'
import Button from '../components/common/Button'
import { Input, Textarea, Select } from '../components/common/FormField'
import { giardiniApi, stazioniApi, puntiApi, sessioniApi, lettureApi } from '../lib/api'
// (stazioniApi già importata sopra, riusata nei sotto-componenti di questo file)
import { caricaFile } from '../lib/storage'
import { useToast } from '../contexts/ToastContext'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { coloreStazione, COLORE_NESSUNA_STAZIONE } from '../utils/colors'
import { distribuisciPuntiInPoligono } from '../utils/polygon'
import { oggiISO } from '../utils/format'

function prossimoCodice(punti) {
  const numeri = punti.map((p) => parseInt(p.codice, 10)).filter((n) => !Number.isNaN(n))
  return String((numeri.length ? Math.max(...numeri) : 0) + 1)
}

export default function GiardinoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [giardino, setGiardino] = useState(null)
  const [stazioni, setStazioni] = useState([])
  const [punti, setPunti] = useState([])
  const [caricamento, setCaricamento] = useState(true)

  const [attivoTool, setAttivoTool] = useState('punti') // punti | poligono | irrigatori | lettura
  const [poligono, setPoligono] = useState([])
  const [modaleDistribuisci, setModaleDistribuisci] = useState(false)
  const [numPuntiDistribuisci, setNumPuntiDistribuisci] = useState(6)

  const [puntoSelezionato, setPuntoSelezionato] = useState(null)
  const [modaleStazioni, setModaleStazioni] = useState(false)
  const [modaleModificaGiardino, setModaleModificaGiardino] = useState(false)

  const [mostraLayerIrrigatori, setMostraLayerIrrigatori] = useState(false)
  const [irrigatori, setIrrigatori] = useLocalStorage(`irrigazione:irrigatori:${id}`, [])
  const [irrigatoreSelezionato, setIrrigatoreSelezionato] = useState(null)

  // --- Modalità "Lettura": tocchi un punto sulla mappa e scrivi subito il mm, senza cambiare schermata ---
  const [sessioneAttiva, setSessioneAttiva] = useState(null) // sessione già creata su cui si stanno registrando le letture
  const [stazioneLettura, setStazioneLettura] = useState('')
  const [durataLettura, setDurataLettura] = useState('')
  const [dataLettura, setDataLettura] = useState(oggiISO())
  const [avvioSessioneInCorso, setAvvioSessioneInCorso] = useState(false)
  const [letturheAttive, setLetturheAttive] = useState({}) // punto_id -> valore mm (della sessioneAttiva)
  const [puntoLetturaAttivo, setPuntoLetturaAttivo] = useState(null) // punto per cui è aperto il popup mm
  const [salvataggioLettura, setSalvataggioLettura] = useState(false)

  useEffect(() => {
    let attivo = true
    async function carica() {
      setCaricamento(true)
      try {
        const [g, s, p] = await Promise.all([giardiniApi.ottieni(id), stazioniApi.lista(id), puntiApi.lista(id)])
        if (!attivo) return
        setGiardino(g)
        setStazioni(s)
        setPunti(p)
      } catch (err) {
        showToast(err.message || 'Errore nel caricamento del giardino', 'error')
      } finally {
        if (attivo) setCaricamento(false)
      }
    }
    carica()
    return () => {
      attivo = false
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const pinsMappa = useMemo(
    () =>
      punti
        .filter((p) => p.pos_x != null && p.pos_y != null && p.attivo !== false)
        .map((p) => {
          const giaLetto = attivoTool === 'lettura' && sessioneAttiva && letturheAttive[p.id] !== undefined
          return {
            id: p.id,
            x: p.pos_x,
            y: p.pos_y,
            label: p.codice,
            color: giaLetto ? '#34D399' : coloreStazione(p.stazione_id, stazioni),
            draggable: attivoTool === 'punti',
          }
        }),
    [punti, stazioni, attivoTool, sessioneAttiva, letturheAttive]
  )

  const cerchiIrrigatori = useMemo(
    () =>
      mostraLayerIrrigatori
        ? irrigatori.map((i) => ({ id: i.id, x: i.x, y: i.y, radiusPercent: i.radiusPercent, color: '#2563eb' }))
        : [],
    [mostraLayerIrrigatori, irrigatori]
  )

  async function handleTap(x, y) {
    if (attivoTool === 'poligono') {
      setPoligono((p) => [...p, { x, y }])
      return
    }
    if (attivoTool === 'irrigatori') {
      const nuovo = { id: `irr-${Date.now()}`, x, y, radiusPercent: 1, nota: '' }
      setIrrigatori((prev) => [...prev, nuovo])
      setIrrigatoreSelezionato(nuovo)
      return
    }
    if (attivoTool === 'lettura') {
      if (!sessioneAttiva) return // deve prima impostare stazione/durata e premere "Avvia lettura"
      // area vuota: crea al volo un nuovo punto e apre subito il popup mm
      try {
        const codice = prossimoCodice(punti)
        const nuovoPunto = await puntiApi.crea({
          giardino_id: id,
          codice,
          pos_x: x,
          pos_y: y,
          stazione_id: sessioneAttiva.stazione_id || null,
          attivo: true,
        })
        setPunti((prev) => [...prev, nuovoPunto])
        setPuntoLetturaAttivo(nuovoPunto)
      } catch (err) {
        showToast(err.message || 'Errore nel creare il punto', 'error')
      }
      return
    }
    // modalità 'punti': aggiunge un nuovo punto sul giardino
    try {
      const codice = prossimoCodice(punti)
      const nuovoPunto = await puntiApi.crea({ giardino_id: id, codice, pos_x: x, pos_y: y, attivo: true })
      setPunti((prev) => [...prev, nuovoPunto])
      setPuntoSelezionato(nuovoPunto)
    } catch (err) {
      showToast(err.message || 'Errore nel creare il punto', 'error')
    }
  }

  function handlePinClick(pin) {
    if (attivoTool === 'irrigatori') return
    const punto = punti.find((p) => p.id === pin.id)
    if (!punto) return
    if (attivoTool === 'lettura') {
      if (!sessioneAttiva) return
      setPuntoLetturaAttivo(punto)
      return
    }
    setPuntoSelezionato(punto)
  }

  async function avviaLettura() {
    setAvvioSessioneInCorso(true)
    try {
      const sessione = await sessioniApi.crea({
        giardino_id: id,
        stazione_id: stazioneLettura || null,
        data: dataLettura,
        durata_minuti: durataLettura ? Number(durataLettura) : null,
        note: null,
      })
      setSessioneAttiva(sessione)
      setLetturheAttive({})
      showToast('Lettura avviata: tocca i punti sulla mappa per inserire i mm', 'success')
    } catch (err) {
      showToast(err.message || "Errore nell'avviare la lettura", 'error')
    } finally {
      setAvvioSessioneInCorso(false)
    }
  }

  async function salvaValoreLettura(valoreTesto) {
    if (!sessioneAttiva || !puntoLetturaAttivo) return
    const valoreNum = Number(String(valoreTesto).replace(',', '.'))
    if (Number.isNaN(valoreNum)) {
      showToast('Valore mm non valido', 'error')
      return
    }
    setSalvataggioLettura(true)
    try {
      await lettureApi.salvaMassivo([
        { sessione_id: sessioneAttiva.id, punto_id: puntoLetturaAttivo.id, valore_mm: valoreNum },
      ])
      setLetturheAttive((prev) => ({ ...prev, [puntoLetturaAttivo.id]: valoreNum }))
      setPuntoLetturaAttivo(null)
    } catch (err) {
      showToast(err.message || 'Errore nel salvare la lettura', 'error')
    } finally {
      setSalvataggioLettura(false)
    }
  }

  function terminaLettura() {
    const sessioneId = sessioneAttiva?.id
    setSessioneAttiva(null)
    setLetturheAttive({})
    setStazioneLettura('')
    setDurataLettura('')
    setAttivoTool('punti')
    if (sessioneId) navigate(`/sessioni/${sessioneId}`)
  }

  async function handlePinDragEnd(idPunto, x, y) {
    setPunti((prev) => prev.map((p) => (p.id === idPunto ? { ...p, pos_x: x, pos_y: y } : p)))
    try {
      await puntiApi.aggiorna(idPunto, { pos_x: x, pos_y: y })
    } catch (err) {
      showToast(err.message || 'Errore nel salvare la posizione', 'error')
    }
  }

  async function salvaPunto(campi) {
    if (!puntoSelezionato) return
    try {
      const aggiornato = await puntiApi.aggiorna(puntoSelezionato.id, campi)
      setPunti((prev) => prev.map((p) => (p.id === aggiornato.id ? aggiornato : p)))
      setPuntoSelezionato(null)
      showToast('Punto aggiornato', 'success')
    } catch (err) {
      showToast(err.message || 'Errore nel salvataggio', 'error')
    }
  }

  async function eliminaPunto() {
    if (!puntoSelezionato) return
    if (!window.confirm(`Eliminare il punto "${puntoSelezionato.codice}"? L'operazione non è reversibile.`)) return
    try {
      await puntiApi.elimina(puntoSelezionato.id)
      setPunti((prev) => prev.filter((p) => p.id !== puntoSelezionato.id))
      setPuntoSelezionato(null)
      showToast('Punto eliminato', 'success')
    } catch (err) {
      showToast(err.message || 'Errore nell\'eliminazione', 'error')
    }
  }

  function annullaPoligono() {
    setPoligono([])
    setAttivoTool('punti')
  }

  async function generaPuntiDistribuiti() {
    const n = Math.max(1, Math.min(60, Number(numPuntiDistribuisci) || 0))
    const coordinate = distribuisciPuntiInPoligono(poligono, n)
    if (coordinate.length === 0) {
      showToast('Poligono troppo piccolo per generare punti', 'error')
      return
    }
    try {
      let prossimo = parseInt(prossimoCodice(punti), 10)
      const payloads = coordinate.map((c) => ({
        giardino_id: id,
        codice: String(prossimo++),
        pos_x: c.x,
        pos_y: c.y,
        attivo: true,
      }))
      const creati = await puntiApi.creaMassivo(payloads)
      setPunti((prev) => [...prev, ...creati])
      showToast(`${creati.length} punti creati`, 'success')
    } catch (err) {
      showToast(err.message || 'Errore nella creazione dei punti', 'error')
    } finally {
      setPoligono([])
      setModaleDistribuisci(false)
      setAttivoTool('punti')
    }
  }

  if (caricamento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size={32} label="Caricamento giardino…" />
      </div>
    )
  }

  if (!giardino) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar title="Giardino" backTo="/" />
        <p className="text-center text-gray-500 mt-10">Giardino non trovato.</p>
      </div>
    )
  }

  const puntiLettiCount = Object.keys(letturheAttive).length

  const suggerimento =
    attivoTool === 'poligono'
      ? poligono.length < 3
        ? `Tocca la mappa per disegnare il poligono (${poligono.length} vertici)`
        : `Poligono con ${poligono.length} vertici — premi "Fatto" per continuare`
      : attivoTool === 'irrigatori'
        ? 'Tocca la mappa per aggiungere un irrigatore'
        : attivoTool === 'lettura'
          ? sessioneAttiva
            ? `Tocca un punto per scrivere il mm · tocca un'area vuota per aggiungerne uno nuovo (${puntiLettiCount} letti)`
            : 'Imposta stazione e durata qui sotto, poi premi "Avvia lettura"'
          : 'Tocca la mappa per aggiungere un punto · trascina un pin per spostarlo'

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <TopBar title={giardino.luogo || 'Giardino'} backTo="/" />

      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-gray-900">{giardino.clienti?.nome_completo}</p>
              <p className="text-sm text-gray-500">{giardino.luogo}</p>
              {giardino.centralina_modello ? (
                <p className="text-xs text-brand-700 mt-1">🎛️ {giardino.centralina_modello}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="btn text-sm font-semibold text-brand-700 underline shrink-0"
              onClick={() => setModaleModificaGiardino(true)}
            >
              Modifica
            </button>
          </div>
        </div>

        {/* Barra strumenti mappa */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <ToolButton attivo={attivoTool === 'lettura'} onClick={() => setAttivoTool('lettura')} icon="📝" label="Lettura" />
          <ToolButton attivo={attivoTool === 'punti'} onClick={() => setAttivoTool('punti')} icon="📍" label="Punti" />
          <ToolButton
            attivo={attivoTool === 'poligono'}
            onClick={() => {
              setAttivoTool('poligono')
              setPoligono([])
            }}
            icon="⬡"
            label="Distribuisci"
          />
          <ToolButton
            attivo={attivoTool === 'irrigatori'}
            onClick={() => {
              setAttivoTool('irrigatori')
              setMostraLayerIrrigatori(true)
            }}
            icon="💦"
            label="Irrigatori"
          />
          <button
            type="button"
            className={`btn shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border ${mostraLayerIrrigatori ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}
            onClick={() => setMostraLayerIrrigatori((v) => !v)}
          >
            {mostraLayerIrrigatori ? 'Nascondi irrigatori' : 'Mostra irrigatori'}
          </button>
          <button
            type="button"
            className="btn shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border bg-white border-gray-200 text-gray-500"
            onClick={() => setModaleStazioni(true)}
          >
            🚰 Stazioni ({stazioni.length})
          </button>
        </div>

        {attivoTool === 'lettura' && !sessioneAttiva ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select label="Stazione (opzionale)" value={stazioneLettura} onChange={(e) => setStazioneLettura(e.target.value)}>
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
                value={durataLettura}
                onChange={(e) => setDurataLettura(e.target.value)}
              />
            </div>
            <Input label="Data test" type="date" value={dataLettura} onChange={(e) => setDataLettura(e.target.value)} />
            <Button full onClick={avviaLettura} disabled={avvioSessioneInCorso}>
              {avvioSessioneInCorso ? 'Avvio…' : '▶ Avvia lettura'}
            </Button>
          </div>
        ) : null}

        {attivoTool === 'lettura' && sessioneAttiva ? (
          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-brand-800">
              {stazioni.find((s) => s.id === sessioneAttiva.stazione_id)?.nome || 'Nessuna stazione'} ·{' '}
              {sessioneAttiva.durata_minuti ? `${sessioneAttiva.durata_minuti} min` : 'durata n/d'} · {puntiLettiCount} letti
            </p>
            <Button size="sm" onClick={terminaLettura}>
              Fine
            </Button>
          </div>
        ) : null}

        <MapView
          imageUrl={giardino.mappa_immagine_url}
          pins={pinsMappa}
          onPinClick={handlePinClick}
          onPinDragEnd={handlePinDragEnd}
          polygonPoints={attivoTool === 'poligono' ? poligono : []}
          circles={cerchiIrrigatori}
          onTap={handleTap}
          hint={suggerimento}
        />

        {attivoTool === 'poligono' ? (
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={annullaPoligono}>
              Annulla
            </Button>
            <Button
              full
              disabled={poligono.length < 3}
              onClick={() => setModaleDistribuisci(true)}
            >
              Fatto ({poligono.length} vertici)
            </Button>
          </div>
        ) : null}

        {/* Legenda stazioni */}
        {stazioni.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {punti.some((p) => !p.stazione_id) ? (
              <LegendaItem colore={COLORE_NESSUNA_STAZIONE} label="Nessuna stazione" />
            ) : null}
            {stazioni.map((s) => (
              <LegendaItem key={s.id} colore={coloreStazione(s.id, stazioni)} label={`${s.numero ? `#${s.numero} ` : ''}${s.nome || ''}`.trim() || 'Stazione'} />
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link
            to={`/giardini/${id}/sessioni/nuova`}
            className="btn flex items-center justify-center gap-2 bg-brand-700 text-white font-bold py-3.5 rounded-2xl shadow-md hover:bg-brand-800"
          >
            ▶ Prosegui
          </Link>
          <Link
            to={`/giardini/${id}/storico`}
            className="btn flex items-center justify-center gap-2 bg-white border border-brand-300 text-brand-800 font-bold py-3.5 rounded-2xl hover:bg-brand-50"
          >
            📈 Storico
          </Link>
        </div>

        <p className="text-xs text-gray-400 text-center pt-1">{punti.length} punto/i censiti su questo giardino</p>
      </div>

      {/* Modal modifica punto */}
      <Modal open={!!puntoSelezionato} onClose={() => setPuntoSelezionato(null)} title={`Punto ${puntoSelezionato?.codice || ''}`}>
        {puntoSelezionato ? (
          <PuntoForm
            punto={puntoSelezionato}
            stazioni={stazioni}
            onSalva={salvaPunto}
            onElimina={eliminaPunto}
          />
        ) : null}
      </Modal>

      {/* Modal inserimento rapido mm (modalità Lettura) */}
      <Modal open={!!puntoLetturaAttivo} onClose={() => setPuntoLetturaAttivo(null)} title={`Punto ${puntoLetturaAttivo?.codice || ''}`}>
        {puntoLetturaAttivo ? (
          <LetturaMmForm
            valoreIniziale={letturheAttive[puntoLetturaAttivo.id]}
            salvataggio={salvataggioLettura}
            onSalva={salvaValoreLettura}
          />
        ) : null}
      </Modal>

      {/* Modal genera punti distribuiti */}
      <Modal
        open={modaleDistribuisci}
        onClose={() => setModaleDistribuisci(false)}
        title="Distribuisci punti nel poligono"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" full onClick={() => setModaleDistribuisci(false)}>
              Annulla
            </Button>
            <Button full onClick={generaPuntiDistribuiti}>
              Genera punti
            </Button>
          </div>
        }
      >
        <Input
          label="Quanti punti vuoi generare?"
          type="number"
          min={1}
          max={60}
          value={numPuntiDistribuisci}
          onChange={(e) => setNumPuntiDistribuisci(e.target.value)}
        />
        <p className="text-xs text-gray-500 mt-2">
          I punti verranno distribuiti in modo uniforme (a griglia) all'interno dell'area disegnata.
        </p>
      </Modal>

      {/* Modal gestione stazioni */}
      <Modal open={modaleStazioni} onClose={() => setModaleStazioni(false)} title="Stazioni / elettrovalvole">
        <StazioniPanel
          giardinoId={id}
          stazioni={stazioni}
          setStazioni={setStazioni}
          showToast={showToast}
        />
      </Modal>

      {/* Modal modifica giardino */}
      <Modal open={modaleModificaGiardino} onClose={() => setModaleModificaGiardino(false)} title="Modifica giardino">
        <ModificaGiardinoForm
          giardino={giardino}
          onSalvato={(g) => {
            setGiardino(g)
            setModaleModificaGiardino(false)
          }}
          showToast={showToast}
        />
      </Modal>

      {/* Modal modifica irrigatore */}
      <Modal
        open={!!irrigatoreSelezionato}
        onClose={() => setIrrigatoreSelezionato(null)}
        title="Irrigatore (annotazione)"
      >
        {irrigatoreSelezionato ? (
          <IrrigatoreForm
            irrigatore={irrigatoreSelezionato}
            onSalva={(campi) => {
              setIrrigatori((prev) => prev.map((i) => (i.id === irrigatoreSelezionato.id ? { ...i, ...campi } : i)))
              setIrrigatoreSelezionato(null)
            }}
            onElimina={() => {
              setIrrigatori((prev) => prev.filter((i) => i.id !== irrigatoreSelezionato.id))
              setIrrigatoreSelezionato(null)
            }}
          />
        ) : null}
      </Modal>
    </div>
  )
}

function LetturaMmForm({ valoreIniziale, salvataggio, onSalva }) {
  const [valore, setValore] = useState(valoreIniziale != null ? String(valoreIniziale).replace('.', ',') : '')
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function cambiaValore(v) {
    if (v !== '' && !/^\d*[.,]?\d*$/.test(v)) return
    setValore(v)
  }

  function conferma() {
    if (valore === '') return
    onSalva(valore)
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        inputMode="decimal"
        placeholder="mm"
        value={valore}
        onChange={(e) => cambiaValore(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') conferma()
        }}
        className="w-full text-center text-4xl font-black text-gray-900 rounded-xl border border-gray-300 py-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <Button full size="lg" onClick={conferma} disabled={salvataggio || valore === ''}>
        {salvataggio ? 'Salvataggio…' : 'Salva e continua'}
      </Button>
    </div>
  )
}

function ToolButton({ attivo, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-bold border ${
        attivo ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-gray-600 border-gray-200'
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}

function LegendaItem({ colore, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-100 rounded-full px-2.5 py-1">
      <span className="inline-block rounded-full" style={{ width: 9, height: 9, backgroundColor: colore }} />
      {label}
    </span>
  )
}

function PuntoForm({ punto, stazioni, onSalva, onElimina }) {
  const [nota, setNota] = useState(punto.nota || '')
  const [stazioneId, setStazioneId] = useState(punto.stazione_id || '')

  return (
    <div className="space-y-4">
      <Select label="Stazione di appartenenza" value={stazioneId} onChange={(e) => setStazioneId(e.target.value)}>
        <option value="">Nessuna stazione</option>
        {stazioni.map((s) => (
          <option key={s.id} value={s.id}>
            {s.numero ? `#${s.numero} ` : ''}
            {s.nome}
          </option>
        ))}
      </Select>
      <Textarea label="Nota" value={nota} onChange={(e) => setNota(e.target.value)} />
      <div className="flex gap-3 pt-1">
        <Button variant="outlineDanger" onClick={onElimina}>
          Elimina
        </Button>
        <Button full onClick={() => onSalva({ nota: nota || null, stazione_id: stazioneId || null })}>
          Salva
        </Button>
      </div>
    </div>
  )
}

function StazioniPanel({ giardinoId, stazioni, setStazioni, showToast }) {
  const [numero, setNumero] = useState('')
  const [nome, setNome] = useState('')
  const [salvataggio, setSalvataggio] = useState(false)

  async function aggiungi() {
    if (!nome.trim()) {
      showToast('Inserisci un nome per la stazione', 'error')
      return
    }
    setSalvataggio(true)
    try {
      const nuova = await stazioniApi.crea({ giardino_id: giardinoId, numero: numero.trim() || null, nome: nome.trim() })
      setStazioni((prev) => [...prev, nuova])
      setNumero('')
      setNome('')
    } catch (err) {
      showToast(err.message || 'Errore nella creazione della stazione', 'error')
    } finally {
      setSalvataggio(false)
    }
  }

  async function elimina(id) {
    if (!window.confirm('Eliminare questa stazione? I punti assegnati resteranno senza stazione.')) return
    try {
      await stazioniApi.elimina(id)
      setStazioni((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      showToast(err.message || "Errore nell'eliminazione", 'error')
    }
  }

  return (
    <div className="space-y-4">
      {stazioni.length === 0 ? (
        <p className="text-sm text-gray-500">Nessuna stazione ancora. Aggiungine una qui sotto.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
          {stazioni.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-block rounded-full" style={{ width: 10, height: 10, backgroundColor: coloreStazione(s.id, stazioni) }} />
                <span className="font-medium text-gray-800">
                  {s.numero ? `#${s.numero} ` : ''}
                  {s.nome}
                </span>
              </div>
              <button type="button" className="btn text-red-600 text-sm font-semibold" onClick={() => elimina(s.id)}>
                Elimina
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-3 gap-2 items-end pt-2 border-t border-gray-100">
        <Input label="N°" value={numero} onChange={(e) => setNumero(e.target.value)} className="col-span-1" />
        <Input label="Nome stazione" value={nome} onChange={(e) => setNome(e.target.value)} className="col-span-2" />
      </div>
      <Button full onClick={aggiungi} disabled={salvataggio}>
        + Aggiungi stazione
      </Button>
    </div>
  )
}

function ModificaGiardinoForm({ giardino, onSalvato, showToast }) {
  const [luogo, setLuogo] = useState(giardino.luogo || '')
  const [centralina, setCentralina] = useState(giardino.centralina_modello || '')
  const [note, setNote] = useState(giardino.note || '')
  const [file, setFile] = useState(null)
  const [salvataggio, setSalvataggio] = useState(false)
  const fileInputRef = useRef(null)

  async function salva() {
    setSalvataggio(true)
    try {
      let mappaUrl = giardino.mappa_immagine_url
      if (file) {
        mappaUrl = await caricaFile(file, `giardini/${giardino.id}`)
      }
      const aggiornato = await giardiniApi.aggiorna(giardino.id, {
        luogo: luogo.trim(),
        centralina_modello: centralina.trim() || null,
        note: note.trim() || null,
        mappa_immagine_url: mappaUrl,
      })
      onSalvato({ ...giardino, ...aggiornato })
      showToast('Giardino aggiornato', 'success')
    } catch (err) {
      showToast(err.message || 'Errore nel salvataggio', 'error')
    } finally {
      setSalvataggio(false)
    }
  }

  return (
    <div className="space-y-4">
      <Input label="Luogo" value={luogo} onChange={(e) => setLuogo(e.target.value)} />
      <Input label="Centralina" value={centralina} onChange={(e) => setCentralina(e.target.value)} />
      <Textarea label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sostituisci immagine mappa</label>
        <button
          type="button"
          className="btn w-full rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-brand-400"
          onClick={() => fileInputRef.current?.click()}
        >
          {file ? `Selezionato: ${file.name}` : 'Scegli nuovo file…'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      <Button full onClick={salva} disabled={salvataggio}>
        {salvataggio ? 'Salvataggio…' : 'Salva modifiche'}
      </Button>
    </div>
  )
}

function IrrigatoreForm({ irrigatore, onSalva, onElimina }) {
  const [nota, setNota] = useState(irrigatore.nota || '')
  const [raggio, setRaggio] = useState(irrigatore.radiusPercent || 1)

  return (
    <div className="space-y-4">
      <Input
        label="Raggio approssimativo (% mappa)"
        type="number"
        min={1}
        max={30}
        value={raggio}
        onChange={(e) => setRaggio(Number(e.target.value))}
      />
      <Textarea label="Nota (es. irrigatore rotto, mal orientato…)" value={nota} onChange={(e) => setNota(e.target.value)} />
      <div className="flex gap-3">
        <Button variant="outlineDanger" onClick={onElimina}>
          Elimina
        </Button>
        <Button full onClick={() => onSalva({ nota, radiusPercent: raggio })}>
          Salva
        </Button>
      </div>
    </div>
  )
}

