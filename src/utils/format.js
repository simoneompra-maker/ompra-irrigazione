export function formattaData(dataStr) {
  if (!dataStr) return '—'
  try {
    const d = new Date(dataStr.length <= 10 ? `${dataStr}T00:00:00` : dataStr)
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dataStr
  }
}

export function formattaDataOra(dataStr) {
  if (!dataStr) return '—'
  try {
    const d = new Date(dataStr)
    return d.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dataStr
  }
}

export function numero(v, decimali = 1) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali })
}

export function oggiISO() {
  const d = new Date()
  const tz = d.getTimezoneOffset()
  const local = new Date(d.getTime() - tz * 60000)
  return local.toISOString().slice(0, 10)
}
