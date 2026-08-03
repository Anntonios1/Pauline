import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../../contexts/DataContext'
import { useAuth } from '../../contexts/AuthContext'
import { publicationToPost, timeAgo } from '../../utils/feed'
import { getAreaLabel } from '../../utils/format'
import * as api from '../../services/api'
import {
  Users, ArrowRight, Shield, Plus, TrendingUp, User, AlertTriangle,
  Trophy, Target, ChevronDown, ChevronUp, ClipboardPlus, BarChart3, Download
} from 'lucide-react'

function formatSeconds(seg) {
  if (!seg) return '0m'
  const mins = Math.floor(seg / 60)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  return `${h}h ${mins % 60}m`
}

function ScoreBadge({ value }) {
  if (value == null) return <span className="text-xs text-slate-400">—</span>
  const color = value >= 70 ? 'bg-green-100 text-green-700' : value >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{value}%</span>
}

export default function AdminDashboard() {
  const { publications, pendingPublications } = useData()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.rol === 'administrador'
  const pendientes = pendingPublications.filter(m => m.estado === 'enviada' || m.estado === 'en_revision').length
  const recentPosts = publications.map(publicationToPost).slice(0, 4)

  const [overview, setOverview] = useState(null)
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAllStudents, setShowAllStudents] = useState(false)
  const [sortField, setSortField] = useState('promedio_porcentaje')
  const [sortAsc, setSortAsc] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [exportError, setExportError] = useState('')

  async function handleExport() {
    setExportando(true)
    setExportError('')
    try {
      await api.downloadStatsExport()
    } catch (e) {
      setExportError(e.message || 'No se pudo generar el archivo')
    } finally {
      setExportando(false)
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const [ov, sts] = await Promise.all([
          api.getStatsOverview(),
          api.getStatsStudents(),
        ])
        setOverview(ov)
        setStudents(sts)
      } catch (e) {
        console.error('Error cargando estadisticas:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const sortedStudents = [...students].sort((a, b) => {
    const va = a[sortField] ?? -1
    const vb = b[sortField] ?? -1
    return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
  })
  const visibleStudents = showAllStudents ? sortedStudents : sortedStudents.slice(0, 8)

  function toggleSort(field) {
    if (sortField === field) setSortAsc(!sortAsc)
    else { setSortField(field); setSortAsc(false) }
  }

  if (loading) {
    return (
      <div className="feed-container pb-4 fade-in flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 rounded-full bg-purple-200 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Cargando metricas...</p>
        </div>
      </div>
    )
  }

  const resumen = overview?.resumen || {}
  const areas = overview?.rendimiento_por_area || []
  const topStudents = overview?.top_estudiantes || []
  const riesgo = overview?.estudiantes_en_riesgo || []
  const timeline = overview?.actividad_diaria || []
  const maxTimeline = Math.max(...timeline.map(t => t.total_intentos), 1)

  const kpis = [
    { label: 'Estudiantes activos', value: `${resumen.activos_7d || 0}/${resumen.total_estudiantes || 0}`, sub: 'ultimos 7 dias', icon: Users, color: 'from-blue-400 to-blue-600' },
    { label: 'Promedio general', value: `${resumen.promedio_general || 0}%`, sub: `${resumen.intentos_completados || 0} intentos completados`, icon: Target, color: 'from-green-400 to-green-600' },
    { label: 'Tasa de abandono', value: resumen.total_intentos ? `${Math.round(((resumen.intentos_abandonados || 0) / resumen.total_intentos) * 100)}%` : '0%', sub: `${resumen.intentos_abandonados || 0} abandonados`, icon: AlertTriangle, color: 'from-orange-400 to-orange-600' },
    { label: 'Pendientes', value: pendientes, sub: 'por moderar', icon: Shield, color: 'from-purple-400 to-purple-600' },
  ]

  return (
    <div className="feed-container pb-4 fade-in">

      {/* Encabezado docente: no replica el feed del estudiante. */}
      <div className="ar-card p-5 mb-4 bg-gradient-to-br from-purple-600 to-purple-800 text-white">
        <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">
          {isAdmin ? 'Administración' : 'Espacio docente'}
        </p>
        <h1 className="text-xl font-extrabold">
          Hola, {user?.nombre_visible?.split(' ')[0]}
        </h1>
        <p className="text-sm opacity-80 mt-1">
          Organiza tus actividades y acompaña el progreso de tu grupo.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/admin/crear-juego')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-purple-700 hover:bg-purple-50 rounded-full text-sm font-bold transition-colors"
          >
            <ClipboardPlus size={16} />
            Crear quiz
          </button>
          <button
            onClick={() => navigate(pendientes > 0 ? '/admin/moderar' : '/admin/progreso')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-full text-sm font-bold transition-colors"
          >
            {pendientes > 0 ? <Shield size={15} /> : <BarChart3 size={15} />}
            {pendientes > 0 ? `${pendientes} por revisar` : 'Ver progreso'}
          </button>
        </div>
      </div>

      {/* Prioridades operativas del docente. */}
      <h2 className="ar-section-title px-1">Tu jornada de clase</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {[
          {
            title: 'Diseña una actividad interactiva',
            description: 'Crea quizzes con preguntas, imágenes, audio y fichas.',
            action: 'Crear quiz', icon: ClipboardPlus, path: '/admin/crear-juego', tone: 'bg-purple-50 text-purple-700',
          },
          {
            title: pendientes > 0 ? 'Hay entregas por revisar' : 'Revisa el avance del grupo',
            description: pendientes > 0 ? `${pendientes} publicación${pendientes === 1 ? '' : 'es'} espera${pendientes === 1 ? '' : 'n'} tu revisión.` : 'Identifica quién necesita acompañamiento.',
            action: pendientes > 0 ? 'Ir a moderación' : 'Ver progreso', icon: pendientes > 0 ? Shield : TrendingUp,
            path: pendientes > 0 ? '/admin/moderar' : '/admin/progreso', tone: pendientes > 0 ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700',
          },
        ].map((task) => {
          const Icon = task.icon
          return (
            <button
              key={task.title}
              onClick={() => navigate(task.path)}
              className="ar-card p-4 text-left hover:shadow-md transition-all active:scale-[0.99] flex items-start gap-3"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${task.tone}`}>
                <Icon size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-slate-900">{task.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-purple-700">
                  {task.action} <ArrowRight size={13} />
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* KPIs */}
      <h2 className="ar-section-title px-1">Panorama del grupo</h2>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {kpis.map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} className="ar-card p-4">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center mb-2`}>
                <Icon size={17} className="text-white" />
              </div>
              <p className="text-xl font-extrabold text-slate-900">{k.value}</p>
              <p className="text-[11px] font-bold text-slate-700">{k.label}</p>
              <p className="text-[10px] text-slate-400">{k.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Rendimiento por area */}
      {areas.length > 0 && (
        <>
          <h2 className="ar-section-title px-1">Rendimiento por area</h2>
          <div className="ar-card p-4 mb-5 space-y-3">
            {areas.map((a) => {
              const pct = a.promedio || 0
              const barColor = pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-orange-400' : 'bg-red-400'
              return (
                <div key={a.area}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700 truncate">{getAreaLabel(a.area)}</span>
                    <span className="text-xs font-bold text-slate-900 ml-2">{pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{a.estudiantes_unicos} estudiantes · {a.total_intentos} intentos</p>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Actividad reciente (timeline) */}
      {timeline.length > 0 && (
        <>
          <h2 className="ar-section-title px-1">Actividad (ultimos 14 dias)</h2>
          <div className="ar-card p-4 mb-5">
            <div className="flex items-end gap-1 h-24">
              {timeline.map((t) => (
                <div key={t.fecha} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full bg-purple-400 rounded-t-sm min-h-[2px] transition-all hover:bg-purple-600"
                    style={{ height: `${Math.max((t.total_intentos / maxTimeline) * 100, 3)}%` }}
                    title={`${t.fecha}: ${t.total_intentos} intentos, ${t.estudiantes_activos} estudiantes`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-slate-400">{timeline[0]?.fecha?.slice(5)}</span>
              <span className="text-[10px] text-slate-400">{timeline[timeline.length - 1]?.fecha?.slice(5)}</span>
            </div>
          </div>
        </>
      )}

      {/* Estudiantes en riesgo */}
      {riesgo.length > 0 && (
        <>
          <h2 className="ar-section-title px-1 flex items-center gap-2">
            <AlertTriangle size={14} className="text-orange-500" />
            Estudiantes en riesgo ({riesgo.length})
          </h2>
          <div className="ar-card divide-y divide-slate-50 mb-5">
            {riesgo.slice(0, 5).map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {s.nombre_visible?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{s.nombre_visible}</p>
                  <p className="text-[11px] text-slate-400">
                    {s.motivo === 'bajo_rendimiento' ? `Promedio: ${s.promedio}%` : `Sin actividad · ${timeAgo(s.ultimo_acceso)}`}
                  </p>
                </div>
                <span className={`ar-badge ${s.motivo === 'bajo_rendimiento' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                  {s.motivo === 'bajo_rendimiento' ? 'Bajo rendimiento' : 'Inactivo'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Top estudiantes */}
      {topStudents.length > 0 && (
        <>
          <h2 className="ar-section-title px-1 flex items-center gap-2">
            <Trophy size={14} className="text-yellow-500" />
            Mejores estudiantes
          </h2>
          <div className="ar-card divide-y divide-slate-50 mb-5">
            {topStudents.map((s, i) => (
              <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0
                  ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-400'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{s.nombre_visible}</p>
                  <p className="text-[11px] text-slate-400">{s.intentos_completados} actividades completadas</p>
                </div>
                <ScoreBadge value={s.promedio} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tabla de estudiantes */}
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="ar-section-title !mb-0">Detalle de estudiantes ({students.length})</h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={exportando || students.length === 0}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={14} />
          {exportando ? 'Generando...' : 'Descargar CSV'}
        </button>
      </div>
      {exportError && <p className="px-1 text-xs text-red-500 mb-1">{exportError}</p>}
      <div className="ar-card mb-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-3 py-2.5 font-bold text-slate-600">Estudiante</th>
                <th className="px-2 py-2.5 font-bold text-slate-600 cursor-pointer select-none" onClick={() => toggleSort('actividades_completadas')}>
                  Acts {sortField === 'actividades_completadas' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="px-2 py-2.5 font-bold text-slate-600 cursor-pointer select-none" onClick={() => toggleSort('promedio_porcentaje')}>
                  Prom {sortField === 'promedio_porcentaje' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="px-2 py-2.5 font-bold text-slate-600 cursor-pointer select-none" onClick={() => toggleSort('tiempo_total_segundos')}>
                  Tiempo {sortField === 'tiempo_total_segundos' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="px-2 py-2.5 font-bold text-slate-600">Acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleStudents.map((s) => (
                <tr key={s.id} className="hover:bg-purple-50/30 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {s.nombre_visible?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <span className="font-semibold text-slate-800 truncate max-w-[100px]">{s.nombre_visible}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-slate-600 font-medium">{s.actividades_completadas || 0}</td>
                  <td className="px-2 py-2.5"><ScoreBadge value={s.promedio_porcentaje} /></td>
                  <td className="px-2 py-2.5 text-slate-500">{formatSeconds(s.tiempo_total_segundos)}</td>
                  <td className="px-2 py-2.5 text-slate-400">{timeAgo(s.ultimo_acceso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {students.length > 8 && (
          <button
            onClick={() => setShowAllStudents(!showAllStudents)}
            className="w-full px-4 py-2.5 text-xs font-bold text-purple-600 hover:bg-purple-50 transition-colors flex items-center justify-center gap-1"
          >
            {showAllStudents ? <>Mostrar menos <ChevronUp size={13} /></> : <>Ver todos ({students.length}) <ChevronDown size={13} /></>}
          </button>
        )}
      </div>

      {/* Acciones complementarias */}
      <h2 className="ar-section-title px-1">Herramientas docentes</h2>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { label: 'Moderar', icon: Shield, path: '/admin/moderar', urgent: pendientes > 0 },
          { label: 'Crear publicación', icon: Plus, path: '/admin/crear' },
          { label: 'Progreso grupo', icon: TrendingUp, path: '/admin/progreso' },
          { label: 'Mi perfil', icon: User, path: '/admin/perfil' },
        ].map((a, i) => {
          const Icon = a.icon
          return (
            <button
              key={i}
              onClick={() => navigate(a.path)}
              className={`ar-card p-3.5 text-left flex flex-col gap-2 hover:shadow-md transition-all active:scale-98
                ${a.urgent ? 'border-l-4 border-orange-400' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center
                ${a.urgent ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'}`}>
                <Icon size={16} />
              </div>
              <span className="text-xs font-bold text-slate-800">{a.label}</span>
            </button>
          )
        })}
      </div>

      {/* Últimos contenidos creados o publicados */}
      <h2 className="ar-section-title px-1">Muro y materiales recientes</h2>
      <div className="ar-card divide-y divide-slate-50">
        {recentPosts.map(p => (
          <div key={p.id} className="px-4 py-3 flex items-start gap-3">
            <div className={`avatar-sm text-white flex-shrink-0 ${p.autor?.color || 'bg-teal-500'}`}>
              {p.autor?.imagen
                ? <img src={p.autor.imagen} alt="" className="h-full w-full object-cover" />
                : p.autor?.iniciales}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 line-clamp-1">{p.titulo}</p>
              <p className="text-xs text-[color:var(--ar-muted)]">{p.autor?.nombre} · {p.tiempo}</p>
            </div>
            <span className={`ar-badge flex-shrink-0 ${p.tipo === 'aviso' ? 'badge-aviso' : p.tipo === 'lectura' ? 'badge-lectura' : p.tipo === 'estudiante' ? 'badge-estudiante' : 'badge-actividad'}`}>
              {p.tipo}
            </span>
          </div>
        ))}
        {recentPosts.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-[color:var(--ar-muted)]">Aun no hay publicaciones</p>
        )}
        <button
          onClick={() => navigate('/')}
          className="w-full px-4 py-3 text-sm font-bold text-purple-600 hover:bg-purple-50 transition-colors flex items-center gap-2"
        >
          Ver muro completo <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
