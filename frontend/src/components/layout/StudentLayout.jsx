import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import SideMenu from './SideMenu'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { useLearningPath } from '../../hooks/useLearningPath'
import { Plus, Map as MapIcon, BarChart3, BookOpen, Compass, CalendarDays, Clock3, MapPin, CheckCircle, Play, Circle } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import * as api from '../../services/api'

/* Desktop sidebar links for student */
const desktopLinks = [
  { path: '/',         label: 'Inicio',       icon: null },
  { path: '/explorar', label: 'Explorar',     icon: Compass },
  { path: '/mi-ruta',  label: 'Mi ruta',      icon: MapIcon },
  { path: '/lecturas', label: 'Lecturas',     icon: BookOpen },
  { path: '/progreso', label: 'Mi progreso',  icon: BarChart3 },
]

export default function StudentLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { progress, logros } = useData()
  const { learningPath } = useLearningPath()
  const attempted = progress.filter(item => Number(item.total_intentos || 0) > 0).length
  const perfect = progress.filter(item => Number(item.mejor_porcentaje) === 100).length
  const profileRank = perfect >= 5 ? 'diamante' : perfect >= 3 ? 'oro' : attempted >= 3 ? 'plata' : 'bronce'
  const primeraUnidadActiva = learningPath.findIndex(u => !u.todosCompletados)
  const unidadesWidget = learningPath.slice(0, 3)
  const obtenidos = logros.filter(l => l.obtenido)
  const [classEvents, setClassEvents] = useState([])
  useEffect(() => { api.getClassEvents().then(setClassEvents).catch(() => setClassEvents([])) }, [])
  const nextEvent = classEvents[0]

  return (
    <div className="min-h-screen bg-[color:var(--ar-bg)]">
      {/* Top Bar */}
      <TopBar onMenuOpen={() => setMenuOpen(true)} />

      {/* Side Menu Overlay */}
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Desktop Layout: 3 columns */}
      <div className="hidden md:flex max-w-6xl mx-auto px-4 gap-6" style={{ paddingTop: '72px' }}>

        {/* Left sidebar — desktop nav */}
        <aside className="w-56 flex-shrink-0">
          <div className="sticky top-20 ar-card p-3 space-y-1">
            <div className="flex items-center gap-3 p-3 mb-3 border-b border-slate-100">
              <div className={`avatar-md rank-halo rank-${profileRank} bg-[color:var(--ar-primary)] text-white`} title={`Rango ${profileRank}`}>
                {user?.imagen_perfil
                  ? <img src={user.imagen_perfil} alt="" className="h-full w-full object-cover" />
                  : user?.nombre_visible?.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900 truncate">{user?.nombre_visible}</p>
                <p className="text-xs text-[color:var(--ar-muted)] capitalize">{user?.rol}</p>
              </div>
            </div>
            {desktopLinks.map(link => {
              const isActive = link.path === '/' ? location.pathname === '/' : location.pathname.startsWith(link.path)
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2
                    ${isActive ? 'bg-[color:var(--ar-primary-light)] text-[color:var(--ar-primary)]' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {link.label}
                </button>
              )
            })}
            <button
              onClick={() => navigate('/crear')}
              className="w-full mt-3 btn-primary text-center py-2.5 text-sm"
            >
              <Plus size={16} />
              Crear publicación
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-8">
          <Outlet />
        </main>

        {/* Right sidebar — compact */}
        <aside className="w-72 flex-shrink-0">
          <div className="sticky top-20 space-y-4">
            {/* Ruta rápida */}
            <div className="ar-card p-4">
              <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                <MapIcon size={16} className="text-[color:var(--ar-primary)]" />
                Mi ruta
              </h4>
              <div className="space-y-2">
                {unidadesWidget.map((unidad, i) => {
                  const esActiva = i === primeraUnidadActiva
                  return (
                    <div key={unidad.id} className="flex items-center gap-2 text-sm">
                      {unidad.todosCompletados
                        ? <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                        : esActiva
                          ? <Play size={16} className="text-[color:var(--ar-primary)] flex-shrink-0" />
                          : <Circle size={16} className="text-slate-300 flex-shrink-0" />}
                      <span className={
                        unidad.todosCompletados
                          ? 'text-slate-500 line-through text-xs'
                          : esActiva
                            ? 'font-semibold text-slate-900 text-xs'
                            : 'text-slate-400 text-xs'
                      }>
                        {unidad.titulo}
                      </span>
                    </div>
                  )
                })}
                {unidadesWidget.length === 0 && (
                  <p className="text-xs text-[color:var(--ar-muted)]">Todavía no hay unidades publicadas.</p>
                )}
              </div>
              <button onClick={() => navigate('/mi-ruta')} className="mt-3 text-xs font-bold text-[color:var(--ar-primary)] hover:underline">
                Ver ruta completa →
              </button>
            </div>

            {/* Emblemas / logros */}
            <div className="ar-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <span className="text-base">🏅</span>
                  Mis emblemas
                </h4>
                <span className="text-xs font-bold text-[color:var(--ar-muted)]">{obtenidos.length}/{logros.length}</span>
              </div>
              {logros.length === 0 ? (
                <p className="text-xs text-[color:var(--ar-muted)]">Completa actividades para desbloquear emblemas.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {logros.slice(0, 8).map(l => (
                    <span
                      key={l.id}
                      title={`${l.nombre}${l.obtenido ? '' : ' (bloqueado)'}`}
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-lg bg-[color:var(--ar-primary-light)] ${l.obtenido ? '' : 'opacity-30 grayscale'}`}
                    >
                      {l.icono}
                    </span>
                  ))}
                </div>
              )}
              <button onClick={() => navigate('/perfil')} className="mt-3 text-xs font-bold text-[color:var(--ar-primary)] hover:underline">
                Ver todos los emblemas →
              </button>
            </div>

            {/* Próximo evento publicado por el docente */}
            {nextEvent && (
              <div className="ar-card p-4 bg-gradient-to-br from-[color:var(--ar-primary)] to-teal-700 text-white">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide opacity-80"><CalendarDays size={14} /> Próximo evento</p>
                <p className="font-extrabold text-base">{nextEvent.titulo}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs opacity-85"><Clock3 size={13} />
                  {new Date(nextEvent.fecha_inicio).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                {nextEvent.lugar && <p className="mt-1 flex items-center gap-1.5 text-xs opacity-85"><MapPin size={13} />{nextEvent.lugar}</p>}
                {nextEvent.descripcion && <p className="mt-3 rounded-xl bg-white/10 p-2 text-xs leading-relaxed">{nextEvent.descripcion}</p>}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile main content */}
      <main className="md:hidden main-content">
        <Outlet />
      </main>

      {/* Bottom Navigation (mobile only) */}
      <BottomNav />
    </div>
  )
}
