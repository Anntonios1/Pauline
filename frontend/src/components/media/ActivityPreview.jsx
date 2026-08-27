import { BookOpen, CheckCircle, ClipboardList, Lock, Play } from 'lucide-react'

const ICONO_POR_TIPO = { publicacion: BookOpen, actividad: ClipboardList }

/**
 * Tarjeta de un paso de "Mi Ruta" (lectura o actividad), con su estado de
 * desbloqueo ya resuelto por el backend (LOCKED/AVAILABLE/IN_PROGRESS/
 * COMPLETED). Reusada por MyRoutePage (modo estudiante, clickeable) y por
 * RouteManagerPage (modo docente, solo lectura, para previsualizar el
 * módulo antes de publicarlo).
 */
export default function ActivityPreview({ paso, onOpen, readOnly = false }) {
  const Icono = ICONO_POR_TIPO[paso.tipo_paso] || BookOpen
  const isCompleted = paso.estado === 'COMPLETED'
  const isLocked = paso.estado === 'LOCKED'
  const isInProgress = paso.estado === 'IN_PROGRESS'
  const isActive = isInProgress || paso.estado === 'AVAILABLE'
  const clickable = !readOnly && !isLocked && typeof onOpen === 'function'

  return (
    <button
      type="button"
      onClick={() => clickable && onOpen(paso)}
      disabled={!clickable}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
        ${isActive ? 'bg-[color:var(--ar-primary-light)] hover:bg-teal-100' : ''}
        ${isCompleted ? 'hover:bg-slate-50' : ''}
        ${isLocked || readOnly ? 'cursor-default' : 'cursor-pointer'}
        ${isLocked ? 'opacity-50' : ''}`}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
        ${isCompleted ? 'bg-green-100 text-green-600' : isActive ? 'bg-[color:var(--ar-primary)] text-white' : 'bg-slate-100 text-slate-400'}`}>
        {isCompleted ? <CheckCircle size={14} /> : isLocked ? <Lock size={12} /> : <Icono size={13} />}
      </div>
      <span className={`text-sm font-semibold flex-1 truncate
        ${isActive ? 'text-[color:var(--ar-primary-dark)] font-extrabold' : isCompleted ? 'text-slate-500 line-through' : 'text-slate-400'}`}>
        {paso.titulo}
      </span>
      {!paso.obligatorio && (
        <span className="text-[10px] uppercase tracking-wide text-[color:var(--ar-muted)] font-bold flex-shrink-0">
          Opcional
        </span>
      )}
      {isInProgress && <Play size={16} className="text-[color:var(--ar-primary)] flex-shrink-0" />}
    </button>
  )
}
