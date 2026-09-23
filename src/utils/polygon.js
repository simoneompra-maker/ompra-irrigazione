// Utility geometriche per lo strumento "Distribuisci punti": l'utente disegna
// un poligono libero sulla mappa (coordinate in percentuale 0-100) e l'app
// distribuisce automaticamente N punti in modo uniforme al suo interno.

/**
 * Ray casting algorithm — true se il punto è dentro il poligono.
 * @param {{x:number,y:number}} point
 * @param {{x:number,y:number}[]} poligono
 */
export function puntoNelPoligono(point, poligono) {
  let dentro = false
  const n = poligono.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poligono[i].x
    const yi = poligono[i].y
    const xj = poligono[j].x
    const yj = poligono[j].y
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (intersect) dentro = !dentro
  }
  return dentro
}

function areaPoligono(poligono) {
  let area = 0
  const n = poligono.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += poligono[i].x * poligono[j].y
    area -= poligono[j].x * poligono[i].y
  }
  return Math.abs(area / 2)
}

/**
 * Distribuisce circa `numPunti` punti uniformemente (griglia) dentro il poligono.
 * Restituisce coordinate in percentuale {x,y} (0-100), lunghezza <= numPunti richiesti
 * (può essere leggermente inferiore se il poligono è molto piccolo/stretto rispetto
 * alla risoluzione della griglia).
 * @param {{x:number,y:number}[]} poligono almeno 3 vertici, coordinate percentuali
 * @param {number} numPunti quanti punti generare
 */
export function distribuisciPuntiInPoligono(poligono, numPunti) {
  if (!poligono || poligono.length < 3 || !numPunti || numPunti < 1) return []

  const xs = poligono.map((p) => p.x)
  const ys = poligono.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const larghezza = Math.max(maxX - minX, 0.001)
  const altezza = Math.max(maxY - minY, 0.001)
  const rapporto = larghezza / altezza

  // Aumenta progressivamente la risoluzione della griglia finché non troviamo
  // abbastanza punti interni al poligono da poter scegliere numPunti ben distribuiti.
  let candidati = []
  let risoluzione = Math.max(4, Math.ceil(Math.sqrt(numPunti * 2)))
  let tentativi = 0
  while (tentativi < 8) {
    const cols = Math.max(1, Math.round(risoluzione * Math.sqrt(rapporto)))
    const rows = Math.max(1, Math.round(risoluzione / Math.sqrt(rapporto)))
    candidati = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // celle centrate, con piccolo margine interno per non cadere esattamente sul bordo
        const x = minX + ((c + 0.5) / cols) * larghezza
        const y = minY + ((r + 0.5) / rows) * altezza
        if (puntoNelPoligono({ x, y }, poligono)) {
          candidati.push({ x, y, row: r, col: c })
        }
      }
    }
    if (candidati.length >= numPunti || risoluzione > 60) break
    risoluzione *= 1.6
    tentativi++
  }

  if (candidati.length === 0) {
    // fallback: usa il centroide del poligono
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length
    const cy = ys.reduce((a, b) => a + b, 0) / ys.length
    return [{ x: cx, y: cy }]
  }

  if (candidati.length <= numPunti) {
    return candidati.map(({ x, y }) => ({ x, y }))
  }

  // Troppi candidati: campiona in modo uniforme (passo costante) mantenendo
  // l'ordine a griglia (riga per riga) per una distribuzione visivamente regolare.
  const step = candidati.length / numPunti
  const selezionati = []
  for (let i = 0; i < numPunti; i++) {
    const idx = Math.min(candidati.length - 1, Math.floor(i * step))
    selezionati.push(candidati[idx])
  }
  return selezionati.map(({ x, y }) => ({
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  }))
}

export { areaPoligono }
