import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formattaData } from './format'
import { qualitaDuLq } from './uniformity'

const VERDE = [47, 107, 58]
const GRIGIO = [90, 90, 90]
// Colori per livello di qualità (DU quarto inferiore), coerenti con qualitaDuLq()
const COLORI_QUALITA = {
  buono: [22, 130, 68], // eccellente
  medio: [180, 95, 6], // buono ma da tenere d'occhio
  scarso: [200, 30, 30], // da migliorare
  neutro: [110, 110, 110],
}

function intestazione(doc, { cliente, giardino, sessione }) {
  doc.setFillColor(...VERDE)
  doc.rect(0, 0, 210, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('OMPRA — Test di uniformità irrigazione', 14, 14)

  doc.setTextColor(20, 20, 20)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  let y = 30
  const riga = (label, valore) => {
    doc.setFont('helvetica', 'bold')
    doc.text(`${label}:`, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(valore ?? '—'), 45, y)
    y += 6
  }
  riga('Cliente', cliente?.nome_completo)
  riga('Giardino', giardino?.luogo)
  riga('Data test', formattaData(sessione?.data))
  riga('Stazione', sessione?.irrigazione_stazioni ? `${sessione.irrigazione_stazioni.numero || ''} ${sessione.irrigazione_stazioni.nome || ''}`.trim() : 'Non specificata')
  if (sessione?.durata_minuti) riga('Durata test', `${sessione.durata_minuti} min`)
  if (giardino?.centralina_modello) riga('Centralina', giardino.centralina_modello)
  if (sessione?.note) riga('Note', sessione.note)
  return y + 2
}

function sezioneStatistiche(doc, y, statistiche) {
  if (!statistiche) return y
  const q = qualitaDuLq(statistiche.duLq)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...VERDE)
  doc.text('Statistiche di uniformità', 14, y)
  y += 6

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: VERDE, textColor: 255 },
    head: [['Media (mm)', 'Min (mm)', 'Max (mm)', 'DU (quarto inf.)', 'CU Christiansen', 'Valutazione']],
    body: [[
      statistiche.media.toFixed(1),
      statistiche.min.toFixed(1),
      statistiche.max.toFixed(1),
      `${statistiche.duLq.toFixed(0)}%`,
      `${statistiche.cu.toFixed(0)}%`,
      q.label,
    ]],
    margin: { left: 14, right: 14 },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 5) {
        data.cell.styles.textColor = COLORI_QUALITA[q.livello] || COLORI_QUALITA.neutro
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  return doc.lastAutoTable.finalY + 8
}

function sezioneLetture(doc, y, righe) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...VERDE)
  doc.text('Letture pluviometri', 14, y)
  y += 6

  autoTable(doc, {
    startY: y,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: VERDE, textColor: 255 },
    head: [['Punto', 'Valore (mm)']],
    body: righe.map((r) => [r.codice, r.valore_mm != null ? r.valore_mm.toFixed(1) : '—']),
    margin: { left: 14, right: 14 },
    columnStyles: { 0: { cellWidth: 40 } },
  })
  return doc.lastAutoTable.finalY + 8
}

function sezioneProgrammazione(doc, y, programmazione) {
  if (!programmazione) return y
  if (y > 240) {
    doc.addPage()
    y = 20
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...VERDE)
  doc.text('Programmazione consigliata centralina', 14, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...GRIGIO)
  doc.text(
    `Portata stimata: ${programmazione.portata.toFixed(2)} mm/min · Mese di picco: ${programmazione.picco.nome} (${programmazione.picco.mmGiorno} mm/giorno)`,
    14,
    y
  )
  y += 5
  doc.text(
    `Deficit irriguo: ${(programmazione.percentualeDeficit * 100).toFixed(0)}% · Cicli/settimana: ${programmazione.cicliSettimana}`,
    14,
    y
  )
  y += 7

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20, 20, 20)
  doc.text(
    `Programma base (${programmazione.picco.nome}): ${Math.round(programmazione.minutiBase)} minuti, ${programmazione.cicliSettimana} cicli/settimana`,
    14,
    y
  )
  y += 6

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: VERDE, textColor: 255 },
    head: [['Mese', 'Fabbisogno (mm/g)', '% stagionale', 'Minuti consigliati']],
    body: programmazione.mesi.map((m) => [
      m.nome + (m.ePicco ? ' (picco)' : ''),
      m.mmGiorno.toFixed(1),
      `${m.percentuale.toFixed(0)}%`,
      Math.round(m.minuti),
    ]),
    margin: { left: 14, right: 14 },
  })
  return doc.lastAutoTable.finalY + 8
}

/** Esporta il PDF di una singola sessione/stazione. */
export function esportaPdfSessione({ cliente, giardino, sessione, righe, statistiche, programmazione }) {
  const doc = new jsPDF()
  let y = intestazione(doc, { cliente, giardino, sessione })
  y = sezioneStatistiche(doc, y, statistiche)
  y = sezioneLetture(doc, y, righe)
  y = sezioneProgrammazione(doc, y, programmazione)

  piePagina(doc)
  const nomeFile = `test-irrigazione_${(giardino?.luogo || 'giardino').replace(/\s+/g, '-')}_${sessione?.data || ''}.pdf`
  doc.save(nomeFile)
}

/** Esporta un PDF riepilogo visita con più stazioni testate nella stessa data. */
export function esportaPdfRiepilogoVisita({ cliente, giardino, data, sezioni }) {
  const doc = new jsPDF()
  doc.setFillColor(...VERDE)
  doc.rect(0, 0, 210, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(15)
  doc.setFont('helvetica', 'bold')
  doc.text('OMPRA — Riepilogo visita test irrigazione', 14, 14)
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  let y = 30
  doc.setFont('helvetica', 'bold')
  doc.text('Cliente:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text(String(cliente?.nome_completo || '—'), 45, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Giardino:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text(String(giardino?.luogo || '—'), 45, y)
  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Data visita:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text(formattaData(data), 45, y)
  y += 10

  const sezioniConTitolo = sezioni.map((sez) => ({
    ...sez,
    titolo:
      sez.titolo ||
      `Stazione: ${sez.sessione?.irrigazione_stazioni ? `${sez.sessione.irrigazione_stazioni.numero || ''} ${sez.sessione.irrigazione_stazioni.nome || ''}`.trim() : 'Non specificata'}`,
  }))

  // Riepilogo a colpo d'occhio: quando ci sono più zone, mostra subito quali
  // necessitano di attenzione, ordinate dalla peggiore alla migliore.
  if (sezioniConTitolo.length > 1) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...VERDE)
    doc.text('Riepilogo a colpo d\'occhio', 14, y)
    y += 6

    const righeRiepilogo = sezioniConTitolo
      .map((sez) => ({ sez, q: qualitaDuLq(sez.statistiche?.duLq) }))
      .sort((a, b) => (a.sez.statistiche?.duLq ?? 999) - (b.sez.statistiche?.duLq ?? 999))

    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: VERDE, textColor: 255 },
      head: [['Zona', 'DU (quarto inf.)', 'CU Christiansen', 'Valutazione']],
      body: righeRiepilogo.map(({ sez, q }) => [
        sez.titolo.replace(/^(Zona|Stazione):\s*/, ''),
        sez.statistiche ? `${sez.statistiche.duLq.toFixed(0)}%` : '—',
        sez.statistiche ? `${sez.statistiche.cu.toFixed(0)}%` : '—',
        q.label,
      ]),
      margin: { left: 14, right: 14 },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 3) {
          const livello = righeRiepilogo[data.row.index].q.livello
          data.cell.styles.textColor = COLORI_QUALITA[livello] || COLORI_QUALITA.neutro
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  sezioniConTitolo.forEach((sez, idx) => {
    if (idx > 0 || sezioniConTitolo.length > 1) {
      doc.addPage()
      y = 20
    }
    const q = qualitaDuLq(sez.statistiche?.duLq)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...(COLORI_QUALITA[q.livello] || VERDE))
    doc.text(sez.titolo, 14, y)
    y += 8
    y = sezioneStatistiche(doc, y, sez.statistiche)
    y = sezioneLetture(doc, y, sez.righe)
    y = sezioneProgrammazione(doc, y, sez.programmazione)
  })

  piePagina(doc)
  const nomeFile = `riepilogo-visita_${(giardino?.luogo || 'giardino').replace(/\s+/g, '-')}_${data || ''}.pdf`
  doc.save(nomeFile)
}

function piePagina(doc) {
  const pagine = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pagine; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `OMPRA · Test irrigazione · generato il ${new Date().toLocaleDateString('it-IT')} · pag. ${i}/${pagine}`,
      14,
      290
    )
  }
}
