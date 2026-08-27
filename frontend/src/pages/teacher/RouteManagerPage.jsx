import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { useData } from '../../contexts/DataContext'
import { PageHeader, Card, SectionTitle, EmptyState, LoadingState } from '../../components/ui'
import ActivityPreview from '../../components/media/ActivityPreview'
import * as api from '../../services/api'

export default function RouteManagerPage() {
  const { categories, publications, activities } = useData()
  const [categoriaId, setCategoriaId] = useState(null)
  const [pasos, setPasos] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [nuevoTipo, setNuevoTipo] = useState('publicacion')
  const [nuevoContenidoId, setNuevoContenidoId] = useState('')

  useEffect(() => {
    if (categories.length && categoriaId === null) setCategoriaId(categories[0].id)
  }, [categories, categoriaId])

  const load = (catId) => {
    if (!catId) return
    api.getRouteSteps(catId)
      .then(setPasos)
      .catch(err => setMessage(err.message))
  }
  useEffect(() => { load(categoriaId) }, [categoriaId])

  const opcionesContenido = (nuevoTipo === 'publicacion' ? publications : activities)
    .filter(item => item.categoria_id === categoriaId)

  async function agregarPaso(e) {
    e.preventDefault()
    if (!nuevoContenidoId) return
    setBusy(true); setMessage('')
    try {
      await api.createRouteStep({
        categoria_id: categoriaId,
        tipo_paso: nuevoTipo,
        publicacion_id: nuevoTipo === 'publicacion' ? Number(nuevoContenidoId) : undefined,
        actividad_id: nuevoTipo === 'actividad' ? Number(nuevoContenidoId) : undefined,
      })
      setNuevoContenidoId('')
      load(categoriaId)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function eliminarPaso(id) {
    if (!window.confirm('¿Quitar este paso de la ruta?')) return
    setBusy(true); setMessage('')
    try {
      await api.deleteRouteStep(id)
      load(categoriaId)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function moverPaso(index, direccion) {
    const destino = index + direccion
    if (!pasos || destino < 0 || destino >= pasos.length) return
    const orden = pasos.map(p => p.id)
    const tmp = orden[index]
    orden[index] = orden[destino]
    orden[destino] = tmp
    setBusy(true); setMessage('')
    try {
      const actualizados = await api.reorderRouteSteps(categoriaId, orden)
      setPasos(actualizados)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function alternarObligatorio(paso) {
    setBusy(true); setMessage('')
    try {
      await api.updateRouteStep(paso.id, { obligatorio: !paso.obligatorio })
      load(categoriaId)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Actividades Mi Ruta" subtitle="Arma el orden en que los estudiantes recorren cada módulo: qué lecturas y actividades forman parte de la ruta curada, y en qué secuencia." />

      {message && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{message}</p>}

      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoriaId(cat.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              categoriaId === cat.id ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat.nombre}
          </button>
        ))}
      </div>

      <section>
        <SectionTitle title="Pasos del módulo" subtitle="Orden secuencial: el estudiante debe completar un paso obligatorio para desbloquear el siguiente." />
        {pasos === null ? (
          <LoadingState message="Cargando pasos..." />
        ) : pasos.length === 0 ? (
          <EmptyState title="Este módulo todavía no tiene pasos" description="Agrega una lectura o actividad abajo para empezar a armar la ruta." emoji="🧭" />
        ) : (
          <Card className="divide-y divide-slate-100 overflow-hidden p-0">
            {pasos.map((paso, index) => (
              <div key={paso.id} className="flex items-center gap-2 px-2">
                <div className="flex-1">
                  <ActivityPreview paso={{ ...paso, estado: 'AVAILABLE' }} readOnly />
                </div>
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-500 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={paso.obligatorio}
                    disabled={busy}
                    onChange={() => alternarObligatorio(paso)}
                  />
                  Obligatorio
                </label>
                <button type="button" disabled={busy || index === 0} onClick={() => moverPaso(index, -1)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                  <ArrowUp size={16} />
                </button>
                <button type="button" disabled={busy || index === pasos.length - 1} onClick={() => moverPaso(index, 1)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                  <ArrowDown size={16} />
                </button>
                <button type="button" disabled={busy} onClick={() => eliminarPaso(paso.id)}
                  className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-30">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <SectionTitle title="Agregar paso" />
        <Card className="p-4">
          <form onSubmit={agregarPaso} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Tipo</label>
              <select
                value={nuevoTipo}
                onChange={e => { setNuevoTipo(e.target.value); setNuevoContenidoId('') }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="publicacion">Lectura (publicación)</option>
                <option value="actividad">Actividad / quiz</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-500 mb-1">Contenido</label>
              <select
                value={nuevoContenidoId}
                onChange={e => setNuevoContenidoId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Selecciona...</option>
                {opcionesContenido.map(item => (
                  <option key={item.id} value={item.id}>{item.titulo}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={busy || !nuevoContenidoId}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              Agregar
            </button>
          </form>
        </Card>
      </section>
    </div>
  )
}
