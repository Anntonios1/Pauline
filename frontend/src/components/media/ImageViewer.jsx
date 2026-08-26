import { useCallback, useEffect, useRef, useState } from 'react'
import { Maximize2, Minus, Plus, X } from 'lucide-react'

const ZOOM_MIN = 1
const ZOOM_MAX = 5
const ZOOM_PASO = 0.5

/**
 * Lightbox de imagen con zoom y desplazamiento. Se usa tanto desde
 * MediaEngine (bloques de quiz, recursos) como desde las tarjetas del feed,
 * para que ampliar una imagen se comporte igual en toda la app.
 */
export default function ImageViewer({ url, alt = '', onClose }) {
  const [zoom, setZoom] = useState(1)
  const [desplazamiento, setDesplazamiento] = useState({ x: 0, y: 0 })
  const arrastrando = useRef(null)

  const acercar = useCallback(() => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_PASO)), [])
  const alejar = useCallback(() => setZoom(z => {
    const siguiente = Math.max(ZOOM_MIN, z - ZOOM_PASO)
    // Al volver al 100% se recentra: si no, la imagen queda fuera de vista.
    if (siguiente === ZOOM_MIN) setDesplazamiento({ x: 0, y: 0 })
    return siguiente
  }), [])

  const restablecer = useCallback(() => {
    setZoom(1)
    setDesplazamiento({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const alPulsar = (event) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === '+' || event.key === '=') acercar()
      else if (event.key === '-') alejar()
      else if (event.key === '0') restablecer()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [onClose, acercar, alejar, restablecer])

  function iniciarArrastre(event) {
    if (zoom === ZOOM_MIN) return
    arrastrando.current = {
      x: event.clientX - desplazamiento.x,
      y: event.clientY - desplazamiento.y,
    }
  }

  function moverArrastre(event) {
    if (!arrastrando.current) return
    setDesplazamiento({
      x: event.clientX - arrastrando.current.x,
      y: event.clientY - arrastrando.current.y,
    })
  }

  function terminarArrastre() {
    arrastrando.current = null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
      onClick={onClose}
      onMouseMove={moverArrastre}
      onMouseUp={terminarArrastre}
      onMouseLeave={terminarArrastre}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute right-4 top-4 flex items-center gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={alejar} disabled={zoom <= ZOOM_MIN}
          className="rounded-full bg-white/15 p-2 text-white hover:bg-white/25 disabled:opacity-40"
          aria-label="Alejar">
          <Minus size={20} />
        </button>
        <span className="min-w-[3.5rem] text-center text-sm font-bold text-white">
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" onClick={acercar} disabled={zoom >= ZOOM_MAX}
          className="rounded-full bg-white/15 p-2 text-white hover:bg-white/25 disabled:opacity-40"
          aria-label="Acercar">
          <Plus size={20} />
        </button>
        <button type="button" onClick={restablecer}
          className="rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          aria-label="Restablecer zoom">
          <Maximize2 size={18} />
        </button>
        <button type="button" onClick={onClose}
          className="rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          aria-label="Cerrar">
          <X size={22} />
        </button>
      </div>

      <img
        src={url}
        alt={alt}
        draggable={false}
        onClick={(event) => event.stopPropagation()}
        onMouseDown={iniciarArrastre}
        className="max-h-full max-w-full select-none object-contain transition-transform duration-100"
        style={{
          transform: `translate(${desplazamiento.x}px, ${desplazamiento.y}px) scale(${zoom})`,
          cursor: zoom > ZOOM_MIN ? (arrastrando.current ? 'grabbing' : 'grab') : 'default',
        }}
      />

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60">
        Arrastra para mover · + / − para acercar · Esc para cerrar
      </p>
    </div>
  )
}
