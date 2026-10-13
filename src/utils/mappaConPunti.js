// Ricompone la foto del giardino con sopra evidenziati solo i punti segnalati
// dalla diagnostica (utils/diagnostica.js), per includerla nel PDF "Punti da
// verificare sul campo" — così chi legge il report sa subito dove guardare
// senza dover tornare sulla mappa a colori o sull'app.

/**
 * @param {object} params
 * @param {string} params.imageUrl foto del giardino (giardino.mappa_immagine_url)
 * @param {Array} params.anomalie punti anomali dentro la propria zona (da trovaAnomalie)
 * @param {Array} params.sovrapposizioni coppie di punti di confine (da trovaSovrapposizioni)
 * @returns {Promise<string|null>} data URL JPEG dell'immagine composta, o null se non disponibile
 */
export function generaMappaPuntiSegnalati({ imageUrl, anomalie = [], sovrapposizioni = [] }) {
  return new Promise((resolve) => {
    if (!imageUrl || (anomalie.length === 0 && sovrapposizioni.length === 0)) {
      resolve(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)

        const raggio = Math.max(10, Math.round(canvas.width * 0.014))

        const disegnaPunto = (posX, posY, colore, etichetta) => {
          if (posX == null || posY == null) return
          const x = (posX / 100) * canvas.width
          const y = (posY / 100) * canvas.height
          ctx.beginPath()
          ctx.arc(x, y, raggio, 0, Math.PI * 2)
          ctx.fillStyle = colore
          ctx.globalAlpha = 0.92
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.lineWidth = Math.max(2, raggio * 0.18)
          ctx.strokeStyle = '#ffffff'
          ctx.stroke()
          ctx.fillStyle = '#ffffff'
          ctx.font = `bold ${Math.round(raggio * 1.05)}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(etichetta), x, y)
        }

        // Linee tratteggiate tra le coppie in sovrapposizione, disegnate per prime
        // (sotto ai pallini)
        sovrapposizioni.forEach((s) => {
          if (s.a.pos_x == null || s.b.pos_x == null) return
          const ax = (s.a.pos_x / 100) * canvas.width
          const ay = (s.a.pos_y / 100) * canvas.height
          const bx = (s.b.pos_x / 100) * canvas.width
          const by = (s.b.pos_y / 100) * canvas.height
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(bx, by)
          ctx.strokeStyle = '#9333ea'
          ctx.lineWidth = Math.max(2, raggio * 0.25)
          ctx.setLineDash([raggio * 0.5, raggio * 0.5])
          ctx.stroke()
          ctx.setLineDash([])
        })

        sovrapposizioni.forEach((s) => {
          disegnaPunto(s.a.pos_x, s.a.pos_y, '#9333ea', s.a.codice)
          disegnaPunto(s.b.pos_x, s.b.pos_y, '#9333ea', s.b.codice)
        })

        anomalie.forEach((a) => {
          disegnaPunto(a.pos_x, a.pos_y, a.tipo === 'basso' ? '#dc2626' : '#2563eb', a.codice)
        })

        resolve(canvas.toDataURL('image/jpeg', 0.85))
      } catch {
        // Immagine non componibile (es. CORS sulla fonte): il PDF prosegue senza,
        // con solo le tabelle testuali.
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = imageUrl
  })
}
