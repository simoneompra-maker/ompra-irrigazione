import { formattaData } from '../utils/format'

/**
 * Grafico a linee minimale (SVG puro, nessuna libreria) dell'andamento del
 * DU_lq nel tempo, per confrontare visivamente prima/dopo un intervento.
 */
export default function StoricoChart({ punti }) {
  // punti: [{data, duLq}] già ordinati per data crescente
  if (!punti || punti.length === 0) return null

  const larghezza = 100
  const altezza = 40
  const padding = 6
  const n = punti.length

  const xFor = (i) => (n === 1 ? larghezza / 2 : padding + (i / (n - 1)) * (larghezza - padding * 2))
  const yFor = (v) => {
    const clamped = Math.max(0, Math.min(100, v))
    return altezza - padding - (clamped / 100) * (altezza - padding * 2)
  }

  const coordinate = punti.map((p, i) => ({ x: xFor(i), y: yFor(p.duLq), ...p }))
  const path = coordinate.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')

  const sogliaBuono = yFor(80)
  const sogliaMedio = yFor(70)

  return (
    <div>
      <svg viewBox={`0 0 ${larghezza} ${altezza}`} className="w-full h-40" preserveAspectRatio="none">
        {/* fasce soglia */}
        <rect x="0" y="0" width={larghezza} height={sogliaBuono} fill="#dcfce7" />
        <rect x="0" y={sogliaBuono} width={larghezza} height={sogliaMedio - sogliaBuono} fill="#fef3c7" />
        <rect x="0" y={sogliaMedio} width={larghezza} height={altezza - sogliaMedio} fill="#fee2e2" />

        <path d={path} fill="none" stroke="#2f6b3a" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        {coordinate.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="1.6" fill="#2f6b3a" stroke="white" strokeWidth="0.6" />
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-gray-400 mt-1 px-1">
        <span>{formattaData(punti[0].data)}</span>
        {punti.length > 1 ? <span>{formattaData(punti[punti.length - 1].data)}</span> : null}
      </div>
    </div>
  )
}
