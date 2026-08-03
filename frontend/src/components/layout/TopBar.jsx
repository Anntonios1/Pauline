import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell } from 'lucide-react'
import { timeAgo } from '../../utils/feed'
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/api'
import ThemeToggle from '../ui/ThemeToggle'

const NOTIF_ICONS = {
  publicacion_pendiente: '📝',
  publicacion_aprobar: '✅',
  publicacion_corregir: '✏️',
  publicacion_rechazar: '❌',
  comentario_aprobado: '💬',
  comentario_rechazado: '🚫',
  logro_desbloqueado: '🏆',
}

const POLL_INTERVAL_MS = 30000

export default function TopBar({ onMenuOpen }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rawNotifs, setRawNotifs] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const notificationBaseline = useRef(null)

  const isTeacher = user?.rol === 'docente' || user?.rol === 'administrador'

  const cargarNotificaciones = useCallback(async () => {
    try {
      const datos = await getNotifications()
      setRawNotifs(datos || [])
    } catch {
      // Sesión expirada u otro fallo: no interrumpe la UI, se reintenta en el próximo ciclo.
    }
  }, [])

  useEffect(() => {
    cargarNotificaciones()
    const interval = setInterval(cargarNotificaciones, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [cargarNotificaciones])

  const notifications = useMemo(() => rawNotifs.map(n => ({
    id: n.id,
    icono: NOTIF_ICONS[n.tipo] || '🔔',
    texto: n.titulo,
    detalle: n.cuerpo,
    tiempo: timeAgo(n.fecha_creacion),
    leida: !!n.leida,
    onClick: () => { if (n.enlace) navigate(n.enlace) },
  })), [rawNotifs, navigate])

  const unread = notifications.filter(n => !n.leida).length

  const handleNotifClick = async (n) => {
    n.onClick?.()
    setShowNotifs(false)
    if (!n.leida) {
      setRawNotifs(prev => prev.map(raw => raw.id === n.id ? { ...raw, leida: 1 } : raw))
      try { await markNotificationRead(n.id) } catch { /* se resincroniza en el próximo poll */ }
    }
  }

  const handleMarkAllRead = async () => {
    setRawNotifs(prev => prev.map(raw => ({ ...raw, leida: 1 })))
    try { await markAllNotificationsRead() } catch { /* se resincroniza en el próximo poll */ }
  }

  useEffect(() => {
    if (notificationPermission !== 'granted') return
    const ids = notifications.filter(n => !n.leida).map(n => n.id).join('|')
    if (notificationBaseline.current === null) { notificationBaseline.current = ids; return }
    if (ids && ids !== notificationBaseline.current) {
      const newest = notifications.find(n => !n.leida)
      if (newest) new Notification('AulaRed', { body: newest.texto })
    }
    notificationBaseline.current = ids
  }, [notificationPermission, notifications])

  const requestNativeNotifications = async () => {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    if (permission === 'granted') new Notification('Notificaciones activadas', { body: 'Te avisaremos sobre novedades importantes.' })
  }

  const rol = user?.rol || 'estudiante'
  const barClass = isTeacher
    ? rol === 'administrador' ? 'topbar topbar-admin text-white' : 'topbar topbar-teacher text-white'
    : 'topbar text-slate-900'
  const iconClass = isTeacher ? 'text-white/80 hover:text-white' : 'text-slate-500 hover:text-slate-800'

  return (
    <>
      <header className={barClass}>
        <button
          id="topbar-menu-btn"
          onClick={onMenuOpen}
          className={`p-2 rounded-xl transition-colors ${isTeacher ? 'hover:bg-white/15' : 'hover:bg-slate-100'}`}
          aria-label="Abrir menú"
        >
          <Menu size={24} />
        </button>

        <button onClick={() => navigate(isTeacher ? '/admin' : '/')} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-sm
            ${isTeacher ? 'bg-white/20' : 'bg-[color:var(--ar-primary)] text-white'}`}>
            AR
          </div>
          {isTeacher && <span className="text-left hidden text-[10px] font-semibold uppercase tracking-wide text-white/75 sm:block">{rol === 'administrador' ? 'Administrador' : 'Docente'}</span>}
        </button>

        <div className="flex items-center gap-1">
          <ThemeToggle className={isTeacher ? 'text-white/85 hover:bg-white/15 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'} />
          <div className="relative">
            <button
              id="topbar-notif-btn"
              onClick={() => notificationPermission === 'default' ? requestNativeNotifications() : setShowNotifs(!showNotifs)}
              className={`p-2 rounded-xl transition-colors ${isTeacher ? 'hover:bg-white/15' : 'hover:bg-slate-100'} ${iconClass}`}
              aria-label="Notificaciones"
            >
              <Bell size={22} />
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center border border-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotifs && (
              <>
                <div className="absolute right-0 top-12 w-72 sm:w-80 ar-card z-50 shadow-xl overflow-hidden scale-in">
                  <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">Notificaciones</h3>
                    <div className="flex items-center gap-2">
                      {unread > 0 && (
                        <span className="text-xs font-bold text-[color:var(--ar-primary)] bg-[color:var(--ar-primary-light)] px-2 py-0.5 rounded-full">
                          {unread} sin leer
                        </span>
                      )}
                      {unread > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-700"
                        >
                          Marcar todas
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-6 text-center text-sm text-slate-400">No hay notificaciones</p>
                    ) : (
                      notifications.map(n => (
                        <button
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          className={`w-full flex items-start gap-3 p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors text-left ${!n.leida ? 'bg-[color:var(--ar-primary-light)]' : ''}`}
                        >
                          <span className="text-xl flex-shrink-0">{n.icono}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-snug ${!n.leida ? 'font-bold text-slate-900' : 'text-slate-700'}`}>{n.texto}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{n.tiempo}</p>
                          </div>
                          {!n.leida && <div className="w-2 h-2 bg-[color:var(--ar-primary)] rounded-full mt-1 flex-shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
              </>
            )}
          </div>
        </div>
      </header>
      {notificationPermission === 'default' && (
        <button type="button" onClick={requestNativeNotifications} className="fixed bottom-5 right-5 z-30 rounded-2xl bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-white shadow-xl hover:bg-slate-800">
          <span className="block font-extrabold">Activa las notificaciones</span><span className="text-xs text-white/70">Entérate de novedades importantes.</span>
        </button>
      )}
    </>
  )
}
