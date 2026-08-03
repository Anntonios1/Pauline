import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useData } from '../../contexts/DataContext'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Card, Badge, SectionTitle, EmptyState, LoadingState } from '../../components/ui'
import { Play, Sparkles, Image, Volume2, Layers3, ArrowRight } from 'lucide-react'
import * as api from '../../services/api'

const LIVE_MODES = [
  { value: 'quiz_race', label: 'Carrera en vivo', description: 'Tipo Kahoot: acierto y velocidad suman puntos.' },
  { value: 'speed', label: 'Velocidad extrema', description: 'La rapidez pesa más que en el modo normal.' },
  { value: 'classic', label: 'Clásico', description: 'Cada acierto vale lo mismo, sin presión por tiempo.' },
]

const CAPABILITIES = [
  { icon: Layers3, label: 'Preguntas y fichas', description: 'Combina retos evaluables con fichas informativas.' },
  { icon: Image, label: 'Contenido visual', description: 'Incluye imágenes en preguntas y opciones.' },
  { icon: Volume2, label: 'Audio integrado', description: 'Escucha pistas y explicaciones dentro del juego.' },
]

export default function GameLauncherPage() {
  const { activities, loading } = useData()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isTeacher = user?.rol === 'docente' || user?.rol === 'administrador'
  const playableActivities = activities.filter(activity => Number(activity.preguntas_count ?? 1) > 0)
  const activityBasePath = location.pathname.startsWith('/admin') ? '/admin/actividades' : '/actividades'
  const [liveMode, setLiveMode] = useState('quiz_race')
  const [creatingRoom, setCreatingRoom] = useState(null)
  const [roomError, setRoomError] = useState('')

  const createLiveRoom = async (activity) => {
    setCreatingRoom(activity.id); setRoomError('')
    try {
      const room = await api.createGameRoom(activity.id, liveMode)
      navigate(`/admin/sala/${room.code}`)
    } catch (error) { setRoomError(error.message || 'No se pudo crear la sala.') }
    finally { setCreatingRoom(null) }
  }

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Quizzes interactivos"
        subtitle="Un solo motor para aprender con preguntas, imágenes, audios y fichas, sin cambiar de experiencia."
      >
        {isTeacher && (
          <div className="mt-4">
            <Link
              to="/admin/crear-juego"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-teal-800 shadow transition-colors hover:bg-teal-50"
            >
              <Sparkles size={16} /> Crear quiz interactivo
            </Link>
          </div>
        )}
      </PageHeader>

      <section>
        {isTeacher && (
          <Card className="mb-5 border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-violet-600">Sesiones WebSocket</p><h2 className="mt-1 text-lg font-black text-slate-900">Modo de juego en vivo</h2><p className="mt-1 text-sm text-slate-600">Selecciona el formato y crea la sala desde cualquier quiz compatible.</p></div><label className="text-xs font-extrabold text-slate-600">Modo<select value={liveMode} onChange={event => setLiveMode(event.target.value)} className="mt-1 block rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold text-slate-800">{LIVE_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label></div>
            <p className="mt-3 rounded-xl bg-violet-100/70 px-3 py-2 text-xs font-semibold text-violet-800">{LIVE_MODES.find(mode => mode.value === liveMode)?.description}</p>
            {roomError && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{roomError}</p>}
          </Card>
        )}
        <SectionTitle
          title="Una experiencia, distintas formas de aprender"
          subtitle="Cada docente decide qué bloques necesita y el motor los presenta de forma consistente."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, label, description }) => (
            <Card key={label} className="p-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                <Icon size={22} />
              </div>
              <h3 className="font-bold text-slate-900">{label}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          title={`Quizzes disponibles (${playableActivities.length})`}
          subtitle="El contenido de cada actividad proviene de lo que publicó el docente."
        />

        {loading ? (
          <LoadingState message="Cargando quizzes..." />
        ) : playableActivities.length === 0 ? (
          <EmptyState
            title="Aún no hay quizzes publicados"
            description={isTeacher ? 'Crea el primero desde el constructor interactivo.' : 'Tu docente todavía no ha publicado actividades.'}
            emoji="🎮"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {playableActivities.map(activity => (
              <Card key={activity.id} className="overflow-hidden transition-colors hover:border-teal-300">
                {activity.imagen_portada && <img src={activity.imagen_portada} alt="" className="h-32 w-full object-cover" />}
                <div className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {Number(activity.live_questions_count) > 0 && <Badge className="bg-violet-100 text-violet-700">Juego interactivo</Badge>}
                    <Badge className="bg-slate-100 capitalize text-slate-600">{activity.dificultad}</Badge>
                    {activity.preguntas_count != null && (
                      <span className="text-xs text-slate-500">
                        {activity.preguntas_count} bloque{Number(activity.preguntas_count) === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <h3 className="truncate text-lg font-bold text-slate-900">{activity.titulo}</h3>
                  {activity.descripcion && (
                    <p className="line-clamp-2 text-sm text-slate-600">{activity.descripcion}</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  {isTeacher && Number(activity.live_questions_count) > 0 && <button type="button" onClick={() => createLiveRoom(activity)} disabled={creatingRoom === activity.id} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow disabled:opacity-60 hover:bg-violet-700"><Sparkles size={16} />{creatingRoom === activity.id ? 'Creando…' : 'Sala en vivo'}</button>}
                  <button type="button" onClick={() => navigate(`${activityBasePath}/${activity.id}`)} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow active:scale-95 hover:bg-teal-700" aria-label={`Abrir ${activity.titulo}`}><Play size={16} /> Vista previa <ArrowRight size={14} /></button>
                </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
