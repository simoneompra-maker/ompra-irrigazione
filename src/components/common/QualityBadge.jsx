import { qualitaDuLq } from '../../utils/uniformity'

export default function QualityBadge({ duLq, size = 'md' }) {
  const q = qualitaDuLq(duLq)
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${q.bg} ${q.text} ${padding}`}>
      <span className={`inline-block rounded-full ${q.dot}`} style={{ width: 8, height: 8 }} />
      {q.label}
      {duLq != null && !Number.isNaN(duLq) ? ` · ${duLq.toFixed(0)}%` : ''}
    </span>
  )
}

export function PallinoQualita({ duLq }) {
  const q = qualitaDuLq(duLq)
  return <span className={`inline-block rounded-full ${q.dot}`} style={{ width: 12, height: 12 }} title={q.label} />
}
