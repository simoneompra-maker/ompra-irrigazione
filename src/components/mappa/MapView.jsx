import { useRef, useState, useCallback } from 'react'

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_STEP = 0.5
const SOGLIA_DRAG_PX = 6

/**
 * Visualizzatore mappa con pan/zoom (scroll nativo + pulsanti +/-), pin
 * posizionati in percentuale (0-100) sull'immagine, overlay heatmap,
 * disegno poligono e cerchi (layer irrigatori). Componente riutilizzato sia
 * nella scheda giardino (modalità 'pins'/'poligono'/'irrigatori') sia nel
 * riepilogo sessione (heatmap, sola lettura).
 */
export default function MapView({
  imageUrl,
  height = 'h-[58vh]',
  pins = [], // [{id, x, y, color, label, draggable}]
  onPinClick,
  onPinDragEnd,
  heatPoints = [], // [{id, x, y, color, label}]
  polygonPoints = [], // [{x,y}]
  circles = [], // [{id, x, y, radiusPercent, color, label}]
  onTap,
  showZoomControls = true,
  hint,
  crosshair = false,
}) {
  const [zoom, setZoom] = useState(1)
  const wrapperRef = useRef(null)
  const dragStateRef = useRef(null)
  const [dragPos, setDragPos] = useState(null) // {id, x, y} mentre si trascina

  const posizioneDaEvento = useCallback((clientX, clientY) => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return null
    let x = ((clientX - rect.left) / rect.width) * 100
    let y = ((clientY - rect.top) / rect.height) * 100
    x = Math.max(0, Math.min(100, x))
    y = Math.max(0, Math.min(100, y))
    return { x, y }
  }, [])

  function handleWrapperClick(e) {
    // Se stiamo trascinando un pin non deve scattare anche il tap sfondo
    if (dragStateRef.current) return
    if (!onTap) return
    const pos = posizioneDaEvento(e.clientX, e.clientY)
    if (pos) onTap(pos.x, pos.y)
  }

  function handlePinPointerDown(e, pin) {
    if (!pin.draggable) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragStateRef.current = {
      id: pin.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    }
  }

  function handlePinPointerMove(e, pin) {
    const ds = dragStateRef.current
    if (!ds || ds.id !== pin.id) return
    const dx = e.clientX - ds.startClientX
    const dy = e.clientY - ds.startClientY
    if (Math.hypot(dx, dy) > SOGLIA_DRAG_PX) ds.moved = true
    if (!ds.moved) return
    const pos = posizioneDaEvento(e.clientX, e.clientY)
    if (pos) setDragPos({ id: pin.id, x: pos.x, y: pos.y })
  }

  function handlePinPointerUp(e, pin) {
    const ds = dragStateRef.current
    if (!ds || ds.id !== pin.id) return
    e.stopPropagation()
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (ds.moved) {
      const pos = posizioneDaEvento(e.clientX, e.clientY)
      if (pos) onPinDragEnd?.(pin.id, pos.x, pos.y)
    } else {
      onPinClick?.(pin)
    }
    dragStateRef.current = null
    setDragPos(null)
  }

  if (!imageUrl) {
    return (
      <div className={`${height} w-full rounded-2xl bg-brand-50 border-2 border-dashed border-brand-200 flex items-center justify-center text-brand-700 text-sm font-medium px-6 text-center`}>
        Nessuna immagine mappa caricata per questo giardino.
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        className={`${height} w-full rounded-2xl bg-gray-100 overflow-auto relative touch-pan-x touch-pan-y`}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div
          ref={wrapperRef}
          className="relative select-none"
          style={{ width: `${zoom * 100}%`, minWidth: '100%' }}
          onClick={handleWrapperClick}
        >
          <img
            src={imageUrl}
            alt="Mappa giardino"
            className="w-full h-auto block pointer-events-none"
            draggable={false}
          />

          {/* Cerchi (layer irrigatori) */}
          {circles.map((c) => (
            <div
              key={c.id}
              className="absolute rounded-full border-2 pointer-events-none"
              style={{
                left: `${c.x}%`,
                top: `${c.y}%`,
                width: `${c.radiusPercent * 2}%`,
                height: `${c.radiusPercent * 2}%`,
                transform: 'translate(-50%, -50%)',
                borderColor: c.color || '#2563eb',
                backgroundColor: `${c.color || '#2563eb'}33`,
              }}
            />
          ))}

          {/* Poligono in disegno */}
          {polygonPoints.length > 0 ? (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {polygonPoints.length >= 3 ? (
                <polygon
                  points={polygonPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(47,107,58,0.25)"
                  stroke="#2f6b3a"
                  strokeWidth="0.4"
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <polyline
                  points={polygonPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#2f6b3a"
                  strokeWidth="0.4"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          ) : null}
          {polygonPoints.map((p, i) => (
            <div
              key={`poly-${i}`}
              className="absolute rounded-full bg-brand-700 border-2 border-white shadow pointer-events-none"
              style={{ left: `${p.x}%`, top: `${p.y}%`, width: 12, height: 12, transform: 'translate(-50%, -50%)' }}
            />
          ))}

          {/* Heatmap (sola lettura) */}
          {heatPoints.map((p) => {
            const pos = dragPos?.id === p.id ? dragPos : p
            return (
              <div
                key={p.id}
                className="absolute flex flex-col items-center pointer-events-none"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div
                  className="rounded-full border-2 border-white shadow-md flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ width: 30, height: 30, backgroundColor: p.color }}
                >
                  {p.label}
                </div>
              </div>
            )
          })}

          {/* Pin punti (modalità edit / visualizzazione) */}
          {pins.map((pin) => {
            const pos = dragPos?.id === pin.id ? dragPos : pin
            return (
              <div
                key={pin.id}
                className="absolute flex flex-col items-center"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  transform: 'translate(-50%, -100%)',
                  touchAction: pin.draggable ? 'none' : 'auto',
                  cursor: pin.draggable ? 'grab' : 'pointer',
                }}
                onPointerDown={(e) => handlePinPointerDown(e, pin)}
                onPointerMove={(e) => handlePinPointerMove(e, pin)}
                onPointerUp={(e) => handlePinPointerUp(e, pin)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!dragStateRef.current) onPinClick?.(pin)
                }}
              >
                <div
                  className="rounded-full border-2 border-white shadow-md flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ width: 28, height: 28, backgroundColor: pin.color || '#2f6b3a' }}
                >
                  {pin.label}
                </div>
                <div className="w-0 h-0" style={{
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: `7px solid ${pin.color || '#2f6b3a'}`,
                  marginTop: -2,
                }} />
              </div>
            )
          })}

          {crosshair ? (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-6 h-0.5 bg-brand-700/40 absolute" />
              <div className="h-6 w-0.5 bg-brand-700/40 absolute" />
            </div>
          ) : null}
        </div>
      </div>

      {showZoomControls ? (
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
          <button
            type="button"
            className="btn bg-white shadow-md rounded-lg w-10 h-10 text-xl font-bold text-brand-800 border border-gray-200"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
            aria-label="Zoom avanti"
          >
            +
          </button>
          <button
            type="button"
            className="btn bg-white shadow-md rounded-lg w-10 h-10 text-xl font-bold text-brand-800 border border-gray-200"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
            aria-label="Zoom indietro"
          >
            −
          </button>
          {zoom !== 1 ? (
            <button
              type="button"
              className="btn bg-white shadow-md rounded-lg w-10 h-8 text-[10px] font-bold text-gray-500 border border-gray-200"
              onClick={() => setZoom(1)}
            >
              RESET
            </button>
          ) : null}
        </div>
      ) : null}

      {hint ? (
        <div className="absolute top-3 left-3 right-16 bg-white/95 shadow-sm rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 z-10">
          {hint}
        </div>
      ) : null}
    </div>
  )
}
