// Palette per distinguere le stazioni sulla mappa (colori ben distinguibili
// anche sotto sole diretto su schermo piccolo).
export const PALETTE_STAZIONI = [
  '#2563eb', // blu
  '#dc2626', // rosso
  '#d97706', // arancio
  '#7c3aed', // viola
  '#0891b2', // ciano
  '#db2777', // magenta
  '#65a30d', // verde lime
  '#0f766e', // teal
  '#ca8a04', // giallo scuro
  '#4338ca', // indaco
]

export const COLORE_NESSUNA_STAZIONE = '#6b7280' // grigio

export function coloreStazione(stazioneId, stazioni) {
  if (!stazioneId) return COLORE_NESSUNA_STAZIONE
  const idx = stazioni.findIndex((s) => s.id === stazioneId)
  if (idx === -1) return COLORE_NESSUNA_STAZIONE
  return PALETTE_STAZIONI[idx % PALETTE_STAZIONI.length]
}
