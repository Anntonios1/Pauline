import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, MessageCircle, Send, Trash2 } from 'lucide-react'
import { useData } from '../../contexts/DataContext'
import { useAuth } from '../../contexts/AuthContext'
import { Card, Button, LoadingState } from '../../components/ui'
import { getAreaLabel, getAreaBadgeClass, parseHtml, formatDate } from '../../utils/format'
import { publicationStyleClasses, publicationCoverClasses } from '../../utils/publicationStyle'
import * as api from '../../services/api'

export default function PublicationDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { getPublicationBySlug } = useData()
  const { user } = useAuth()
  const [publication, setPublication] = useState(null)
  const [comment, setComment] = useState('')
  const [message, setMessage] = useState('')
  const isTeacher = ['docente', 'administrador'].includes(user?.rol)

  const load = async () => {
    try { setPublication(await api.getPublicationBySlug(slug)) } catch { setPublication(getPublicationBySlug(slug) || null) }
  }
  useEffect(() => { load() }, [slug])

  // Registra la lectura: es el dato que alimenta el «X/Y pasos» de Mi ruta.
  useEffect(() => {
    if (!publication?.id || user?.rol !== 'estudiante') return
    api.createEvent({ verbo: 'leyo', objeto_tipo: 'publicacion', objeto_id: publication.id }).catch(() => {})
  }, [publication?.id, user?.rol])

  const submitComment = async (event) => {
    event.preventDefault(); if (!comment.trim() || !publication) return
    try { await api.createComment(publication.id, comment.trim()); setComment(''); setMessage('Comentario enviado para revisión.'); await load() }
    catch (error) { setMessage(error.message || 'No se pudo enviar el comentario.') }
  }
  const removeComment = async (id) => {
    if (!window.confirm('¿Eliminar este comentario?')) return
    try { await api.deleteComment(id); await load() } catch (error) { setMessage(error.message || 'No se pudo eliminar el comentario.') }
  }

  if (!publication) return <LoadingState message="Cargando lectura..." />
  const comments = publication.comentarios || []
  const estiloClases = publicationStyleClasses(publication.estilo_visual, { conBarra: false })
  const portadaClases = publicationCoverClasses(publication.estilo_visual)
  return <div className="animate-fade-in">
    <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-900"><ArrowLeft size={20} />Volver</button>
    <Card className={`mb-6 overflow-hidden ${estiloClases}`}>
      {portadaClases && !publication.imagen_portada && <div className={portadaClases} aria-hidden="true" />}
      <div className="p-6 md:p-8">
      <div className="mb-4 flex flex-wrap items-center gap-2"><span className={`text-xs font-medium ${getAreaBadgeClass(publication.categoria_area)}`}>{getAreaLabel(publication.categoria_area)}</span><span className="text-xs text-slate-500">{formatDate(publication.fecha_publicacion)}</span></div>
      <h1 className="mb-4 text-2xl font-bold text-slate-900 md:text-3xl">{publication.titulo}</h1>
      {publication.imagen_portada && <div className="mb-6 overflow-hidden rounded-xl bg-slate-100"><img src={publication.imagen_portada} alt={publication.titulo} className="max-h-80 w-full object-cover" /></div>}
      <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-6"><div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-teal-100 font-semibold text-teal-600">{publication.autor_imagen ? <img src={publication.autor_imagen} alt="" className="h-full w-full object-cover" /> : (publication.autor_nombre?.charAt(0) || 'D')}</div><div><p className="text-sm font-medium text-slate-900">{publication.autor_nombre}</p><p className="text-xs text-slate-500">{publication.autor_rol === 'estudiante' ? 'Estudiante' : 'Docente'}</p></div></div>
      <div className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: parseHtml(publication.contenido) }} />
    </div></Card>
    <Card id="comentarios" className="p-6"><h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900"><MessageCircle size={24} />Comentarios</h2>
      <form onSubmit={submitComment} className="mb-6"><label className="mb-2 block text-sm font-medium text-slate-700">¿Tienes una duda? Escríbela aquí.</label><textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Tu comentario será revisado por un docente antes de publicarse." className="input mb-3 min-h-[100px] resize-none" /><Button type="submit" variant="primary" className="gap-2"><Send size={16} />Enviar comentario</Button></form>
      {message && <p className="mb-3 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</p>}
      {!comments.length ? <p className="text-sm text-slate-500">Aún no hay comentarios aprobados.</p> : <div className="space-y-3">{comments.map(item => <div key={item.id} className="rounded-xl bg-slate-50 p-4"><div className="mb-1 flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-900">{item.autor_nombre}</p>{isTeacher && <button type="button" onClick={() => removeComment(item.id)} className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar comentario"><Trash2 size={16} /></button>}</div><p className="text-sm text-slate-700">{item.contenido}</p></div>)}</div>}
    </Card>
  </div>
}
