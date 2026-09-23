// Calcolo della programmazione consigliata (minuti in centralina) a partire
// dai risultati del test di uniformità e dalla tabella fabbisogno mensile.

export const NOMI_MESI = {
  1: 'Gennaio',
  2: 'Febbraio',
  3: 'Marzo',
  4: 'Aprile',
  5: 'Maggio',
  6: 'Giugno',
  7: 'Luglio',
  8: 'Agosto',
  9: 'Settembre',
  10: 'Ottobre',
  11: 'Novembre',
  12: 'Dicembre',
}

export const DEFAULT_PERCENTUALE_DEFICIT = 0.85
export const DEFAULT_CICLI_SETTIMANA = 2

/**
 * @param {object} params
 * @param {{mese:number, mm_giorno:number}[]} params.fabbisogno tabella irrigazione_fabbisogno_mensile
 * @param {number} params.mediaMm media dei valori mm della sessione
 * @param {number} params.durataMinuti durata del test in minuti
 * @param {number} [params.percentualeDeficit] default 0.85 (85%)
 * @param {number} [params.cicliSettimana] default 2
 */
export function calcolaProgrammazione({
  fabbisogno,
  mediaMm,
  durataMinuti,
  percentualeDeficit = DEFAULT_PERCENTUALE_DEFICIT,
  cicliSettimana = DEFAULT_CICLI_SETTIMANA,
}) {
  if (!fabbisogno || fabbisogno.length === 0) return null
  if (!mediaMm || !durataMinuti || durataMinuti <= 0) return null

  const portata = mediaMm / durataMinuti // mm al minuto
  if (portata <= 0) return null

  const picco = fabbisogno.reduce((a, b) => (b.mm_giorno > a.mm_giorno ? b : a))
  const fabbisognoSettimanalePiccoRidotto = picco.mm_giorno * 7 * percentualeDeficit
  const minutiBase = fabbisognoSettimanalePiccoRidotto / cicliSettimana / portata

  const mesi = [...fabbisogno]
    .sort((a, b) => a.mese - b.mese)
    .map((m) => {
      const percentuale = picco.mm_giorno > 0 ? (m.mm_giorno / picco.mm_giorno) * 100 : 0
      return {
        mese: m.mese,
        nome: NOMI_MESI[m.mese] || `Mese ${m.mese}`,
        mmGiorno: m.mm_giorno,
        percentuale,
        minuti: minutiBase * (percentuale / 100),
        ePicco: m.mese === picco.mese,
      }
    })

  return {
    picco: { mese: picco.mese, nome: NOMI_MESI[picco.mese] || `Mese ${picco.mese}`, mmGiorno: picco.mm_giorno },
    portata,
    minutiBase,
    cicliSettimana,
    percentualeDeficit,
    mesi,
  }
}
