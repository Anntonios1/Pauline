/**
 * Estilo visual de una publicación.
 *
 * El backend guarda `estilo_visual` como JSON ({acento, patron}) ya validado
 * contra listas blancas (api/config/settings.py). Aquí solo se traduce a las
 * clases del monolito CSS (styles/index.css, sección 08).
 */

export const ACENTOS_PUB = [
  { value: 'turquesa',  label: 'Turquesa',  color: '#0ea5a5' },
  { value: 'violeta',   label: 'Violeta',   color: '#7c3aed' },
  { value: 'azul',      label: 'Azul',      color: '#2563eb' },
  { value: 'coral',     label: 'Coral',     color: '#f43f5e' },
  { value: 'ambar',     label: 'Ámbar',     color: '#f59e0b' },
  { value: 'esmeralda', label: 'Esmeralda', color: '#10b981' },
  { value: 'rosa',      label: 'Rosa',      color: '#ec4899' },
  { value: 'indigo',    label: 'Índigo',    color: '#6366f1' },
]

export const PATRONES_PUB = [
  { value: 'liso',     label: 'Liso' },
  { value: 'puntos',   label: 'Puntos' },
  { value: 'rejilla',  label: 'Rejilla' },
  { value: 'ondas',    label: 'Ondas' },
  { value: 'rayos',    label: 'Rayos' },
  { value: 'confeti',  label: 'Confeti' },
]

const ACENTOS_VALIDOS = new Set(ACENTOS_PUB.map(a => a.value))
const PATRONES_VALIDOS = new Set(PATRONES_PUB.map(p => p.value))

/** Acepta el JSON del backend (cadena u objeto) y devuelve {acento, patron} o null. */
export function parsePublicationStyle(valor) {
  if (!valor) return null
  let datos = valor
  if (typeof datos === 'string') {
    try { datos = JSON.parse(datos) } catch { return null }
  }
  if (!datos || typeof datos !== 'object') return null
  const acento = ACENTOS_VALIDOS.has(datos.acento) ? datos.acento : null
  const patron = PATRONES_VALIDOS.has(datos.patron) ? datos.patron : null
  if (!acento && !patron) return null
  return { acento, patron }
}

/** Clases para envolver la tarjeta/artículo. Vacío si la publicación no tiene estilo. */
export function publicationStyleClasses(valor, { conBarra = true } = {}) {
  const estilo = parsePublicationStyle(valor)
  if (!estilo) return ''
  return [
    'pub-themed',
    estilo.acento ? `pub-a-${estilo.acento}` : '',
    conBarra && estilo.acento ? 'pub-bar' : '',
  ].filter(Boolean).join(' ')
}

/** Clases de la portada generada por patrón (solo si hay patrón y no hay imagen). */
export function publicationCoverClasses(valor) {
  const estilo = parsePublicationStyle(valor)
  if (!estilo?.patron || estilo.patron === 'liso') return ''
  return `pub-cover pub-p-${estilo.patron}`
}
