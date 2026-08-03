const BASE_URL = '/api'

/**
 * El token guardado quedó inválido (sesión expirada tras 24h, o cerrada desde
 * otro lugar). Sin esto, cada llamada seguía fallando en silencio: la página
 * se quedaba "rota" — nada cargaba y nada se podía guardar — sin decirle al
 * usuario que necesitaba volver a iniciar sesión.
 */
export function handleUnauthorized() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || `Error ${response.status}`)
  }

  return data
}

export async function login(codigo, password) {
  return fetchWithAuth('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ codigo, password }),
  })
}

export async function logout() {
  return fetchWithAuth('/auth/logout', { method: 'POST' })
}

export async function getCategories() {
  return fetchWithAuth('/categories')
}

export async function getLearningPath() {
  return fetchWithAuth('/learning-path')
}

export async function getPublications(params = {}) {
  const searchParams = new URLSearchParams(params)
  return fetchWithAuth(`/publications?${searchParams}`)
}

export async function getPublicationBySlug(slug) {
  return fetchWithAuth(`/publications/slug/${slug}`)
}

export async function createPublication(data) {
  return fetchWithAuth('/publications', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updatePublication(id, data) {
  return fetchWithAuth(`/publications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function archivePublication(id) {
  return updatePublication(id, { estado: 'archivada' })
}

export async function moderatePublication(id, data) {
  return fetchWithAuth(`/publications/${id}/moderate`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getActivities(params = {}) {
  const searchParams = new URLSearchParams(params)
  return fetchWithAuth(`/activities?${searchParams}`)
}

export async function getActivityById(id) {
  return fetchWithAuth(`/activities/${id}`)
}

export async function getQuestions(activityId) {
  return fetchWithAuth(`/activities/${activityId}/questions`)
}

export async function getQuiz(activityId) {
  return fetchWithAuth(`/activities/${activityId}/quiz`)
}

export async function createAttempt(actividadId) {
  return fetchWithAuth('/attempts', {
    method: 'POST',
    body: JSON.stringify({ actividad_id: actividadId }),
  })
}

export async function submitAttempt(intentoId, respuestas) {
  return fetchWithAuth(`/attempts/${intentoId}`, {
    method: 'POST',
    body: JSON.stringify({ respuestas }),
  })
}

export async function getProgress() {
  return fetchWithAuth('/progress')
}

export async function getMisLogros() {
  return fetchWithAuth('/logros')
}

export async function getResources(params = {}) {
  const searchParams = new URLSearchParams(params)
  return fetchWithAuth(`/resources?${searchParams}`)
}

export async function createResource(data) {
  return fetchWithAuth('/resources', { method: 'POST', body: JSON.stringify(data) })
}

export async function uploadResourceMedia(file) {
  const token = localStorage.getItem('token')
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${BASE_URL}/resource-media`, {
    method: 'POST', headers: { ...(token && { Authorization: `Bearer ${token}` }) }, body: formData,
  })
  if (response.status === 401) { handleUnauthorized(); throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.') }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || `Error ${response.status}`)
  return data
}

export async function createComment(publicationId, contenido, parentId = null) {
  return fetchWithAuth('/comments', {
    method: 'POST',
    body: JSON.stringify({
      publicacion_id: publicationId,
      contenido,
      comentario_padre_id: parentId,
    }),
  })
}

export async function deleteComment(id) {
  return fetchWithAuth(`/comments/${id}`, { method: 'DELETE' })
}

export async function getPendingComments() {
  return fetchWithAuth('/comments/pending')
}

export async function moderateComment(id, estado) {
  return fetchWithAuth(`/comments/${id}/moderate`, {
    method: 'POST',
    body: JSON.stringify({ estado }),
  })
}

export async function approveResource(id) {
  return fetchWithAuth(`/resources/${id}/approve`, { method: 'POST' })
}

export async function rejectResource(id) {
  return fetchWithAuth(`/resources/${id}/reject`, { method: 'POST' })
}

export async function updateMyProfile(data) {
  return fetchWithAuth('/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function uploadMyAvatar(file) {
  const token = localStorage.getItem('token')
  const formData = new FormData()
  formData.append('avatar', file)
  const response = await fetch(`${BASE_URL}/users/me/avatar`, {
    method: 'POST', headers: { ...(token && { Authorization: `Bearer ${token}` }) }, body: formData,
  })
  if (response.status === 401) { handleUnauthorized(); throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.') }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || `Error ${response.status}`)
  return data
}

export async function createEvent(eventData) {
  return fetchWithAuth('/events', {
    method: 'POST',
    body: JSON.stringify(eventData),
  })
}

export async function getEvents(params = {}) {
  const searchParams = new URLSearchParams(params)
  return fetchWithAuth(`/events?${searchParams}`)
}

export async function getClassEvents(params = {}) {
  const searchParams = new URLSearchParams(params)
  return fetchWithAuth(`/class-events?${searchParams}`)
}

export async function createClassEvent(data) {
  return fetchWithAuth('/class-events', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateClassEvent(id, data) {
  return fetchWithAuth(`/class-events/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function deleteClassEvent(id) {
  return fetchWithAuth(`/class-events/${id}`, { method: 'DELETE' })
}

export async function createGameRoom(actividadId, modo = 'quiz_race', maxJugadores = 30) {
  return fetchWithAuth('/rooms', {
    method: 'POST',
    body: JSON.stringify({ actividad_id: actividadId, modo, max_jugadores: maxJugadores }),
  })
}

export async function uploadCoverImage(publicationId, file) {
  const token = localStorage.getItem('token')
  const formData = new FormData()
  formData.append('cover', file)
  const response = await fetch(`${BASE_URL}/publications/${publicationId}/cover`, {
    method: 'POST',
    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    body: formData,
  })
  if (response.status === 401) { handleUnauthorized(); throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.') }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || `Error ${response.status}`)
  }
  return data
}

export async function getMyAttempts() {
  return fetchWithAuth('/attempts')
}

export async function getStatsOverview() {
  return fetchWithAuth('/stats/overview')
}

export async function getStatsStudents() {
  return fetchWithAuth('/stats/students')
}

export async function getStatsTimeline(dias = 30) {
  return fetchWithAuth(`/stats/timeline?dias=${dias}`)
}

export async function getStatsActivities() {
  return fetchWithAuth('/stats/activities')
}

/** Descarga el CSV de progreso: no puede ser un <a href> plano porque necesita el header de auth. */
export async function downloadStatsExport() {
  const token = localStorage.getItem('token')
  const response = await fetch(`${BASE_URL}/stats/export`, {
    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
  })
  if (response.status === 401) { handleUnauthorized(); throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.') }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error || `Error ${response.status}`)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `progreso-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function getUsers(params = {}) {
  const searchParams = new URLSearchParams(params)
  return fetchWithAuth(`/users?${searchParams}`)
}

export async function createUserAccount(data) {
  return fetchWithAuth('/users', { method: 'POST', body: JSON.stringify(data) })
}

export async function resetUserPassword(id) {
  return fetchWithAuth(`/users/${id}/reset-password`, { method: 'POST' })
}

export async function updateUserAccount(id, data) {
  return fetchWithAuth(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export async function getNotifications(params = {}) {
  const searchParams = new URLSearchParams(params)
  return fetchWithAuth(`/notifications?${searchParams}`)
}

export async function markNotificationRead(id) {
  return fetchWithAuth(`/notifications/${id}/read`, { method: 'POST' })
}

export async function markAllNotificationsRead() {
  return fetchWithAuth('/notifications/read-all', { method: 'POST' })
}

const RESEARCH_EXPORT_FILENAMES = {
  intentos: 'investigacion-intentos.csv',
  respuestas: 'investigacion-respuestas.csv',
  eventos: 'investigacion-eventos.csv',
  participacion: 'investigacion-participacion.csv',
  resumen: 'investigacion-resumen.csv',
}

/** Descarga uno de los CSV pseudonimizados del motor de investigación. */
export async function downloadResearchExport(kind) {
  const token = localStorage.getItem('token')
  const response = await fetch(`${BASE_URL}/research/export/${kind}.csv`, {
    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
  })
  if (response.status === 401) { handleUnauthorized(); throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.') }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error || `Error ${response.status}`)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = RESEARCH_EXPORT_FILENAMES[kind] || `investigacion-${kind}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Mapeo sensible pseudónimo -> identidad real. Solo administrador. */
export async function getResearchPseudonimos() {
  return fetchWithAuth('/research/pseudonimos')
}
