import { getInitials, getAreaLabel, getDifficultyLabel } from './format'
import { areaGradients } from '../data/labels'

const ROLE_COLORS = {
  docente: 'bg-purple-500',
  administrador: 'bg-purple-700',
  estudiante: 'bg-orange-400',
}

export function timeAgo(dateString) {
  if (!dateString) return 'Recientemente'
  const date = new Date(dateString)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'Ahora'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Hace ${days} d`
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function publicationToPost(pub) {
  const rol = ['docente', 'administrador'].includes(pub.autor_rol) ? pub.autor_rol : 'estudiante'
  return {
    id: pub.id,
    tipo: rol === 'estudiante' ? 'estudiante' : 'lectura',
    autor: {
      nombre: pub.autor_nombre || 'Estudiante',
      rol,
      iniciales: getInitials(pub.autor_nombre),
      color: ROLE_COLORS[rol] || ROLE_COLORS.estudiante,
      imagen: pub.autor_imagen || null,
    },
    materia: pub.categoria_nombre || 'Ciencias Naturales',
    tiempo: timeAgo(pub.fecha_publicacion || pub.fecha_creacion),
    titulo: pub.titulo,
    contenido: stripHtml(pub.contenido),
    imagen: pub.imagen_portada || null,
    reacciones: pub.reacciones || {},
    misReacciones: pub.mis_reacciones || [],
    publicacion_slug: pub.slug,
    publicacion_id: pub.id,
    comentarios_count: Number(pub.comentarios_count || 0),
    comentario_destacado: pub.comentario_destacado || null,
    comentario_autor: pub.comentario_autor || null,
    estilo_visual: pub.estilo_visual || null,
    etiquetas: pub.etiquetas || [],
    destacada: false,
  }
}

const ACTIVITY_EMOJIS = {
  quiz: '⚡',
  verdadero_falso: '✅',
  reflexion: '💬',
  completar: '🧩',
  ordenar: '🔄',
  encuesta: '📊',
}

export function activityToChallenge(activity, progress = []) {
  const prog = progress.find(p => Number(p.id) === Number(activity.id))
  const card = activity.config?.feed_card || activity.quiz_config?.feed_card || {}
  return {
    id: activity.id,
    titulo: activity.titulo,
    subtitulo: `${getAreaLabel(activity.area)} · ${getDifficultyLabel(activity.dificultad)}`,
    emoji: ACTIVITY_EMOJIS[activity.tipo] || '⚡',
    gradiente: card.gradiente || card.gradient || areaGradients[activity.area] || 'from-teal-400 to-teal-600',
    actividad_id: activity.id,
    completado: !!prog && prog.mejor_porcentaje === 100,
  }
}

/* ---- Rangos de logros ----
   Cada rango define el color del borde y el acento que se
   muestra en el perfil. Las clases Tailwind deben aparecer
   literalmente aquí para que el JIT no las purgue. */
export const LOGRO_RANKS = {
  bronce: {
    key: 'bronce',
    label: 'Bronce',
    color: '#d97706',
    borderClass: 'border-amber-400',
    ringClass: 'ring-amber-200',
    badgeClass: 'bg-amber-100 text-amber-700',
    glowClass: 'shadow-amber-200/60',
    textClass: 'text-amber-600',
  },
  plata: {
    key: 'plata',
    label: 'Plata',
    color: '#64748b',
    borderClass: 'border-slate-400',
    ringClass: 'ring-slate-200',
    badgeClass: 'bg-slate-200 text-slate-700',
    glowClass: 'shadow-slate-300/60',
    textClass: 'text-slate-600',
  },
  oro: {
    key: 'oro',
    label: 'Oro',
    color: '#ca8a04',
    borderClass: 'border-yellow-400',
    ringClass: 'ring-yellow-200',
    badgeClass: 'bg-yellow-100 text-yellow-700',
    glowClass: 'shadow-yellow-300/60',
    textClass: 'text-yellow-600',
  },
  diamante: {
    key: 'diamante',
    label: 'Diamante',
    color: '#0891b2',
    borderClass: 'border-cyan-400',
    ringClass: 'ring-cyan-200',
    badgeClass: 'bg-cyan-100 text-cyan-700',
    glowClass: 'shadow-cyan-300/60',
    textClass: 'text-cyan-600',
  },
}

export const LOGRO_RANK_ORDER = ['bronce', 'plata', 'oro', 'diamante']

export function getLogroRankMeta(rango) {
  return LOGRO_RANKS[rango] || LOGRO_RANKS.bronce
}

/* Los logros ahora vienen del backend (GET /api/logros), que no guarda un
   "rango" — se deriva del puntos_bonus para reutilizar la estética existente. */
export function getLogroRankFromPuntos(puntosBonus = 0) {
  if (puntosBonus > 60) return 'diamante'
  if (puntosBonus > 35) return 'oro'
  if (puntosBonus > 15) return 'plata'
  return 'bronce'
}
