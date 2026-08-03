import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Home, Compass, Plus, Map, User, FileText, Shield, BarChart3, ClipboardPlus } from 'lucide-react'

const studentNav = [
  { path: '/',         label: 'Inicio',   icon: Home },
  { path: '/juegos',   label: 'Juegos',   icon: Compass },
  { path: '/crear',    label: '',          icon: Plus, isCreate: true },
  { path: '/mi-ruta',  label: 'Mi ruta',  icon: Map },
  { path: '/perfil',   label: 'Perfil',   icon: User },
]

const teacherNav = [
  { path: '/admin',          label: 'Inicio',    icon: Home },
  { path: '/admin/lecturas', label: 'Lecturas', icon: FileText },
  { path: '/admin/crear-juego', label: '',        icon: ClipboardPlus, isCreate: true },
  { path: '/admin/moderar',  label: 'Moderar',   icon: Shield },
  { path: '/admin/perfil',   label: 'Perfil',    icon: User },
]

export default function BottomNav() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const rol = user?.rol || 'estudiante'
  const isTeacher = rol === 'docente' || rol === 'administrador'
  const navItems = isTeacher ? teacherNav : studentNav
  const activeColor = isTeacher ? 'text-purple-600' : 'text-[color:var(--ar-primary)]'

  return (
    <nav className="bottom-nav md:hidden" role="navigation" aria-label="Navegación principal">
      {navItems.map(item => {
        const Icon = item.icon
        if (item.isCreate) {
          return (
            <button
              key={item.path}
              id="bottom-nav-create-btn"
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-end pb-2 flex-1"
              aria-label={isTeacher ? 'Crear quiz' : 'Crear publicación'}
            >
              <span className="bottom-nav-create">
                <Icon size={24} strokeWidth={2.5} />
              </span>
            </button>
          )
        }

        const isActive = item.path === '/' || item.path === '/admin'
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path)

        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`bottom-nav-item ${isActive ? activeColor + ' active' : ''}`}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span style={{ fontSize: '10px' }}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
