import { useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { useNavigate } from 'react-router-dom'
import { useMyPublications } from '../../hooks/useMyPublications'
import { getLogroRankFromPuntos, LOGRO_RANK_ORDER, LOGRO_RANKS } from '../../utils/feed'
import { getAreaLabel } from '../../utils/format'
import { LogOut, ChevronRight, Star, FileText, Clock, Camera, Settings, Palette } from 'lucide-react'
import * as api from '../../services/api'
import ProfileEditForm from '../../components/profile/ProfileEditForm'
import ThemePanel from '../../components/ui/ThemePanel'

function ProgressBar({ value, className = '' }) {
  return (
    <div className={`ar-progress-track ${className}`}>
      <div className="ar-progress-fill" style={{ width: `${value}%` }} />
    </div>
  )
}

function calculateOverall(progress) {
  if (!progress?.length) return 0
  const done = progress.filter(p => p.mejor_porcentaje === 100).length
  return Math.round((done / progress.length) * 100)
}

const AREA_COLORS = {
  cuerpo_humano: 'bg-blue-100 text-blue-700',
  pubertad: 'bg-purple-100 text-purple-700',
  sistema_reproductor_femenino: 'bg-pink-100 text-pink-700',
  sistema_reproductor_masculino: 'bg-sky-100 text-sky-700',
  celulas_reproductoras: 'bg-emerald-100 text-emerald-700',
  fecundacion: 'bg-teal-100 text-teal-700',
  embarazo: 'bg-green-100 text-green-700',
  nacimiento: 'bg-yellow-100 text-yellow-800',
  autocuidado: 'bg-orange-100 text-orange-700',
  preguntas_frecuentes: 'bg-slate-100 text-slate-600',
}

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth()
  const { progress, logros: logrosBase } = useData()
  const navigate = useNavigate()
  const myPublications = useMyPublications()
  const overall = calculateOverall(progress)
  const avatarInputRef = useRef(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setAvatarError('')
    try {
      const result = await api.uploadMyAvatar(file)
      updateUser({ imagen_perfil: result.imagen_perfil })
    } catch (error) {
      setAvatarError(error.message || 'No se pudo actualizar la foto.')
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const stats = [
    { label: 'Publicaciones aprobadas', value: myPublications.filter(p => p.estado === 'aprobada').length, emoji: '✅' },
    { label: 'En revisión',            value: myPublications.filter(p => ['enviada', 'en_revision'].includes(p.estado)).length, emoji: '⏳' },
    { label: 'Necesita cambios',       value: myPublications.filter(p => p.estado === 'requiere_cambios').length, emoji: '✏️' },
  ]

  const logros = logrosBase.map(l => ({ ...l, rango: getLogroRankFromPuntos(l.puntos_bonus) }))
  const highestRank = ['diamante', 'oro', 'plata', 'bronce'].find(rank => logros.some(logro => logro.obtenido && logro.rango === rank)) || 'bronce'

  const temas = []
  const areasMap = new Map()
  progress.forEach(p => {
    if (!areasMap.has(p.area)) {
      areasMap.set(p.area, { area: p.area, values: [] })
    }
    areasMap.get(p.area).values.push(p.mejor_porcentaje || 0)
  })
  areasMap.forEach(({ area, values }) => {
    temas.push({
      nombre: getAreaLabel(area),
      color: AREA_COLORS[area] || 'bg-slate-100 text-slate-600',
      progreso: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    })
  })

  return (
    <div className="feed-container pb-4 fade-in">

      {/* Cabecera del perfil */}
      <div className="ar-card p-6 mb-4 text-center bg-gradient-to-b from-slate-50 to-white">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          className={`rank-halo rank-${highestRank} relative w-20 h-20 rounded-2xl bg-[color:var(--ar-primary)] text-white flex items-center justify-center text-3xl font-extrabold mx-auto mb-3 overflow-hidden`}
          aria-label="Cambiar foto de perfil"
        >
          {user?.imagen_perfil
            ? <img src={user.imagen_perfil} alt="Foto de perfil" className="h-full w-full object-cover" />
            : user?.nombre_visible?.charAt(0) || '?'}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/35 py-1"><Camera size={14} /></span>
        </button>
        <input ref={avatarInputRef} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} />
        {avatarError && <p role="alert" className="mb-2 text-xs font-semibold text-red-600">{avatarError}</p>}
        {uploadingAvatar && <p className="mb-2 text-xs font-semibold text-[color:var(--ar-primary)]">Actualizando foto…</p>}
        <h1 className="text-xl font-extrabold text-slate-900">{user?.nombre_visible}</h1>
        <p className="text-sm text-[color:var(--ar-muted)] font-semibold mt-0.5 capitalize">
          {user?.rol} · Grado 5.°
        </p>

        {(() => {
          const obtenidos = logros.filter(l => l.obtenido)
          let rangoActual = null
          for (const r of ['diamante', 'oro', 'plata', 'bronce']) {
            if (obtenidos.some(l => l.rango === r)) { rangoActual = r; break }
          }
          if (!rangoActual) return null
          const meta = LOGRO_RANKS[rangoActual]
          return (
            <span className={`inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full text-xs font-extrabold border-2 ${meta.borderClass} ${meta.badgeClass}`}>
              Rango {meta.label}
            </span>
          )
        })()}

        {/* Mi avance */}
        <div className="mt-4 text-left">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-extrabold text-[color:var(--ar-muted)] uppercase tracking-wide">Mi avance general</span>
            <span className="text-sm font-extrabold text-[color:var(--ar-primary)]">{overall}%</span>
          </div>
          <ProgressBar value={overall} />
        </div>
      </div>

      {/* Editar perfil */}
      <section className="ar-card mb-4 p-5">
        <div className="mb-4 flex items-center gap-2"><Settings className="text-[color:var(--ar-primary)]" size={21} /><h2 className="font-extrabold text-slate-900">Editar perfil</h2></div>
        <ProfileEditForm />
      </section>

      {/* Apariencia */}
      <section className="ar-card mb-4 p-5">
        <div className="mb-4 flex items-center gap-2"><Palette className="text-[color:var(--ar-primary)]" size={21} /><h2 className="font-extrabold text-slate-900">Apariencia</h2></div>
        <ThemePanel />
      </section>

      {/* Mis logros */}
      <section className="mb-4">
        <div className="flex items-center justify-between px-1 mb-2">
          <h2 className="ar-section-title">Mis logros</h2>
          <span className="text-xs font-extrabold text-[color:var(--ar-muted)]">
            {logros.filter(l => l.obtenido).length}/{logros.length} obtenidos
          </span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[...logros]
            .sort((a, b) => {
              const ao = a.obtenido ? 0 : 1
              const bo = b.obtenido ? 0 : 1
              if (ao !== bo) return ao - bo
              if (a.obtenido) {
                return LOGRO_RANK_ORDER.indexOf(b.rango) - LOGRO_RANK_ORDER.indexOf(a.rango)
              }
              return 0
            })
            .map(l => {
              const rank = LOGRO_RANKS[l.rango]
              const width = 112
              return (
                <div
                  key={l.id}
                  title={`${l.nombre} · ${rank.label} — ${l.descripcion}`}
                  className={`ar-card flex-shrink-0 flex flex-col items-center text-center border-2 ${
                    l.obtenido
                      ? `${rank.borderClass} ring-1 ${rank.ringClass} shadow-md ${rank.glowClass}`
                      : 'border-dashed border-slate-200 opacity-50 grayscale'
                  }`}
                  style={{ width }}
                >
                  <div className="w-full px-2 pt-2">
                    <span className={`ar-badge ${l.obtenido ? rank.badgeClass : 'bg-slate-100 text-slate-400'} w-full justify-center`}>
                      {l.obtenido ? rank.label : 'Bloqueado'}
                    </span>
                  </div>
                  <span className="text-3xl mb-1 mt-1.5">{l.icono}</span>
                  <p className={`text-[10px] font-extrabold leading-tight px-1 ${l.obtenido ? 'text-slate-900' : 'text-slate-500'}`}>{l.nombre}</p>
                  <p className={`text-[9px] font-bold mt-1 mb-2 ${l.obtenido ? rank.textClass : 'text-slate-400'}`}>
                    {l.obtenido ? '¡Obtenido!' : 'Por obtener'}
                  </p>
                </div>
              )
            })}
        </div>
      </section>

      {/* Mis publicaciones */}
      <section className="mb-4">
        <h2 className="ar-section-title px-1">Mis publicaciones</h2>
        <div className="ar-card divide-y divide-slate-50">
          {stats.map((s, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xl">{s.emoji}</span>
              <span className="flex-1 text-sm font-semibold text-slate-700">{s.label}</span>
              <span className="text-lg font-extrabold text-slate-900">{s.value}</span>
            </div>
          ))}
          <button
            onClick={() => navigate(['docente','administrador'].includes(user?.rol) ? '/admin/lecturas' : '/lecturas')}
            className="flex items-center gap-2 px-4 py-3 w-full text-left text-sm font-bold text-[color:var(--ar-primary)] hover:bg-[color:var(--ar-primary-light)] transition-colors"
          >
            <FileText size={16} />
            Ver todas mis publicaciones
            <ChevronRight size={15} className="ml-auto" />
          </button>
        </div>
      </section>

      {/* Progreso por temas */}
      <section className="mb-4">
        <h2 className="ar-section-title px-1">Progreso por temas</h2>
        <div className="ar-card divide-y divide-slate-50">
          {temas.map((t, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`ar-badge ${t.color}`}>{t.nombre}</span>
                <span className="text-xs font-extrabold text-slate-700">{t.progreso}%</span>
              </div>
              <ProgressBar value={t.progreso} />
            </div>
          ))}
        </div>
      </section>

      {/* Actividades completadas */}
      <section className="mb-6">
        <h2 className="ar-section-title px-1">Mis actividades</h2>
        <div className="ar-card divide-y divide-slate-50">
          {progress.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                ${p.mejor_porcentaje === 100 ? 'bg-green-100 text-green-600' :
                  p.total_intentos > 0 ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-400'}`}>
                {p.mejor_porcentaje === 100 ? '✅' : p.total_intentos > 0 ? '📝' : <Clock size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 line-clamp-1">{p.titulo}</p>
                <p className="text-xs text-[color:var(--ar-muted)]">
                  {p.total_intentos === 0 ? 'Sin intentos' : `Mejor: ${p.mejor_porcentaje}% · ${p.total_intentos} intento(s)`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cerrar sesión */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors"
      >
        <LogOut size={18} />
        Cerrar sesión
      </button>
    </div>
  )
}
