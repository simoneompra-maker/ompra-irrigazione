import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import TopBar from '../components/TopBar'
import ClienteAutocomplete from '../components/ClienteAutocomplete'
import NuovoClienteForm from '../components/NuovoClienteForm'
import { Input, Textarea } from '../components/common/FormField'
import Button from '../components/common/Button'
import { clientiApi, giardiniApi, sopralluoghiApi } from '../lib/api'
import { caricaFile } from '../lib/storage'
import { useToast } from '../contexts/ToastContext'
import { formattaData } from '../utils/format'

export default function NuovoGiardinoPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()

  const [cliente, setCliente] = useState(null)
  const [luogo, setLuogo] = useState('')
  const [centralina, setCentralina] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState(null)
  const [anteprima, setAnteprima] = useState(null)
  const [sopralluogo, setSopralluogo] = useState(null)
  const [ricercaSopralluogo, setRicercaSopralluogo] = useState('')
  const [risultatiSopralluogo, setRisultatiSopralluogo] = useState([])
  const [modalClienteAperto, setModalClienteAperto] = useState(false)
  const [salvataggio, setSalvataggio] = useState(false)
  const fileInputRef = useRef(null)

  // Precompilazione da deep link ?sopralluogo=<uuid>&cliente=<uuid>
  useEffect(() => {
    const clienteId = searchParams.get('cliente')
    const sopralluogoId = searchParams.get('sopralluogo')
    async function precompila() {
      try {
        if (clienteId) {
          const c = await clientiApi.ottieni(clienteId)
          if (c) setCliente(c)
        }
        if (sopralluogoId) {
          const s = await sopralluoghiApi.ottieni(sopralluogoId)
          if (s) {
            setSopralluogo(s)
            if (s.luogo) setLuogo(s.luogo)
          }
        }
      } catch {
        // deep link non valido: l'utente compila comunque a mano
      }
    }
    if (clienteId || sopralluogoId) precompila()
  }, [searchParams])

  useEffect(() => {
    if (!cliente) return
    let attivo = true
    sopralluoghiApi
      .cerca({ clienteId: cliente.id })
      .then((res) => attivo && setRisultatiSopralluogo(res))
      .catch(() => {})
    return () => {
      attivo = false
    }
  }, [cliente])

  function onFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setAnteprima(URL.createObjectURL(f))
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!cliente) {
      showToast('Seleziona o crea un cliente', 'error')
      return
    }
    if (!luogo.trim()) {
      showToast('Inserisci il luogo del giardino', 'error')
      return
    }
    setSalvataggio(true)
    try {
      const giardino = await giardiniApi.crea({
        cliente_id: cliente.id,
        luogo: luogo.trim(),
        sopralluogo_id: sopralluogo?.id || null,
        centralina_modello: centralina.trim() || null,
        note: note.trim() || null,
      })

      if (file) {
        try {
          const url = await caricaFile(file, `giardini/${giardino.id}`)
          await giardiniApi.aggiorna(giardino.id, { mappa_immagine_url: url })
        } catch {
          showToast('Giardino creato, ma il caricamento della mappa è fallito. Puoi ricaricarla dalla scheda.', 'error')
          navigate(`/giardini/${giardino.id}`)
          return
        }
      }

      showToast('Giardino creato', 'success')
      navigate(`/giardini/${giardino.id}`)
    } catch (err) {
      showToast(err.message || 'Errore nella creazione del giardino', 'error')
    } finally {
      setSalvataggio(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <TopBar title="Nuovo giardino" backTo="/" />

      <form onSubmit={onSubmit} className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        <ClienteAutocomplete
          clienteSelezionato={cliente}
          onSeleziona={setCliente}
          onNuovoCliente={() => setModalClienteAperto(true)}
        />

        <Input label="Luogo" required placeholder="es. Via Roma 12, giardino privato" value={luogo} onChange={(e) => setLuogo(e.target.value)} />

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Immagine mappa (opzionale)</label>
          <div
            className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-4 text-center cursor-pointer hover:border-brand-400"
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) {
                setFile(f)
                setAnteprima(URL.createObjectURL(f))
              }
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            {anteprima ? (
              <img src={anteprima} alt="Anteprima mappa" className="max-h-52 mx-auto rounded-lg object-contain" />
            ) : (
              <div className="py-6 text-gray-500">
                <div className="text-3xl mb-1">🗺️</div>
                <p className="text-sm font-medium">Tocca per scegliere una foto/planimetria</p>
                <p className="text-xs text-gray-400 mt-1">oppure trascina qui il file</p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </div>
        </div>

        <Input
          label="Centralina (marca/modello)"
          placeholder="opzionale, es. Hunter Pro-C"
          value={centralina}
          onChange={(e) => setCentralina(e.target.value)}
        />

        <Textarea label="Note" placeholder="opzionale" value={note} onChange={(e) => setNote(e.target.value)} />

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Collegamento a sopralluogo (opzionale)</label>
          {sopralluogo ? (
            <div className="flex items-center justify-between rounded-xl border border-brand-300 bg-brand-50 px-4 py-2.5">
              <div>
                <p className="font-semibold text-gray-900">{sopralluogo.luogo || sopralluogo.cliente}</p>
                <p className="text-xs text-gray-500">{formattaData(sopralluogo.data_sopralluogo)}</p>
              </div>
              <button type="button" className="btn text-sm font-semibold text-brand-700 underline" onClick={() => setSopralluogo(null)}>
                Rimuovi
              </button>
            </div>
          ) : (
            <>
              <input
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder={cliente ? 'Sopralluoghi del cliente selezionato' : 'Seleziona prima un cliente, oppure cerca per luogo'}
                value={ricercaSopralluogo}
                onChange={async (e) => {
                  setRicercaSopralluogo(e.target.value)
                  if (!cliente) {
                    const res = await sopralluoghiApi.cerca({ query: e.target.value })
                    setRisultatiSopralluogo(res)
                  }
                }}
              />
              {risultatiSopralluogo.length > 0 ? (
                <div className="mt-1.5 rounded-xl border border-gray-200 bg-white divide-y divide-gray-50 max-h-48 overflow-y-auto">
                  {risultatiSopralluogo.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="btn w-full text-left px-3 py-2 hover:bg-brand-50 text-sm"
                      onClick={() => setSopralluogo(s)}
                    >
                      <span className="font-semibold">{s.luogo || s.cliente}</span>{' '}
                      <span className="text-gray-400">· {formattaData(s.data_sopralluogo)}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>

        <Button type="submit" full size="lg" disabled={salvataggio}>
          {salvataggio ? 'Creazione in corso…' : 'Crea giardino'}
        </Button>
      </form>

      <NuovoClienteForm
        open={modalClienteAperto}
        onClose={() => setModalClienteAperto(false)}
        onCreato={(c) => {
          setCliente(c)
          setModalClienteAperto(false)
        }}
      />
    </div>
  )
}
