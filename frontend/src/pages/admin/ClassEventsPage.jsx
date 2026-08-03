import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Clock3, MapPin, Plus, Sparkles, Trash2 } from 'lucide-react'
import * as api from '../../services/api'
import { useData } from '../../contexts/DataContext'

const emptyForm = { titulo: '', descripcion: '', tipo: 'clase', fecha_inicio: '', fecha_fin: '', lugar: '', color: 'teal', actividad_id: '', etiqueta: '' }
const colorClass = { teal: 'from-teal-500 to-cyan-600', violet: 'from-violet-500 to-fuchsia-600', orange: 'from-orange-500 to-rose-500', blue: 'from-blue-500 to-indigo-600' }

export default function ClassEventsPage() {
  const { activities } = useData()
  const navigate = useNavigate()
  const liveQuizzes = activities.filter(a => Number(a.live_questions_count) > 0)
  const [events, setEvents] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [creatingRoom, setCreatingRoom] = useState(null)
  const load = () => api.getClassEvents({ mine: 'true', include_past: 'true' }).then(setEvents).catch(error => setMessage(error.message))
  // `load` devuelve una promesa: hay que descartarla, o React la toma como
  // función de limpieza y revienta con "destroy is not a function".
  useEffect(() => { load() }, [])

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setMessage('')
    try {
      await api.createClassEvent({ ...form, actividad_id: form.actividad_id ? Number(form.actividad_id) : null, fecha_inicio: new Date(form.fecha_inicio).toISOString(), fecha_fin: form.fecha_fin ? new Date(form.fecha_fin).toISOString() : null })
      setForm(emptyForm); setMessage('Evento publicado para los estudiantes.'); load()
    } catch (error) { setMessage(error.message || 'No se pudo crear el evento.') } finally { setSaving(false) }
  }
  const remove = async (id) => {
    if (!window.confirm('¿Retirar este evento de la agenda?')) return
    try { await api.deleteClassEvent(id); load() } catch (error) { setMessage(error.message) }
  }
  const startRoom = async (actividadId) => {
    setCreatingRoom(actividadId)
    try { const room = await api.createGameRoom(actividadId); navigate(`/admin/sala/${room.code}`) }
    catch (error) { setMessage(error.message || 'No se pudo crear la sala.') }
    finally { setCreatingRoom(null) }
  }

  return <div className="mx-auto max-w-5xl space-y-5 pb-8">
    <section className="rounded-3xl bg-gradient-to-br from-teal-600 to-cyan-700 p-6 text-white"><div className="flex items-center gap-3"><CalendarDays size={32} /><div><h1 className="text-2xl font-black">Agenda de la clase</h1><p className="text-sm text-white/80">Crea recordatorios, encuentros, clases y fechas de entrega.</p></div></div></section>
    <form onSubmit={submit} className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 sm:grid-cols-2">
      <h2 className="sm:col-span-2 flex items-center gap-2 font-extrabold text-slate-900"><Plus size={18} />Nuevo evento</h2>
      <label className="text-sm font-bold text-slate-700 sm:col-span-2">Título<input required value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal" placeholder="Ej. Entrega del proyecto del cuerpo humano" /></label>
      <label className="text-sm font-bold text-slate-700">Tipo<select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal"><option value="clase">Clase</option><option value="entrega">Entrega</option><option value="encuentro">Encuentro</option><option value="recordatorio">Recordatorio</option></select></label>
      <label className="text-sm font-bold text-slate-700">Color<select value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal"><option value="teal">Turquesa</option><option value="violet">Violeta</option><option value="orange">Naranja</option><option value="blue">Azul</option></select></label>
      <label className="text-sm font-bold text-slate-700">Comienza<input required type="datetime-local" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal" /></label>
      <label className="text-sm font-bold text-slate-700">Finaliza (opcional)<input type="datetime-local" value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal" /></label>
      <label className="text-sm font-bold text-slate-700 sm:col-span-2">Lugar o enlace<input value={form.lugar} onChange={e => setForm({ ...form, lugar: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal" placeholder="Aula, biblioteca o enlace de videollamada" /></label>
      <label className="text-sm font-bold text-slate-700 sm:col-span-2">Quiz dinámico (opcional)<select value={form.actividad_id} onChange={e => setForm({ ...form, actividad_id: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal"><option value="">Ninguno</option>{liveQuizzes.map(a => <option key={a.id} value={a.id}>{a.titulo}</option>)}</select></label>
      <label className="text-sm font-bold text-slate-700 sm:col-span-2">Etiqueta personalizada (opcional)<input value={form.etiqueta} onChange={e => setForm({ ...form, etiqueta: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal" placeholder="Ej. Proyecto final, Repaso, Urgente..." maxLength={40} /></label>
      <label className="text-sm font-bold text-slate-700 sm:col-span-2">Descripción<textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 p-2.5 font-normal" /></label>
      <button disabled={saving} className="sm:col-span-2 rounded-xl bg-teal-600 px-4 py-3 font-extrabold text-white disabled:opacity-60">{saving ? 'Publicando…' : 'Publicar evento'}</button>
      {message && <p className="sm:col-span-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</p>}
    </form>
    <section><h2 className="mb-3 font-extrabold text-slate-900">Eventos creados ({events.length})</h2><div className="grid gap-3 sm:grid-cols-2">{events.map(item => <article key={item.id} className={`rounded-2xl bg-gradient-to-br ${colorClass[item.color] || colorClass.teal} p-4 text-white shadow-sm`}><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-1.5"><span className="text-[10px] font-black uppercase tracking-wider text-white/75">{item.tipo}</span>{item.etiqueta && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">#{item.etiqueta}</span>}</div><h3 className="mt-1 font-black">{item.titulo}</h3></div><button onClick={() => remove(item.id)} className="rounded-lg bg-white/15 p-2 hover:bg-white/25" title="Retirar evento"><Trash2 size={16} /></button></div><p className="mt-2 flex items-center gap-1.5 text-xs text-white/85"><Clock3 size={14} />{new Date(item.fecha_inicio).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</p>{item.lugar && <p className="mt-1 flex items-center gap-1.5 text-xs text-white/85"><MapPin size={14} />{item.lugar}</p>}{item.actividad_id && <button type="button" onClick={() => startRoom(item.actividad_id)} disabled={creatingRoom === item.actividad_id} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold hover:bg-white/25 disabled:opacity-60"><Sparkles size={14} />{creatingRoom === item.actividad_id ? 'Creando…' : `Sala en vivo: ${activities.find(a => a.id === item.actividad_id)?.titulo || 'quiz'}`}</button>}</article>)}</div></section>
  </div>
}
