import { useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Spinner from './common/Spinner'

const PROMPT_TRASCRIZIONE =
  'Trascrivi fedelmente in italiano questo appunto vocale di un tecnico durante un sopralluogo di irrigazione. Restituisci solo il testo trascritto, senza commenti.'

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result || ''
      const base64 = String(dataUrl).split(',')[1] || ''
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function sceglieMimeType() {
  const candidati = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const tipo of candidati) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(tipo)) {
      return tipo
    }
  }
  return ''
}

/**
 * Pulsante microfono per dettare una nota vocale, trascritta tramite la
 * Edge Function `gemini-proxy`. Non blocca mai il salvataggio: in caso di
 * errore mostra un messaggio non invasivo e l'utente può sempre scrivere
 * a mano (o usare la dettatura nativa della tastiera) nella textarea accanto.
 */
export default function MicrofonoTrascrizione({ onTrascrizione, disabled }) {
  const [stato, setStato] = useState('idle') // idle | registrando | elaborando | errore
  const [errore, setErrore] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)

  async function avviaRegistrazione() {
    setErrore('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrore('Microfono non disponibile su questo dispositivo/browser.')
      setStato('errore')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = sceglieMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => elaboraRegistrazione(mimeType || recorder.mimeType || 'audio/webm')
      mediaRecorderRef.current = recorder
      recorder.start()
      setStato('registrando')
    } catch (err) {
      const negato = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
      setErrore(negato ? 'Permesso microfono negato. Abilitalo nelle impostazioni del browser.' : 'Impossibile accedere al microfono.')
      setStato('errore')
    }
  }

  function fermaStream() {
    streamRef.current?.getTracks()?.forEach((t) => t.stop())
    streamRef.current = null
  }

  function fermaRegistrazione() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setStato('elaborando')
  }

  async function elaboraRegistrazione(mimeType) {
    fermaStream()
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      if (blob.size < 500) {
        setErrore('Registrazione troppo breve, riprova.')
        setStato('errore')
        return
      }
      const base64Audio = await blobToBase64(blob)
      const tipoInvio = mimeType.split(';')[0] || 'audio/webm'

      const { data, error } = await supabase.functions.invoke('gemini-proxy', {
        body: {
          model: 'gemini-2.5-flash-lite',
          endpoint: 'generateContent',
          payload: {
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: tipoInvio, data: base64Audio } },
                  { text: PROMPT_TRASCRIZIONE },
                ],
              },
            ],
          },
        },
      })

      if (error) throw error

      const testo = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (!testo) {
        setErrore('Trascrizione non riuscita, scrivi pure a mano.')
        setStato('errore')
        return
      }
      onTrascrizione?.(testo)
      setStato('idle')
    } catch {
      setErrore('Trascrizione non disponibile in questo momento, scrivi pure a mano.')
      setStato('errore')
    }
  }

  if (stato === 'registrando') {
    return (
      <button
        type="button"
        onClick={fermaRegistrazione}
        className="btn inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold relative"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
        </span>
        Ferma registrazione
      </button>
    )
  }

  if (stato === 'elaborando') {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">
        <Spinner size={16} /> Trascrizione in corso…
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={avviaRegistrazione}
        disabled={disabled}
        className="btn inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-100 text-brand-800 text-sm font-semibold hover:bg-brand-200 disabled:opacity-50"
      >
        🎤 Detta nota vocale
      </button>
      {errore ? <p className="text-xs text-red-600">{errore}</p> : null}
    </div>
  )
}
