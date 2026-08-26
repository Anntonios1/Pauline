import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../contexts/DataContext'
import * as api from '../../services/api'
import { CheckCircle, Lock, Play } from 'lucide-react'
import { LoadingState } from '../../components/ui'
import ActivityPreview from '../../components/media/ActivityPreview'

export default function MyRoutePage() {
  const navigate = useNavigate()
  const { logros } = useData()
  const [modulos, setModulos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.getLearningPath()
      .then(data => { if (active) setModulos(Array.isArray(data) ? data : []) })
      .catch(err => { if (active) setError(err.message || 'No se pudo cargar la ruta') })
    return () => { active = false }
  }, [])

  const totalCompletados = (modulos || []).reduce((acc, m) => acc + m.progreso.completados, 0)
  const totalPasos = (modulos || []).reduce((acc, m) => acc + m.progreso.total, 0)
  const overall = totalPasos > 0 ? Math.round((totalCompletados / totalPasos) * 100) : 0

  function abrirPaso(paso) {
    if (paso.tipo_paso === 'actividad') {
      navigate(`/actividades/${paso.actividad_id}`)
    } else if (paso.publicacion_slug) {
      navigate(`/lecturas/${paso.publicacion_slug}`)
    } else {
      navigate('/lecturas')
    }
  }

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
          {totalCompletados} de {totalPasos} pasos completados
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
        {!modulos && !error && <LoadingState message="Cargando tu ruta…" />}
        {error && <p className="px-1 text-sm text-red-600">{error}</p>}
        <div className="space-y-3">
          {(modulos || []).map((unidad, ui) => {
            const todosCompletados = unidad.progreso.total > 0 && unidad.progreso.completados === unidad.progreso.total
            const tieneActivo = unidad.pasos.some(p => p.estado === 'AVAILABLE' || p.estado === 'IN_PROGRESS')
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
                      {unidad.nombre}
                    </p>
                    <p className="text-xs text-[color:var(--ar-muted)] font-semibold">
                      {unidad.progreso.completados}/{unidad.progreso.total} pasos
                    </p>
                  </div>
                  {todosCompletados && <CheckCircle size={18} className="text-green-500" />}
                  {tieneActivo && <Play size={18} className="text-[color:var(--ar-primary)]" />}
                  {!todosCompletados && !tieneActivo && <Lock size={16} className="text-slate-400" />}
                </div>

                {/* Pasos */}
                <div className="divide-y divide-slate-50">
                  {unidad.pasos.map(paso => (
                    <ActivityPreview key={paso.id} paso={paso} onOpen={abrirPaso} />
                  ))}
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
