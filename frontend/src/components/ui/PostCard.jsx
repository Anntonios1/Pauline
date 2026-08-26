import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { Bookmark, ChevronRight, CheckCircle, HelpCircle, Zap, Star, Trash2, MessageCircle } from 'lucide-react'
import { publicationStyleClasses, publicationCoverClasses } from '../../utils/publicationStyle'
import ImageViewer from '../media/ImageViewer'

const TIPO_CONFIG = {
  lectura:    { label: '📖 Lectura',    cls: 'badge-lectura' },
  reto:       { label: '⚡ Reto',       cls: 'badge-reto' },
  pregunta:   { label: '❓ Pregunta',   cls: 'badge-pregunta' },
  actividad:  { label: '🧩 Actividad',  cls: 'badge-actividad' },
  estudiante: { label: '✍️ Estudiante', cls: 'badge-estudiante' },
  aviso:      { label: '📢 Aviso',      cls: 'badge-aviso' },
  video:      { label: '🎥 Video',      cls: 'badge-video' },
  recurso:    { label: '📁 Recurso',    cls: 'badge-recurso' },
}

const REACCIONES = [
  { key: 'entendi',   emoji: '👍', label: 'Entendí' },
  { key: 'sorpresa',  emoji: '🤩', label: 'Me sorprendió' },
  { key: 'duda',      emoji: '🤔', label: 'Tengo una duda' },
  { key: 'practicar', emoji: '💪', label: 'Quiero practicar' },
]

export default function PostCard({ post, className = '', canModerate = false, onArchive }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [reacciones, setReacciones] = useState(post.reacciones || {})
  const [misReacciones, setMisReacciones] = useState(new Set(post.misReacciones || []))
  const [guardado, setGuardado] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [imagenAmpliada, setImagenAmpliada] = useState(false)
  // Marca las pulsaciones en vuelo: mientras el servidor no confirme, lo que se
  // ve en pantalla manda sobre lo que llegue del feed.
  const enviandoRef = useRef(0)

  /* `useState` solo corre al montar. Cuando el aviso del WebSocket recarga el
     feed y llega un `post` con los conteos de otro dispositivo, hay que
     copiarlos al estado local o la tarjeta se queda con los de hace un rato —
     que es justo el "no se actualiza en el otro dispositivo". Se ignora
     mientras haya una reacción propia sin confirmar, para no ver el contador
     saltar hacia atrás y volver. */
  const conteosDelServidor = JSON.stringify(post.reacciones || {})
  const miasDelServidor = JSON.stringify(post.misReacciones || [])
  useEffect(() => {
    if (enviandoRef.current > 0) return
    setReacciones(post.reacciones || {})
    setMisReacciones(new Set(post.misReacciones || []))
    // Se comparan serializados: el objeto es nuevo en cada recarga aunque el
    // contenido sea idéntico, y compararlo por referencia haría esto inútil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conteosDelServidor, miasDelServidor])

  const tipoConfig = TIPO_CONFIG[post.tipo] || TIPO_CONFIG.lectura
  const isTeacher = post.autor?.rol === 'docente' || post.autor?.rol === 'administrador'
  // Apariencia elegida por quien publicó (acento + portada por patrón).
  const estiloClases = publicationStyleClasses(post.estilo_visual)
  const portadaClases = publicationCoverClasses(post.estilo_visual)

  const handleReaccion = async (key) => {
    if (!post.publicacion_id) return
    // Se pinta al instante y se confirma con el servidor: esperar la respuesta
    // para mover el botón se siente roto en un móvil con mala conexión.
    const previoMias = misReacciones
    const previoConteos = reacciones
    const nuevo = new Set(misReacciones)
    const optimista = { ...reacciones }
    if (nuevo.has(key)) {
      nuevo.delete(key)
      optimista[key] = Math.max(0, (optimista[key] || 1) - 1)
    } else {
      nuevo.add(key)
      optimista[key] = (optimista[key] || 0) + 1
    }
    setMisReacciones(nuevo)
    setReacciones(optimista)

    enviandoRef.current += 1
    try {
      // La respuesta trae los conteos reales, que pueden diferir de la
      // estimación si alguien más reaccionó en paralelo.
      const server = await api.toggleReaction(post.publicacion_id, key)
      setReacciones(server.reacciones || {})
      setMisReacciones(new Set(server.mis_reacciones || []))
    } catch {
      setMisReacciones(previoMias)
      setReacciones(previoConteos)
    } finally {
      enviandoRef.current -= 1
    }
  }

  const totalReacciones = Object.values(reacciones).reduce((a, b) => a + b, 0)

  return (
    <article className={`post-card ${className} ${estiloClases} ${post.destacada ? 'border-l-4 border-[color:var(--ar-primary)]' : ''} ${post.tipo === 'actividad' ? 'bg-gradient-to-br from-violet-50 via-white to-cyan-50' : ''}`}>
      {/* Portada por patrón: solo si el autor eligió uno y no subió imagen */}
      {portadaClases && !post.imagen && (
        <div className={portadaClases} style={{ height: 96 }} aria-hidden="true" />
      )}

      {/* Header */}
      <div className="post-card-header">
        {/* Avatar */}
        <div
          className={`avatar-md flex-shrink-0 text-white ${post.autor?.color || 'bg-teal-500'}`}
          aria-hidden="true"
        >
          {post.autor?.imagen
            ? <img src={post.autor.imagen} alt="" className="h-full w-full object-cover" />
            : (post.autor?.iniciales || '?')}
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-extrabold text-sm ${isTeacher ? 'text-purple-700' : 'text-slate-900'}`}>
              {post.autor?.nombre}
            </span>
            {isTeacher && (
              <span className="text-xs bg-purple-100 text-purple-600 font-bold px-1.5 py-0.5 rounded-full">
                {post.autor.rol === 'administrador' ? 'Admin' : 'Docente'}
              </span>
            )}
          </div>
          <p className="text-xs text-[color:var(--ar-muted)] font-semibold">
            {post.materia} · {post.tiempo || 'Hace un momento'}
          </p>
        </div>

        {/* Tipo badge + guardar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={tipoConfig.cls}>{tipoConfig.label}</span>
          <button
            onClick={() => setGuardado(!guardado)}
            className={`p-1.5 rounded-lg transition-colors ${guardado ? 'text-[color:var(--ar-primary)] bg-[color:var(--ar-primary-light)]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            aria-label={guardado ? 'Guardado' : 'Guardar'}
          >
            <Bookmark size={16} fill={guardado ? 'currentColor' : 'none'} />
          </button>
          {canModerate && post.publicacion_id && (
            <button
              type="button"
              onClick={() => onArchive?.(post)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Retirar publicación"
              title="Retirar publicación"
            ><Trash2 size={16} /></button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="post-card-body">
        {post.titulo && (
          <h3 className="font-extrabold text-slate-900 text-base mb-1 leading-snug">{post.titulo}</h3>
        )}
        <p className={`text-sm text-slate-700 leading-relaxed ${!expanded && 'line-clamp-3'}`}>
          {post.contenido}
        </p>
        {post.contenido?.length > 180 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-bold text-[color:var(--ar-primary)] mt-1 hover:underline"
          >
            {expanded ? 'Ver menos' : 'Ver más'}
          </button>
        )}

        {/* Etiquetas — ortogonales a la categoría, no la reemplazan */}
        {post.etiquetas?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {post.etiquetas.map(etiqueta => (
              <span
                key={etiqueta.id}
                className="rounded-full bg-[color:var(--ar-primary-light)] px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--ar-primary-dark)]"
              >
                {etiqueta.nombre}
              </span>
            ))}
          </div>
        )}

        {/* Imagen */}
        {post.imagen && (
          <button
            type="button"
            onClick={() => setImagenAmpliada(true)}
            className="mt-3 block w-full cursor-zoom-in rounded-xl overflow-hidden bg-slate-100"
            style={{ maxHeight: 280 }}
            aria-label="Ampliar imagen de la publicación"
          >
            <img src={post.imagen} alt="Imagen de la publicación" className="w-full object-cover" />
          </button>
        )}
        {imagenAmpliada && (
          <ImageViewer
            url={post.imagen}
            alt={post.titulo || 'Imagen de la publicación'}
            onClose={() => setImagenAmpliada(false)}
          />
        )}

        {/* Total reacciones */}
        {totalReacciones > 0 && (
          <p className="text-xs text-[color:var(--ar-muted)] mt-2 font-semibold">
            {REACCIONES.filter(r => (reacciones[r.key] || 0) > 0).slice(0, 3).map(r => r.emoji).join(' ')} {totalReacciones} {totalReacciones === 1 ? 'reacción' : 'reacciones'}
          </p>
        )}
      </div>

      {/* Footer — Reacciones */}
      <div className="post-card-footer flex-wrap gap-0.5">
        {REACCIONES.map(r => (
          <button
            key={r.key}
            onClick={() => handleReaccion(r.key)}
            className={`reaction-btn ${misReacciones.has(r.key) ? 'active' : ''}`}
            aria-pressed={misReacciones.has(r.key)}
          >
            <span>{r.emoji}</span>
            <span className="hidden sm:inline">{r.label}</span>
            {(reacciones[r.key] || 0) > 0 && (
              <span className="text-xs font-bold opacity-70">{reacciones[r.key]}</span>
            )}
          </button>
        ))}
        {post.publicacion_slug && (
          <button onClick={() => navigate(`/lecturas/${post.publicacion_slug}#comentarios`)} className="reaction-btn ml-auto">
            <MessageCircle size={16} />
            <span>{post.comentarios_count || 0}</span>
          </button>
        )}
      </div>

      {post.comentarios_count > 0 && post.comentario_destacado && (
        <button type="button" onClick={() => navigate(`/lecturas/${post.publicacion_slug}#comentarios`)} className="w-full border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-left hover:bg-slate-100">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700"><MessageCircle size={14} /></span>
            <div className="min-w-0 flex-1"><p className="text-xs font-extrabold text-slate-700">{post.comentario_autor || 'Comentario destacado'}</p><p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{post.comentario_destacado}</p><p className="mt-1 text-[11px] font-bold text-teal-700">Ver {post.comentarios_count} comentario{post.comentarios_count === 1 ? '' : 's'}</p></div>
          </div>
        </button>
      )}

      {/* CTA — Actividad enlazada */}
      {post.actividad_id && (
        <div className="px-4 py-3 bg-gradient-to-r from-[color:var(--ar-primary-light)] to-teal-50 border-t border-teal-100">
          <button
            onClick={() => navigate(`/actividades/${post.actividad_id}`)}
            className="w-full flex items-center justify-between text-sm font-bold text-[color:var(--ar-primary)] hover:opacity-80 transition-opacity"
          >
            <span className="flex items-center gap-2">
              <Zap size={15} />
              {canModerate ? 'Abrir vista previa' : 'Responder actividad'}
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* CTA — Lectura enlazada */}
      {post.publicacion_slug && !post.actividad_id && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
          <button
            onClick={() => navigate(`/lecturas/${post.publicacion_slug}`)}
            className="w-full flex items-center justify-between text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ChevronRight size={15} />
              Leer publicación completa
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </article>
  )
}
