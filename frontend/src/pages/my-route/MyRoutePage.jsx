import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../contexts/DataContext'
import { useReadPublicationIds } from '../../hooks/useMyPublications'
import { CheckCircle, Lock, Play, ChevronRight, Star, BookOpen, ClipboardList } from 'lucide-react'

function calculateOverall(progress) {
  if (!progress?.length) return 0
  const done = progress.filter(p => p.mejor_porcentaje === 100).length
  return Math.round((done / progress.length) * 100)
}

export default function MyRoutePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { progress, categories, publications, activities, logros } = useData()
  const readIds = useReadPublicationIds()
  const overall = calculateOverall(progress)

  const learningPath = categories.map((cat, ui) => {
    const lecturas = publications.filter(p => p.categoria_id === cat.id)
    const act = activities.filter(a => a.categoria_id === cat.id)
    const pasos = [
      ...lecturas.map(pub => ({
        id: `pub-${pub.id}`,
        titulo: pub.titulo,
        tipo: 'lectura',
        slug: pub.slug,
        estado: readIds.has(pub.id) ? 'completado' : 'activo',
      })),
      ...act.map(a => {
        const prog = progress.find(p => Number(p.id) === Number(a.id))
        return {
          id: `act-${a.id}`,
          titulo: a.titulo,
          tipo: 'actividad',
          actividad_id: a.id,
          estado: prog?.mejor_porcentaje === 100 ? 'completado' : 'activo',
        }
      }),
    ]
    const completados = pasos.filter(p => p.estado === 'completado').length
    const todosCompletados = pasos.length > 0 && completados === pasos.length
    return {
      id: cat.id,
      titulo: `${ui + 1}. ${cat.nombre}`,
      pasos,
      completados,
      todosCompletados,
      tieneActivo: !todosCompletados,
    }
  })

  return (
    <div className="feed-container pb-4 fade-in">
      {/* Cabecera con progreso */}
      <div className="ar-card p-5 mb-4 bg-gradient-to-br from-[color:var(--ar-primary)] to-teal-700 text-white">
        <h1 className="text-lg font-extrabold mb-1">Mi ruta de aprendizaje</h1>
        <p className="text-sm opacity-80 mb-4">Reproducción humana · Grado 5.°</p>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="w-full bg-white/30 rounded-full h-3">
              <div
                className="h-3 bg-white rounded-full transition-all duration-700"
                style={{ width: `${overall}%` }}
              />
            </div>
          </div>
          <span className="font-extrabold text-xl">{overall}%</span>
        </div>
        <p className="text-xs opacity-70 mt-2">
          {progress.filter(p => p.mejor_porcentaje === 100).length} de {progress.length} actividades completadas
        </p>
      </div>

      {/* Logros */}
      <section className="mb-4">
        <h2 className="ar-section-title px-1">Mis logros</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {logros.map(l => (
            <div
              key={l.id}
              className={`ar-card p-4 flex-shrink-0 text-center transition-all ${
                l.obtenido ? '' : 'opacity-40 grayscale'
              }`}
              style={{ width: 120 }}
            >
              <span className="text-3xl block mb-1">{l.icono}</span>
              <p className="text-xs font-extrabold text-slate-900 leading-tight">{l.nombre}</p>
              {l.obtenido && (
                <p className="text-[10px] text-[color:var(--ar-primary)] font-bold mt-1">Obtenido ✓</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Unidades de aprendizaje */}
      <section>
        <h2 className="ar-section-title px-1">Unidades</h2>
        <div className="space-y-3">
          {learningPath.map((unidad, ui) => {
            const todosCompletados = unidad.todosCompletados
            const tieneActivo = unidad.tieneActivo
            return (
              <div key={unidad.id} className="ar-card overflow-hidden">
                {/* Header de unidad */}
                <div className={`px-4 py-3 flex items-center gap-3 border-b border-slate-100
                  ${todosCompletados ? 'bg-green-50' : tieneActivo ? 'bg-[color:var(--ar-primary-light)]' : 'bg-slate-50'}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-sm text-white flex-shrink-0
                    ${todosCompletados ? 'bg-green-500' : tieneActivo ? 'bg-[color:var(--ar-primary)]' : 'bg-slate-300'}`}>
                    {todosCompletados ? '✓' : ui + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`font-extrabold text-sm ${todosCompletados ? 'text-green-800' : tieneActivo ? 'text-[color:var(--ar-primary-dark)]' : 'text-slate-500'}`}>
                      {unidad.titulo}
                    </p>
                    <p className="text-xs text-[color:var(--ar-muted)] font-semibold">
                      {unidad.completados}/{unidad.pasos.length} pasos
                    </p>
                  </div>
                  {todosCompletados && <CheckCircle size={18} className="text-green-500" />}
                  {tieneActivo && <Play size={18} className="text-[color:var(--ar-primary)]" />}
                  {!todosCompletados && !tieneActivo && <Lock size={16} className="text-slate-400" />}
                </div>

                {/* Pasos */}
                <div className="divide-y divide-slate-50">
                  {unidad.pasos.map((paso, pi) => {
                    const iconMap = { lectura: BookOpen, actividad: ClipboardList }
                    const PasoIcon = iconMap[paso.tipo] || BookOpen
                    const isActive = paso.estado === 'activo'
                    const isCompleted = paso.estado === 'completado'
                    const isLocked = paso.estado === 'bloqueado'
                    return (
                      <button
                        key={paso.id}
                        onClick={() => !isLocked && (paso.tipo === 'actividad'
                          ? navigate(`/actividades/${paso.actividad_id}`)
                          : paso.slug ? navigate(`/lecturas/${paso.slug}`) : navigate('/lecturas'))}
                        disabled={isLocked}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                          ${isActive ? 'bg-[color:var(--ar-primary-light)] hover:bg-teal-100' : ''}
                          ${isCompleted ? 'hover:bg-slate-50' : ''}
                          ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                          ${isCompleted ? 'bg-green-100 text-green-600' : isActive ? 'bg-[color:var(--ar-primary)] text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {isCompleted ? <CheckCircle size={14} /> : isLocked ? <Lock size={12} /> : <PasoIcon size={13} />}
                        </div>
                        <span className={`text-sm font-semibold flex-1 ${isActive ? 'text-[color:var(--ar-primary-dark)] font-extrabold' : isCompleted ? 'text-slate-500 line-through' : 'text-slate-400'}`}>
                          {paso.titulo}
                        </span>
                        {isActive && <ChevronRight size={16} className="text-[color:var(--ar-primary)]" />}
                      </button>
                    )
                  })}
                  {unidad.pasos.length === 0 && (
                    <p className="px-4 py-3 text-xs text-[color:var(--ar-muted)]">Sin contenido aún en esta unidad</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
