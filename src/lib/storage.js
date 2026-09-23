import { supabase } from './supabaseClient'

const BUCKET = 'irrigazione-media'

function estensioneFile(file) {
  const parti = (file.name || '').split('.')
  if (parti.length > 1) return parti.pop().toLowerCase()
  if (file.type === 'image/png') return 'png'
  return 'jpg'
}

/**
 * Carica un file nel bucket `irrigazione-media` sotto il path indicato e
 * restituisce l'URL pubblico.
 * @param {File} file
 * @param {string} cartella es. `giardini/{id}` oppure `letture/{sessioneId}`
 */
export async function caricaFile(file, cartella) {
  const ext = estensioneFile(file)
  const nomeFile = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `${cartella}/${nomeFile}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
