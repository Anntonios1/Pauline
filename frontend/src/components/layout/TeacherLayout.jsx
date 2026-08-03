import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import SideMenu from './SideMenu'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import {
  Home, Shield, BarChart3, Plus, AlertCircle, User, ClipboardPlus, CalendarDays, Users, FlaskConical
} from 'lucide-react'

const desktopLinks = [
  { path: '/admin',           label: 'Inicio',       icon: Home },
  { path: '/admin/moderar',   label: 'Moderar',      icon: Shield },
  { path: '/admin/eventos',   label: 'Eventos',      icon: CalendarDays },
  { path: '/admin/progreso',  label: 'Progreso',      icon: BarChart3 },
  { path: '/admin/usuarios',  label: 'Usuarios',      icon: Users },
  { path: '/admin/investigacion', label: 'Investigación', icon: FlaskConical },
  { path: '/admin/perfil',    label: 'Mi perfil',     icon: User },
]

export default function TeacherLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { pendingPublications, activities, publications, resources } = useData()
  const isAdmin = user?.rol === 'administrador'
  const pendientes = pendingPublications.filter(p => p.estado === 'enviada' || p.estado === 'en_revision').length
  const teacherCreations = activities.filter(item => Number(item.creado_por) === Number(user?.id)).length
    + publications.filter(item => Number(item.autor_id) === Number(user?.id)).length
    + resources.filter(item => Number(item.subido_por) === Number(user?.id)).length
  const profileRank = teacherCreations >= 12 ? 'diamante' : teacherCreations >= 7 ? 'oro' : teacherCreations >= 3 ? 'plata' : 'bronce'

  return (
    <div className="min-h-screen bg-[color:var(--ar-bg)]">
      {/* Top Bar */}
      <TopBar onMenuOpen={() => setMenuOpen(true)} />

      {/* Side Menu */}
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Desktop: 2 col layout (no right sidebar for teachers) */}
      <div className="hidden md:flex max-w-5xl mx-auto px-4 gap-6" style={{ paddingTop: '72px' }}>

        {/* Left sidebar */}
        <aside className="w-60 flex-shrink-0">
          <div className="sticky top-20 ar-card p-3 space-y-1">
            {/* User info */}
            <div className="flex items-center gap-3 p-3 mb-3 border-b border-slate-100">
              <div className={`avatar-md rank-halo rank-${profileRank} text-white ${isAdmin ? 'bg-blue-900' : 'bg-purple-600'}`} title={`Rango docente ${profileRank}`}>
                {user?.imagen_perfil
                  ? <img src={user.imagen_perfil} alt="" className="h-full w-full object-cover" />
                  : user?.nombre_visible?.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900 truncate">{user?.nombre_visible}</p>
                <p className="text-xs capitalize" style={{ color: isAdmin ? '#1e3a5f' : '#7c3aed' }}>{user?.rol}</p>
              </div>
            </div>

            {desktopLinks.map(link => {
              const Icon = link.icon
              const isActive = link.path === '/admin'
                ? location.pathname === '/admin'
                : location.pathname.startsWith(link.path)
              const badge = link.path === '/admin/moderar' && pendientes > 0 ? pendientes : null
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2
                    ${isActive ? 'bg-purple-50 text-purple-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <span className="flex-1">{link.label}</span>
                  {badge && (
                    <span className="text-xs font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">{badge}</span>
                  )}
                </button>
              )
            })}

            <div className="pt-2 border-t border-slate-100 mt-2">
              <button
                onClick={() => navigate('/admin/crear-juego')}
                className="w-full py-2.5 text-sm font-bold rounded-full text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}
              >
                <ClipboardPlus size={16} />
                Crear quiz
              </button>
              <button
                onClick={() => navigate('/admin/crear')}
                className="w-full mt-2 py-2 text-xs font-bold text-purple-700 hover:bg-purple-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                Crear publicación
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full mt-1 py-2 text-xs font-bold text-teal-600 hover:bg-teal-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                Ver como estudiante →
              </button>
            </div>
          </div>

          {/* Alert card — pendientes de moderación */}
          {pendientes > 0 && (
          <div className="ar-card mt-4 p-4 border-l-4 border-orange-400">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={16} className="text-orange-500" />
              <p className="font-bold text-sm text-slate-900">Pendientes</p>
            </div>
            <p className="text-xs text-slate-600">{pendientes} {pendientes === 1 ? 'publicación espera' : 'publicaciones esperan'} tu revisión.</p>
            <button
              onClick={() => navigate('/admin/moderar')}
              className="mt-2 text-xs font-bold text-orange-600 hover:underline"
            >
              Revisar ahora →
            </button>
          </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile main content */}
      <main className="md:hidden main-content">
        <Outlet />
      </main>

      {/* Bottom Navigation (mobile) */}
      <BottomNav />
    </div>
  )
}
