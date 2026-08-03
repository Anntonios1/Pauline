import { useState } from 'react'
import { AlertTriangle, Info, CheckCircle, Clock, ChevronDown, ChevronUp, Archive } from 'lucide-react'

const MOTIVOS_RECHAZO = [
  'No se relaciona con la actividad',
  'Contiene información privada',
  'Lenguaje irrespetuoso',
  'Información incorrecta',
  'Imagen no autorizada',
  'Contenido duplicado',
]

export default function ModerationCard({ item, onAprobar, onPedirCambios, onRechazar, onArchivar }) {
  const [expanded, setExpanded] = useState(false)
  const [showRechazo, setShowRechazo] = useState(false)
  const [observacion, setObservacion] = useState('')
  const [motivoRechazo, setMotivoRechazo] = useState('')

  const estadoConfig = {
    enviada:          { label: 'Pendiente',          cls: 'bg-yellow-100 text-yellow-800', icon: Clock },
    en_revision:      { label: 'En revisión',        cls: 'bg-blue-100 text-blue-800',    icon: Clock },
    pendiente:        { label: 'Pendiente',          cls: 'bg-yellow-100 text-yellow-800', icon: Clock },
    requiere_cambios: { label: 'Requiere cambios',   cls: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
    aprobada:         { label: 'Aprobada',           cls: 'bg-green-100 text-green-800', icon: CheckCircle },
    rechazada:        { label: 'Rechazada',          cls: 'bg-red-100 text-red-800',      icon: AlertTriangle },
    archivada:        { label: 'Archivada',          cls: 'bg-slate-100 text-slate-600',  icon: Archive },
  }
  const ec = estadoConfig[item.estado] || estadoConfig.enviada
  const EcIcon = ec.icon

  return (
    <div className="mod-card">
      {/* Portada adjunta: el moderador debe verla antes de aprobar, no solo el texto */}
      {item.imagen && (
        <div className="h-28 overflow-hidden bg-slate-100">
          <img src={item.imagen} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`ar-badge ${ec.cls}`}>
                <EcIcon size={11} />
                {ec.label}
              </span>
              <span className="ar-badge badge-estudiante">Estudiante</span>
            </div>
            <p className="font-extrabold text-slate-900">{item.titulo}</p>
            <p className="text-xs text-[color:var(--ar-muted)] font-semibold mt-0.5">
              {item.autor?.codigo} · {item.materia} · {item.tiempo}
            </p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0"
            aria-label={expanded ? 'Colapsar' : 'Expandir'}
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {/* Alertas automáticas */}
        {item.alertas?.length > 0 && (
          <div className="mt-2 space-y-1">
            {item.alertas.map((a, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg
                  ${a.tipo === 'warning' ? 'bg-yellow-50 text-yellow-800' : 'bg-blue-50 text-blue-800'}`}
              >
                {a.tipo === 'warning'
                  ? <AlertTriangle size={12} />
                  : <Info size={12} />}
                {a.texto}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vista previa del contenido */}
      <div className="px-4 py-3">
        <p className={`text-sm text-slate-700 leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>
          {item.contenido}
        </p>
        {item.fuente && (
          <p className="text-xs text-[color:var(--ar-muted)] mt-2">
            <span className="font-semibold">Fuente:</span> {item.fuente}
          </p>
        )}
        {item.observacion && (
          <div className="mt-3 p-3 bg-orange-50 rounded-xl border border-orange-100">
            <p className="text-xs font-bold text-orange-700 mb-1">Observación anterior:</p>
            <p className="text-xs text-orange-800">{item.observacion}</p>
          </div>
        )}
      </div>

      {/* Panel de observación para "Pedir cambios" */}
      {expanded && (
        <div className="px-4 pb-3">
          <textarea
            value={observacion}
            onChange={e => setObservacion(e.target.value)}
            placeholder="Escribe una observación para el estudiante (opcional para aprobar)..."
            className="ar-input resize-none text-sm"
            rows={3}
          />
        </div>
      )}

      {/* Panel de rechazo */}
      {showRechazo && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-xs font-bold text-slate-700">Selecciona el motivo de rechazo:</p>
          {MOTIVOS_RECHAZO.map(m => (
            <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="motivo"
                value={m}
                checked={motivoRechazo === m}
                onChange={() => setMotivoRechazo(m)}
                className="accent-red-500"
              />
              {m}
            </label>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2">
        <button
          onClick={() => onAprobar?.(item.id, observacion)}
          className="btn-sm font-bold text-sm text-white rounded-full px-4 py-2"
          style={{ background: '#22c55e' }}
        >
          ✅ Aprobar
        </button>
        <button
          onClick={() => onPedirCambios?.(item.id, observacion)}
          className="btn-sm font-bold text-sm bg-orange-100 text-orange-700 rounded-full px-4 py-2 hover:bg-orange-200 transition-colors"
        >
          ✏️ Pedir cambios
        </button>
        {!showRechazo ? (
          <button
            onClick={() => setShowRechazo(true)}
            className="btn-sm font-bold text-sm bg-red-100 text-red-700 rounded-full px-4 py-2 hover:bg-red-200 transition-colors"
          >
            ❌ Rechazar
          </button>
        ) : (
          <button
            onClick={() => { onRechazar?.(item.id, motivoRechazo); setShowRechazo(false) }}
            disabled={!motivoRechazo}
            className="btn-sm font-bold text-sm bg-red-600 text-white rounded-full px-4 py-2 disabled:opacity-40 transition-colors"
          >
            Confirmar rechazo
          </button>
        )}
        <button
          onClick={() => onArchivar?.(item.id)}
          className="btn-sm font-bold text-sm text-slate-500 hover:text-slate-700 rounded-full px-3 py-2 hover:bg-slate-200 transition-colors ml-auto"
        >
          Archivar
        </button>
      </div>
    </div>
  )
}
