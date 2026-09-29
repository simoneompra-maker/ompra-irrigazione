// Diagnostica avanzata sul test di uniformità: individua singoli punti sospetti
// dentro la propria zona e possibili sovrapposizioni tra zone confinanti.
// Sono euristiche basate sulla posizione percentuale dei punti sull'immagine
// della mappa (non una misura metrica reale) — soglie di partenza pensate per
// essere tarate sul campo, non valori assoluti.

// Un punto è "sospetto" se si scosta da questi rapporti rispetto alla media
// della propria zona (es. 0.6 = 60% della media, 1.4 = 140% della media).
export const SOGLIA_BASSA = 0.6
export const SOGLIA_ALTA = 1.4

// Due punti di zone diverse sono considerati "sullo stesso confine" se la loro
// distanza (in punti percentuali sull'immagine, 0-100 per entrambi gli assi)
// è entro questa soglia.
export const SOGLIA_DISTANZA_CONFINE = 3

// Una coppia di punti di confine è segnalata come possibile sovrapposizione
// quando la somma delle due letture supera questo multiplo della media
// generale dei punti della sessione.
export const SOGLIA_SOMMA_SOVRAPPOSIZIONE = 1.5

// Raggio massimo (in punti percentuali) entro cui un irrigatore viene proposto
// come "più vicino" a un punto segnalato; oltre non si suggerisce nulla.
export const RAGGIO_MAX_IRRIGATORE = 15

function distanzaPercentuale(a, b) {
  const ax = a.pos_x ?? a.x
  const ay = a.pos_y ?? a.y
  const bx = b.pos_x ?? b.x
  const by = b.pos_y ?? b.y
  if (ax == null || ay == null || bx == null || by == null) return Infinity
  const dx = ax - bx
  const dy = ay - by
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Punti che si scostano molto dalla media della propria zona (troppo bassi o
 * troppo alti) — possibile irrigatore vicino da controllare (storto, ugello
 * sporco/rotto, ad angolo zero, o troppo generoso).
 */
export function trovaAnomalie(gruppi, { sogliaBassa = SOGLIA_BASSA, sogliaAlta = SOGLIA_ALTA } = {}) {
  const trovate = []
  for (const gruppo of gruppi) {
    const media = gruppo.statistiche?.media
    if (!media) continue
    for (const riga of gruppo.righe) {
      if (riga.valore_mm == null) continue
      const rapporto = riga.valore_mm / media
      if (rapporto < sogliaBassa || rapporto > sogliaAlta) {
        trovate.push({
          codice: riga.codice,
          valore_mm: riga.valore_mm,
          pos_x: riga.pos_x,
          pos_y: riga.pos_y,
          media,
          rapporto,
          tipo: rapporto < sogliaBassa ? 'basso' : 'alto',
          zonaNome: gruppo.nome,
          zonaColore: gruppo.colore,
        })
      }
    }
  }
  return trovate
}

/**
 * Coppie di punti vicini sulla mappa ma appartenenti a zone (stazioni)
 * diverse: la somma delle due letture stima l'acqua totale ricevuta in
 * quell'area nel ciclo completo, perché le zone irrigano in momenti separati
 * (non è quindi un doppio conteggio di uno stesso passaggio, ma la somma di
 * due passaggi reali sullo stesso punto di prato).
 */
export function trovaSovrapposizioni(
  puntiConZona,
  { sogliaDistanza = SOGLIA_DISTANZA_CONFINE, sogliaSomma = SOGLIA_SOMMA_SOVRAPPOSIZIONE } = {}
) {
  const validi = puntiConZona.filter((p) => p.pos_x != null && p.pos_y != null && p.valore_mm != null)
  if (validi.length === 0) return []
  const mediaGenerale = validi.reduce((acc, p) => acc + p.valore_mm, 0) / validi.length

  const trovate = []
  for (let i = 0; i < validi.length; i++) {
    for (let j = i + 1; j < validi.length; j++) {
      const a = validi[i]
      const b = validi[j]
      if (a.stazioneId === b.stazioneId) continue // stessa zona: non è un confine
      const distanza = distanzaPercentuale(a, b)
      if (distanza > sogliaDistanza) continue
      const somma = a.valore_mm + b.valore_mm
      if (mediaGenerale > 0 && somma >= mediaGenerale * sogliaSomma) {
        trovate.push({ a, b, somma, distanza, mediaGenerale })
      }
    }
  }
  return trovate.sort((x, y) => y.somma - x.somma)
}

/** Irrigatore (layer visivo) più vicino a un punto, entro un raggio massimo. */
export function trovaIrrigatorePiuVicino(punto, irrigatori, raggioMax = RAGGIO_MAX_IRRIGATORE) {
  if (!irrigatori?.length) return null
  let migliore = null
  let distanzaMin = Infinity
  for (const irr of irrigatori) {
    const distanza = distanzaPercentuale(punto, irr)
    if (distanza < distanzaMin) {
      distanzaMin = distanza
      migliore = irr
    }
  }
  if (!migliore || distanzaMin > raggioMax) return null
  return { irrigatore: migliore, distanza: distanzaMin }
}
