import { useEffect, useRef, useState } from 'react'
import { FileAudio, FileImage, FileText, Film, FolderPlus, Link as LinkIcon, Upload } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'

const TYPES = [
  { value: 'pdf', label: 'PDF', icon: FileText }, { value: 'video', label: 'Video', icon: Film },
  { value: 'audio', label: 'Audio', icon: FileAudio }, { value: 'imagen', label: 'Imagen', icon: FileImage },
]

export default function TeacherResourcesPage() {
  const { user } = useAuth()
  const inputRef = useRef(null)
  const [resources, setResources] = useState([])
  const [form, setForm] = useState({ titulo: '', descripcion: '', tipo: 'pdf', url: '', area: 'preguntas_frecuentes' })
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const load = () => {
    if (user?.id) api.getResources({ subido_por: user.id, estado: '', activos: 'false' }).then(setResources).catch(() => setMessage('No se pudieron cargar tus recursos.'))
  }
  useEffect(load, [user?.id])

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setMessage('')
    try {
      let url = form.url.trim()
      let type = form.tipo
      if (file) {
        const uploaded = await api.uploadResourceMedia(file)
        url = uploaded.url
        type = uploaded.tipo === 'image' ? 'imagen' : uploaded.tipo
      }
      if (!url) throw new Error('Adjunta un archivo o escribe una URL.')
      await api.createResource({ ...form, tipo: type, archivo_o_url: url })
      setForm({ titulo: '', descripcion: '', tipo: 'pdf', url: '', area: 'preguntas_frecuentes' }); setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      setMessage('Recurso guardado y disponible para tus actividades.'); load()
    } catch (error) { setMessage(error.message || 'No se pudo guardar el recurso.') } finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-5xl space-y-5 pb-6">
    <section className="rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white"><div className="flex items-center gap-3"><FolderPlus size={30} /><div><h1 className="text-2xl font-black">Biblioteca docente</h1><p className="text-sm text-white/85">Reúne materiales reutilizables para lecturas y quizzes.</p></div></div></section>
    <form onSubmit={submit} className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 md:grid-cols-2">
      <h2 className="md:col-span-2 font-extrabold text-slate-900">Añadir recurso</h2>
      <label className="text-sm font-bold text-slate-700">Título<input required value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal" placeholder="Ej. Video: etapas del embarazo" /></label>
      <label className="text-sm font-bold text-slate-700">Tipo<select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal">{TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
      <label className="text-sm font-bold text-slate-700 md:col-span-2">Descripción<textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 p-2.5 font-normal" placeholder="Cómo y cuándo usar este material" /></label>
      <label className="text-sm font-bold text-slate-700">Adjuntar archivo<input ref={inputRef} type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm font-normal" /></label>
      <label className="text-sm font-bold text-slate-700">o URL externa<input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-normal" placeholder="https://…" /></label>
      <button disabled={saving} className="md:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 font-bold text-white disabled:opacity-60"><Upload size={18} />{saving ? 'Guardando…' : 'Guardar en mi biblioteca'}</button>
      {message && <p className="md:col-span-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</p>}
    </form>
    <section><h2 className="mb-3 font-extrabold text-slate-900">Mis recursos ({resources.length})</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{resources.map(resource => { const type = TYPES.find(item => item.value === resource.tipo); const Icon = type?.icon || LinkIcon; return <a key={resource.id} href={resource.archivo_o_url} target="_blank" rel="noreferrer" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-md"><Icon className="mb-3 text-orange-500" size={24} /><p className="font-extrabold text-slate-900">{resource.titulo}</p><p className="mt-1 text-sm text-slate-500 line-clamp-2">{resource.descripcion || type?.label || 'Recurso'}</p></a> })}</div>{resources.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-slate-500">Aún no tienes recursos en tu biblioteca.</p>}</section>
  </div>
}
