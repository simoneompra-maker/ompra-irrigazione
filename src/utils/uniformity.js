// Calcoli statistici sul test di uniformità di irrigazione (catch-cup test)

/**
 * Calcola le statistiche di uniformità a partire da un array di valori in mm.
 * @param {number[]} valori
 * @returns {{n:number, media:number, min:number, max:number, duLq:number, cu:number}|null}
 */
export function calcolaStatistiche(valori) {
  const puliti = (valori || []).filter((v) => typeof v === 'number' && !Number.isNaN(v))
  const n = puliti.length
  if (n === 0) return null

  const somma = puliti.reduce((acc, v) => acc + v, 0)
  const media = somma / n
  const min = Math.min(...puliti)
  const max = Math.max(...puliti)

  // DU_lq: media del 25% (quarto) più basso dei valori, diviso la media generale
  const ordinati = [...puliti].sort((a, b) => a - b)
  const numeroQuarto = Math.max(1, Math.round(n * 0.25))
  const quartoInferiore = ordinati.slice(0, numeroQuarto)
  const mediaQuartoInferiore = quartoInferiore.reduce((acc, v) => acc + v, 0) / quartoInferiore.length
  const duLq = media > 0 ? (mediaQuartoInferiore / media) * 100 : 0

  // CU di Christiansen: 1 - (somma degli scarti assoluti dalla media / (n * media))
  const scartiAssoluti = puliti.reduce((acc, v) => acc + Math.abs(v - media), 0)
  const cu = media > 0 ? (1 - scartiAssoluti / (n * media)) * 100 : 0

  return { n, media, min, max, duLq, cu }
}

/**
 * Restituisce l'etichetta qualitativa e i colori Tailwind associati al valore di DU_lq.
 * Soglie standard di settore: >=80% eccellente, 70-79% buono, <70% da migliorare.
 */
export function qualitaDuLq(duLq) {
  if (duLq == null || Number.isNaN(duLq)) {
    return { label: 'N/D', livello: 'neutro', text: 'text-gray-500', bg: 'bg-gray-100', dot: 'bg-gray-400' }
  }
  if (duLq >= 80) {
    return { label: 'Eccellente', livello: 'buono', text: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500' }
  }
  if (duLq >= 70) {
    return { label: 'Buono', livello: 'medio', text: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500' }
  }
  return { label: 'Da migliorare', livello: 'scarso', text: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500' }
}

/**
 * Colore (stringa hex) da rosso (valore basso) a verde (valore alto) in base
 * alla posizione relativa del valore rispetto a min/max della sessione.
 */
export function coloreHeatmap(valore, min, max) {
  if (valore == null || Number.isNaN(valore)) return '#9ca3af'
  let ratio = 0.5
  if (max > min) {
    ratio = (valore - min) / (max - min)
  }
  ratio = Math.max(0, Math.min(1, ratio))
  const hue = ratio * 120 // 0 = rosso, 120 = verde
  return `hsl(${hue.toFixed(0)}, 75%, 45%)`
}
