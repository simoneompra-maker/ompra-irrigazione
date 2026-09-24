import { supabase } from './supabaseClient'

function throwIfError({ data, error }) {
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Clienti (anagrafica condivisa con tutto il gestionale OMPRA)
// ---------------------------------------------------------------------------
export const clientiApi = {
  async cerca(query, limit = 15) {
    if (!query || query.trim().length < 2) return []
    const q = query.trim()
    const res = await supabase
      .from('clienti')
      .select('id, nome, cognome, nome_completo, indirizzo, localita, telefono, email')
      .is('deleted_at', null)
      .or(`nome_completo.ilike.%${q}%,search_text.ilike.%${q}%`)
      .order('nome_completo', { ascending: true })
      .limit(limit)
    return throwIfError(res)
  },

  async ottieni(id) {
    if (!id) return null
    const res = await supabase
      .from('clienti')
      .select('id, nome, cognome, nome_completo, indirizzo, localita, telefono, email')
      .eq('id', id)
      .maybeSingle()
    return throwIfError(res)
  },

  async crea({ nome, cognome, indirizzo, telefono, email }) {
    const nomeCompleto = [nome, cognome].filter(Boolean).join(' ').trim() || nome || cognome
    const res = await supabase
      .from('clienti')
      .insert({
        nome: nome || null,
        cognome: cognome || null,
        nome_completo: nomeCompleto,
        indirizzo: indirizzo || null,
        telefono: telefono || null,
        email: email || null,
        fonte: 'app-irrigazione',
      })
      .select()
      .single()
    return throwIfError(res)
  },
}

// ---------------------------------------------------------------------------
// Sopralluoghi (solo lettura, per il collegamento opzionale/deep link)
// ---------------------------------------------------------------------------
export const sopralluoghiApi = {
  async cerca({ query, clienteId, limit = 10 } = {}) {
    let builder = supabase
      .from('sopralluoghi')
      .select('id, cliente, luogo, data_sopralluogo, cliente_id')
      .order('data_sopralluogo', { ascending: false })
      .limit(limit)
    if (clienteId) {
      builder = builder.eq('cliente_id', clienteId)
    } else if (query && query.trim().length >= 2) {
      const q = query.trim()
      builder = builder.or(`cliente.ilike.%${q}%,luogo.ilike.%${q}%`)
    } else {
      return []
    }
    const res = await builder
    return throwIfError(res)
  },

  async ottieni(id) {
    if (!id) return null
    const res = await supabase
      .from('sopralluoghi')
      .select('id, cliente, luogo, data_sopralluogo, cliente_id')
      .eq('id', id)
      .maybeSingle()
    return throwIfError(res)
  },
}

// ---------------------------------------------------------------------------
// Giardini
// ---------------------------------------------------------------------------
export const giardiniApi = {
  async lista() {
    const res = await supabase
      .from('irrigazione_giardini')
      .select('id, created_at, updated_at, cliente_id, luogo, sopralluogo_id, mappa_immagine_url, centralina_modello, clienti(nome_completo)')
      .order('created_at', { ascending: false })
    return throwIfError(res)
  },

  async ottieni(id) {
    const res = await supabase
      .from('irrigazione_giardini')
      .select('*, clienti(id, nome_completo, indirizzo, localita, telefono, email)')
      .eq('id', id)
      .maybeSingle()
    return throwIfError(res)
  },

  async crea(payload) {
    const res = await supabase.from('irrigazione_giardini').insert(payload).select().single()
    return throwIfError(res)
  },

  async aggiorna(id, payload) {
    const res = await supabase
      .from('irrigazione_giardini')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    return throwIfError(res)
  },
}

// ---------------------------------------------------------------------------
// Stazioni
// ---------------------------------------------------------------------------
export const stazioniApi = {
  async lista(giardinoId) {
    const res = await supabase
      .from('irrigazione_stazioni')
      .select('*')
      .eq('giardino_id', giardinoId)
      .order('numero', { ascending: true })
    return throwIfError(res)
  },

  async crea(payload) {
    const res = await supabase.from('irrigazione_stazioni').insert(payload).select().single()
    return throwIfError(res)
  },

  async aggiorna(id, payload) {
    const res = await supabase.from('irrigazione_stazioni').update(payload).eq('id', id).select().single()
    return throwIfError(res)
  },

  async elimina(id) {
    const res = await supabase.from('irrigazione_stazioni').delete().eq('id', id)
    return throwIfError(res)
  },
}

// ---------------------------------------------------------------------------
// Punti
// ---------------------------------------------------------------------------
export const puntiApi = {
  async lista(giardinoId) {
    const res = await supabase
      .from('irrigazione_punti')
      .select('*')
      .eq('giardino_id', giardinoId)
      .order('created_at', { ascending: true })
    return throwIfError(res)
  },

  async crea(payload) {
    const res = await supabase.from('irrigazione_punti').insert(payload).select().single()
    return throwIfError(res)
  },

  async creaMassivo(payloads) {
    if (!payloads.length) return []
    const res = await supabase.from('irrigazione_punti').insert(payloads).select()
    return throwIfError(res)
  },

  async aggiorna(id, payload) {
    const res = await supabase.from('irrigazione_punti').update(payload).eq('id', id).select().single()
    return throwIfError(res)
  },

  async elimina(id) {
    const res = await supabase.from('irrigazione_punti').delete().eq('id', id)
    return throwIfError(res)
  },
}

// ---------------------------------------------------------------------------
// Sessioni
// ---------------------------------------------------------------------------
export const sessioniApi = {
  async lista(giardinoId) {
    const res = await supabase
      .from('irrigazione_sessioni')
      .select('*, irrigazione_stazioni(numero, nome)')
      .eq('giardino_id', giardinoId)
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })
    return throwIfError(res)
  },

  async listaPerData(giardinoId, data) {
    const res = await supabase
      .from('irrigazione_sessioni')
      .select('*, irrigazione_stazioni(numero, nome)')
      .eq('giardino_id', giardinoId)
      .eq('data', data)
      .order('created_at', { ascending: true })
    return throwIfError(res)
  },

  async ottieni(id) {
    const res = await supabase
      .from('irrigazione_sessioni')
      .select('*, irrigazione_stazioni(id, numero, nome), irrigazione_giardini(id, luogo, mappa_immagine_url, centralina_modello, cliente_id, clienti(nome_completo))')
      .eq('id', id)
      .maybeSingle()
    return throwIfError(res)
  },

  async crea(payload) {
    const res = await supabase.from('irrigazione_sessioni').insert(payload).select().single()
    return throwIfError(res)
  },

  async aggiorna(id, payload) {
    const res = await supabase.from('irrigazione_sessioni').update(payload).eq('id', id).select().single()
    return throwIfError(res)
  },

  async elimina(id) {
    const res = await supabase.from('irrigazione_sessioni').delete().eq('id', id)
    return throwIfError(res)
  },
}

// ---------------------------------------------------------------------------
// Letture
// ---------------------------------------------------------------------------
export const lettureApi = {
  async listaPerSessione(sessioneId) {
    const res = await supabase
      .from('irrigazione_letture')
      .select('*, irrigazione_punti(id, codice, pos_x, pos_y, stazione_id)')
      .eq('sessione_id', sessioneId)
    return throwIfError(res)
  },

  async salvaMassivo(letture) {
    if (!letture.length) return []
    const res = await supabase
      .from('irrigazione_letture')
      .upsert(letture, { onConflict: 'sessione_id,punto_id' })
      .select()
    return throwIfError(res)
  },
}

// ---------------------------------------------------------------------------
// Fabbisogno mensile
// ---------------------------------------------------------------------------
export const fabbisognoApi = {
  async lista() {
    const res = await supabase.from('irrigazione_fabbisogno_mensile').select('*').order('mese', { ascending: true })
    return throwIfError(res)
  },

  async aggiorna(mese, mmGiorno) {
    const res = await supabase
      .from('irrigazione_fabbisogno_mensile')
      .upsert({ mese, mm_giorno: mmGiorno }, { onConflict: 'mese' })
      .select()
      .single()
    return throwIfError(res)
  },
}
