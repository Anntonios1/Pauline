import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import PostCard from '../../components/ui/PostCard'
import QuickChallengeCard from '../../components/ui/QuickChallengeCard'
import CreateBox from '../../components/ui/CreateBox'
import { publicationToPost, activityToChallenge } from '../../utils/feed'
import { ChevronRight, Pin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import * as api from '../../services/api'
import { PostCardSkeleton, ChallengeCardSkeleton, SkeletonGroup } from '../../components/ui/Skeleton'

export default function FeedPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { publications, activities, progress, refresh, loading } = useData()
  const [filter, setFilter] = useState('todos')
  const [actionError, setActionError] = useState('')
  const isTeacher = ['docente', 'administrador'].includes(user?.rol)

  const filters = [
    { key: 'todos',      label: 'Todo' },
    { key: 'lectura',    label: '📖 Lecturas' },
    { key: 'actividad',  label: '🧩 Actividades' },
    { key: 'estudiante', label: '✍️ Compañeros' },
  ]

  const pubPosts = publications.map(publicationToPost)
  const pinnedPost = pubPosts.find(p => p.destacada)

  // Mapea actividades a "posts" tipo actividad para que el filtro muestre algo
  const activityPosts = activities.slice(0, 8).map(a => ({
    id: `act-${a.id}`,
    tipo: 'actividad',
    autor: { nombre: 'Docente', rol: 'docente', iniciales: 'D', color: 'bg-purple-500' },
    materia: a.categoria_nombre || 'Ciencias Naturales',
    tiempo: 'Recientemente',
    titulo: `🧩 ${a.titulo}`,
    contenido: a.descripcion || '',
    imagen: a.imagen_portada || null,
    reacciones: {},
    misReacciones: [],
    actividad_id: a.id,
    destacada: false,
  }))

  const allPosts = [...pubPosts, ...activityPosts]
  const otherPosts = allPosts.filter(p => {
    if (p.destacada && filter === 'todos') return false
    if (filter !== 'todos' && p.tipo !== filter) return false
    return true
  })

  const challenges = activities
    .filter(a => Number(a.preguntas_count) > 0)
    .slice(0, 5)
    .map(a => activityToChallenge(a, progress))

  const archivePost = async (post) => {
    if (!window.confirm(`¿Retirar "${post.titulo}" del feed?`)) return
    try {
      setActionError('')
      await api.archivePublication(post.publicacion_id)
      await refresh()
    } catch (error) {
      setActionError(error.message || 'No se pudo retirar la publicación.')
    }
  }

  return (
    <div className="feed-container pb-4 fade-in">

      {/* Saludo personalizado (solo móvil, desktop usa sidebar) */}
      <div className="md:hidden mb-3">
        <h1 className="text-xl font-extrabold text-slate-900 leading-tight">
          Hola, {user?.nombre_visible?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-[color:var(--ar-muted)] font-semibold">¿Qué vamos a aprender hoy?</p>
      </div>

      {/* Retos rápidos */}
      <section className="mb-3" aria-label="Retos rápidos">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <h2 className="text-sm font-extrabold text-[color:var(--ar-muted)] uppercase tracking-wide">
            ⚡ Retos rápidos
          </h2>
          <button
            onClick={() => navigate(isTeacher ? '/admin/actividades' : '/explorar')}
            className="text-xs font-bold text-[color:var(--ar-primary)] flex items-center gap-0.5 hover:underline"
          >
            Ver todos <ChevronRight size={13} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar" style={{ scrollSnapType: 'x mandatory' }}>
          {loading ? (
            <SkeletonGroup count={4} label="Cargando retos" className="flex gap-3">
              <ChallengeCardSkeleton />
            </SkeletonGroup>
          ) : (
            challenges.map((c, i) => (
              <div key={c.id} style={{ scrollSnapAlign: 'start', animationDelay: `${i * 70}ms` }} className="a-pop">
                <QuickChallengeCard challenge={c} />
              </div>
            ))
          )}
          {!loading && challenges.length === 0 && (
            <p className="text-sm text-[color:var(--ar-muted)] py-4">No hay retos disponibles aún</p>
          )}
        </div>
      </section>

      {/* Caja de creación */}
      <CreateBox />

      {isTeacher && (
        <section className="mb-4 grid gap-3 sm:grid-cols-3 stagger">
          <button onClick={() => navigate('/admin/crear-juego')} className="hover-lift press gradient-pan rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-4 text-left text-white shadow-sm"><b className="block">Crear quiz</b><span className="text-sm text-white/80">Diseña bloques, imágenes y audio.</span></button>
          <button onClick={() => navigate('/admin/crear?tipo=lectura')} className="hover-lift press gradient-pan rounded-2xl bg-gradient-to-br from-sky-500 via-cyan-500 to-cyan-600 p-4 text-left text-white shadow-sm"><b className="block">Nueva lectura</b><span className="text-sm text-white/80">Publica directamente para la clase.</span></button>
          <button onClick={() => navigate('/admin/recursos')} className="hover-lift press gradient-pan rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 p-4 text-left text-white shadow-sm"><b className="block">Biblioteca</b><span className="text-sm text-white/80">Gestiona PDF, videos, audio e imágenes.</span></button>
        </section>
      )}
      {actionError && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{actionError}</p>}

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar" role="tablist" aria-label="Filtrar publicaciones">
        {filters.map(f => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`ar-chip press ${filter === f.key ? 'active' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Publicación destacada */}
      {pinnedPost && filter === 'todos' && (
        <div className="mb-1">
          <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
            <Pin size={13} className="text-[color:var(--ar-primary)]" />
            <span className="text-xs font-extrabold text-[color:var(--ar-primary)] uppercase tracking-wide">Fijado</span>
          </div>
          <PostCard post={pinnedPost} canModerate={isTeacher} onArchive={archivePost} />
        </div>
      )}

      {/* Muro de publicaciones */}
      <section aria-label="Publicaciones de la clase">
        {loading ? (
          <SkeletonGroup count={3} label="Cargando publicaciones">
            <PostCardSkeleton />
          </SkeletonGroup>
        ) : (
          /* key en el contenedor: al cambiar de filtro se re-monta y la
             cascada de entrada vuelve a correr en vez de aparecer de golpe. */
          <div key={filter} className="stagger">
            {otherPosts.map(post => (
              <PostCard key={post.id} post={post} canModerate={isTeacher} onArchive={archivePost} />
            ))}
          </div>
        )}

        {!loading && otherPosts.length === 0 && (
          <div className="ar-card p-10 text-center a-scale">
            <p className="text-3xl mb-3 a-float">🔍</p>
            <p className="font-bold text-slate-700">No hay publicaciones de este tipo</p>
            <p className="text-sm text-[color:var(--ar-muted)] mt-1">Prueba otro filtro</p>
          </div>
        )}
      </section>
    </div>
  )
}
