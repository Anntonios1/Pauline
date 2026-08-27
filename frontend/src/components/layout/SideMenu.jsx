import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  Home, Compass, Plus, Map, Route, User, FileText, Shield,
  BookOpen, ClipboardList, FolderOpen, Star, Sparkles,
  HelpCircle, LogOut, X, ArrowLeftRight, TrendingUp, CalendarDays, Users, FlaskConical,
  Image as ImageIcon
} from 'lucide-react'

const studentSections = [
  {
    titulo: 'Mi aprendizaje',
    items: [
      { path: '/',         label: 'Inicio',               icon: Home },
      { path: '/juegos',   label: 'Quizzes interactivos', icon: Sparkles },
      { path: '/sala',     label: 'Unirme a sala QR',     icon: Compass },
      { path: '/mi-ruta',  label: 'Mi ruta',              icon: Map },
      { path: '/explorar', label: 'Explorar temas',       icon: Compass },
      { path: '/actividades', label: 'Actividades',       icon: ClipboardList },
      { path: '/perfil',   label: 'Mis logros',           icon: Star },
    ]
  },
  {
    titulo: 'Comunidad',
    items: [
      { path: '/lecturas',     label: 'Lecturas de la clase', icon: BookOpen },
      { path: '/recursos',     label: 'Recursos',             icon: FolderOpen },
    ]
  },
  {
    titulo: 'Cuenta',
    items: [
      { path: '/ayuda',   label: 'Ayuda',                 icon: HelpCircle },
      { path: '/normas',  label: 'Normas de convivencia', icon: Shield },
    ]
  },
]

const teacherSections = [
  {
    titulo: 'Clase',
    items: [
      { path: '/admin',             label: 'Inicio',                icon: Home },
      { path: '/admin/juegos',      label: 'Quizzes interactivos', icon: Sparkles },
      { path: '/admin/crear-juego', label: 'Crear quiz',            icon: Plus },
      { path: '/admin/mis-quizzes', label: 'Mis quizzes',           icon: ClipboardList },
      { path: '/admin/mi-ruta',     label: 'Actividades Mi Ruta',   icon: Route },
      { path: '/admin/lecturas',    label: 'Lecturas',              icon: BookOpen },
      { path: '/admin/actividades', label: 'Actividades',          icon: ClipboardList },
      { path: '/admin/recursos',    label: 'Recursos',             icon: FolderOpen },
    ]
  },
  {
    titulo: 'Crear',
    items: [
      { path: '/admin/crear',         label: 'Nueva publicación',  icon: Plus },
      { path: '/admin/eventos',       label: 'Nuevo evento',       icon: CalendarDays },
    ]
  },
  {
    titulo: 'Moderación',
    items: [
      { path: '/admin/moderar',         label: 'Pendientes',       icon: Shield },
    ]
  },
  {
    titulo: 'Seguimiento',
    items: [
      { path: '/admin/progreso',   label: 'Progreso del grupo',   icon: TrendingUp },
      { path: '/admin/usuarios',   label: 'Usuarios',             icon: Users },
      { path: '/admin/banner',     label: 'Banner del feed',      icon: ImageIcon },
      { path: '/admin/investigacion', label: 'Investigación',     icon: FlaskConical },
    ]
  },
  {
    titulo: 'Cuenta',
    items: [
      { path: '/admin/perfil', label: 'Mi perfil', icon: User },
    ]
  },
]

export default function SideMenu({ open, onClose }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (!open) return null

  const rol = user?.rol || 'estudiante'
  const isTeacher = rol === 'docente' || rol === 'administrador'
  const sections = isTeacher ? teacherSections : studentSections

  const avatarColor = isTeacher
    ? (rol === 'administrador' ? 'bg-blue-900 text-white' : 'bg-purple-600 text-white')
    : 'bg-[color:var(--ar-primary)] text-white'

  const activeColor = isTeacher ? 'bg-purple-50 text-purple-700' : 'bg-[color:var(--ar-primary-light)] text-[color:var(--ar-primary)]'

  const handleNavigate = (path) => {
    navigate(path)
    onClose()
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
    onClose()
  }

  return (
    <div className="side-menu-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Menú de navegación">
      <div className="side-menu slide-in-left" onClick={e => e.stopPropagation()}>

        {/* Header del menú */}
        <div className={`relative p-5 pb-4 ${isTeacher ? (rol === 'administrador' ? 'bg-blue-900' : 'bg-purple-600') : 'bg-[color:var(--ar-primary)]'}`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>

          <div className={`w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center font-extrabold text-xl mb-3 bg-white/20 text-white`}>
            {user?.imagen_perfil
              ? <img src={user.imagen_perfil} alt="" className="h-full w-full object-cover" />
              : (user?.nombre_visible?.charAt(0) || '?')}
          </div>
          <p className="font-extrabold text-white text-base leading-tight">{user?.nombre_visible}</p>
          <p className="text-sm text-white/75 font-semibold mt-0.5 capitalize">{user?.rol} · Grado 5.°</p>
        </div>

        {/* Enlace de cambio de vista (solo para docentes viendo como estudiante o viceversa) */}
        {isTeacher && !location.pathname.startsWith('/admin') && (
          <button
            onClick={() => handleNavigate('/admin')}
            className="w-full flex items-center gap-3 px-5 py-3 text-sm font-bold text-purple-700 bg-purple-50 border-b border-purple-100 hover:bg-purple-100 transition-colors"
          >
            <ArrowLeftRight size={16} />
            Ir al panel docente
          </button>
        )}
        {isTeacher && location.pathname.startsWith('/admin') && (
          <button
            onClick={() => handleNavigate('/')}
            className="w-full flex items-center gap-3 px-5 py-3 text-sm font-bold text-teal-700 bg-teal-50 border-b border-teal-100 hover:bg-teal-100 transition-colors"
          >
            <ArrowLeftRight size={16} />
            Ver como estudiante
          </button>
        )}

        {/* Secciones del menú */}
        {sections.map((section, si) => (
          <div key={si} className="side-menu-section">
            <p className="side-menu-section-title">{section.titulo}</p>
            {section.items.map(item => {
              const Icon = item.icon
              const isActive = item.path === '/' || item.path === '/admin'
                ? location.pathname === item.path
                : location.pathname.startsWith(item.path)
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={`side-menu-item w-full text-left ${isActive ? activeColor + ' active' : ''}`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="text-xs font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}

        {/* Cerrar sesión */}
        <div className="px-4 pt-2 pb-6">
          <button
            onClick={handleLogout}
            className="side-menu-item w-full text-left text-red-600 hover:bg-red-50"
          >
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
