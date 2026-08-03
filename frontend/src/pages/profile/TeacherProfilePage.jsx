import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Award, BookOpen, Camera, ClipboardList, FolderOpen, LogOut, Palette, Settings, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import ProfileEditForm from '../../components/profile/ProfileEditForm'
import ThemePanel from '../../components/ui/ThemePanel'

const initials = (name = '') => name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase() || 'D'

export default function TeacherProfilePage() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [activities, setActivities] = useState([])
  const [publications, setPublications] = useState([])
  const [resources, setResources] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id) return
    Promise.all([
      api.getActivities({ creador_id: user.id }),
      api.getPublications({ autor_id: user.id }),
      api.getResources({ subido_por: user.id, estado: '', activos: 'false' }),
    ]).then(([myActivities, myPublications, myResources]) => {
      setActivities(myActivities || [])
      setPublications(myPublications || [])
      setResources(myResources || [])
    }).catch(() => setError('No se pudo cargar el resumen de tu perfil.'))
  }, [user?.id])

  const stats = useMemo(() => [
    { label: 'Quizzes creados', value: activities.length, icon: ClipboardList, path: '/admin/actividades', tone: 'from-violet-500 to-purple-600' },
    { label: 'Lecturas y avisos', value: publications.length, icon: BookOpen, path: '/admin/lecturas', tone: 'from-sky-500 to-cyan-600' },
    { label: 'Recursos propios', value: resources.length, icon: FolderOpen, path: '/admin/recursos', tone: 'from-amber-500 to-orange-500' },
  ], [activities.length, publications.length, resources.length])
  const creationCount = activities.length + publications.length + resources.length
  const profileRank = creationCount >= 12 ? 'diamante' : creationCount >= 7 ? 'oro' : creationCount >= 3 ? 'plata' : 'bronce'

  const achievements = [
    { title: 'Primer contenido', done: activities.length + publications.length > 0, emoji: '🌱', description: 'Publicaste tu primer recurso para la clase.' },
    { title: 'Diseñador de experiencias', done: activities.length >= 3, emoji: '🧩', description: 'Creaste tres quizzes interactivos.' },
    { title: 'Biblioteca activa', done: resources.length >= 3, emoji: '📚', description: 'Guardaste tres recursos reutilizables.' },
  ]

  const handleAvatar = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true); setError('')
    try {
      const result = await api.uploadMyAvatar(file)
      updateUser({ imagen_perfil: result.imagen_perfil })
    } catch (uploadError) {
      setError(uploadError.message || 'No se pudo actualizar la foto.')
    } finally { setUploading(false); event.target.value = '' }
  }

  return (
    <div className="feed-container pb-5 fade-in space-y-4">
      <section className="rounded-3xl bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700 p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => inputRef.current?.click()} className={`rank-halo rank-${profileRank} relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-2 border-white/50 bg-white/15 text-2xl font-black`} aria-label={`Cambiar foto de perfil. Rango ${profileRank}`}>
            {user?.imagen_perfil ? <img src={user.imagen_perfil} alt="Foto de perfil" className="h-full w-full object-cover" /> : initials(user?.nombre_visible)}
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/35 py-1"><Camera size={14} /></span>
          </button>
          <input ref={inputRef} className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatar} />
          <div>
            <p className="text-sm font-semibold text-white/75">Espacio docente</p>
            <h1 className="text-2xl font-black">{user?.nombre_visible}</h1>
            <p className="mt-1 text-sm text-white/80">Creador/a de experiencias · Rango {profileRank}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm"><Users size={18} /> El progreso se consulta por grupo, no como estudiante.</div>
      </section>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
      {uploading && <p className="text-sm font-semibold text-violet-700">Actualizando imagen…</p>}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center gap-2"><Settings className="text-violet-600" size={21} /><h2 className="font-extrabold text-slate-900">Editar perfil</h2></div>
        <ProfileEditForm />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center gap-2"><Palette className="text-violet-600" size={21} /><h2 className="font-extrabold text-slate-900">Apariencia</h2></div>
        <ThemePanel />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, path, tone }) => <button key={label} type="button" onClick={() => navigate(path)} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md">
          <span className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${tone} p-2.5 text-white`}><Icon size={20} /></span>
          <p className="text-2xl font-black text-slate-900">{value}</p><p className="text-sm font-bold text-slate-500">{label}</p>
        </button>)}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="mb-4 flex items-center gap-2"><Award className="text-amber-500" size={21} /><h2 className="font-extrabold text-slate-900">Logros docentes</h2></div>
        <div className="grid gap-3 sm:grid-cols-3">{achievements.map(achievement => <div key={achievement.title} className={`rounded-2xl p-4 ${achievement.done ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-slate-50 opacity-70'}`}>
          <span className="text-2xl">{achievement.emoji}</span><p className="mt-2 font-extrabold text-slate-900">{achievement.title}</p><p className="mt-1 text-xs text-slate-600">{achievement.description}</p>
        </div>)}</div>
      </section>

      <button type="button" onClick={() => { logout(); navigate('/login') }} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-red-200 py-3 font-bold text-red-600 hover:bg-red-50"><LogOut size={18} /> Cerrar sesión</button>
    </div>
  )
}
