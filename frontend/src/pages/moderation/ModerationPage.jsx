import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import * as api from '../../services/api'
import ModerationCard from '../../components/ui/ModerationCard'
import { Shield, AlertTriangle, MessageSquare, FolderOpen, Check, X } from 'lucide-react'
import { timeAgo } from '../../utils/feed'

const TABS = [
  { key: 'publicaciones', label: 'Publicaciones' },
  { key: 'comentarios',   label: 'Comentarios' },
  { key: 'recursos',      label: 'Recursos' },
]

const FILTERS = [
  { key: 'todos',            label: 'Todas' },
  { key: 'enviada',          label: 'Pendientes' },
  { key: 'en_revision',      label: 'En revisión' },
  { key: 'requiere_cambios', label: 'Requieren cambios' },
]

function toModerationItem(pub) {
  return {
    id: pub.id,
    tipo: 'estudiante',
    autor: { nombre: pub.autor_nombre, codigo: pub.autor_codigo || '—' },
    titulo: pub.titulo,
    contenido: pub.contenido,
    materia: pub.categoria_nombre || 'Ciencias Naturales',
    tiempo: timeAgo(pub.fecha_creacion),
    alertas: [],
    estado: pub.estado,
    fuente: null,
    imagen: pub.imagen_portada,
    observacion: null,
  }
}

export default function ModerationPage() {
  const { user } = useAuth()
  const { pendingPublications, refreshProgress } = useData()
  const [tab, setTab]       = useState('publicaciones')
  const [items, setItems]   = useState([])
  const [comments, setComments]   = useState([])
  const [resources, setResources] = useState([])
  const [filter, setFilter] = useState('todos')
  const [toast, setToast]   = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setItems(pendingPublications.map(toModerationItem))
  }, [pendingPublications])

  const showToast = (msg, color = 'green') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3000)
  }

  const loadQueue = useCallback(async () => {
    try {
      const [pendingComments, pendingResources] = await Promise.all([
        api.getPendingComments(),
        api.getResources({ estado: 'pendiente' }),
      ])
      setComments(pendingComments)
      setResources(pendingResources)
    } catch (err) {
      showToast(`Error: ${err.message}`, 'red')
    }
  }, [])

  useEffect(() => { loadQueue() }, [loadQueue])

  const runAction = async (id, action, extra = {}) => {
    if (saving) return
    setSaving(true)
    try {
      await api.moderatePublication(id, {
        docente_id: user?.id,
        decision: action,
        estado_nuevo: extra.estado_nuevo,
        observacion: extra.observacion || null,
      })
      setItems(prev => prev.filter(i => i.id !== id))
      refreshProgress()
    } catch (err) {
      showToast(`Error: ${err.message}`, 'red')
    } finally {
      setSaving(false)
    }
  }

  const handleAprobar = (id, obs) => {
    runAction(id, 'aprobar', { estado_nuevo: 'aprobada', observacion: obs })
    showToast('✅ Publicación aprobada y publicada', 'green')
  }

  const handlePedirCambios = (id, obs) => {
    runAction(id, 'corregir', { estado_nuevo: 'requiere_cambios', observacion: obs })
    showToast('✏️ Se solicitaron cambios al estudiante', 'orange')
  }

  const handleRechazar = (id, motivo) => {
    runAction(id, 'rechazar', { estado_nuevo: 'rechazada', observacion: motivo })
    showToast(`❌ Publicación rechazada: ${motivo}`, 'red')
  }

  const handleArchivar = async (id) => {
    if (saving) return
    setSaving(true)
    try {
      await api.updatePublication(id, { estado: 'archivada' })
      setItems(prev => prev.filter(i => i.id !== id))
      refreshProgress()
      showToast('📦 Publicación archivada', 'slate')
    } catch (err) {
      showToast(`Error: ${err.message}`, 'red')
    } finally {
      setSaving(false)
    }
  }

  const moderateComment = async (id, estado) => {
    if (saving) return
    setSaving(true)
    try {
      await api.moderateComment(id, estado)
      setComments(prev => prev.filter(c => c.id !== id))
      showToast(estado === 'aprobado' ? '✅ Comentario publicado' : '❌ Comentario rechazado',
                estado === 'aprobado' ? 'green' : 'red')
    } catch (err) {
      showToast(`Error: ${err.message}`, 'red')
    } finally {
      setSaving(false)
    }
  }

  const moderateResource = async (id, estado) => {
    if (saving) return
    setSaving(true)
    try {
      if (estado === 'aprobado') await api.approveResource(id)
      else await api.rejectResource(id)
      setResources(prev => prev.filter(r => r.id !== id))
      showToast(estado === 'aprobado' ? '✅ Recurso aprobado' : '❌ Recurso rechazado',
                estado === 'aprobado' ? 'green' : 'red')
    } catch (err) {
      showToast(`Error: ${err.message}`, 'red')
    } finally {
      setSaving(false)
    }
  }

  const filtered = items.filter(i => filter === 'todos' || i.estado === filter)
  const pendientesCount = items.filter(i => i.estado === 'enviada' || i.estado === 'en_revision').length
  const cambiosCount = items.filter(i => i.estado === 'requiere_cambios').length
  const tabCounts = {
    publicaciones: pendientesCount,
    comentarios: comments.length,
    recursos: resources.length,
  }

  return (
    <div className="feed-container pb-4 fade-in">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-white text-sm font-bold scale-in
          ${toast.color === 'green' ? 'bg-green-600' : toast.color === 'orange' ? 'bg-orange-500' : toast.color === 'red' ? 'bg-red-600' : 'bg-slate-700'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
          <Shield size={22} />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Moderación</h1>
          <p className="text-xs text-[color:var(--ar-muted)] font-semibold">Revisa publicaciones, comentarios y recursos de tus estudiantes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Publicaciones', value: pendientesCount,   icon: AlertTriangle,  color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
          { label: 'Comentarios',   value: comments.length,   icon: MessageSquare,  color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'Recursos',      value: resources.length,  icon: FolderOpen,     color: 'bg-purple-50 text-purple-700 border-purple-200' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className={`ar-card p-3 border ${s.color} text-center`}>
              <Icon size={18} className="mx-auto mb-1 opacity-70" />
              <p className="text-2xl font-extrabold">{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 mb-4 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-extrabold border-b-2 -mb-px transition-colors
              ${tab === t.key
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            {t.label}
            {tabCounts[t.key] > 0 && (
              <span className="ml-1.5 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{tabCounts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'publicaciones' && (
        <>
          {/* Guía rápida */}
          <div className="ar-card p-4 mb-4 bg-blue-50 border border-blue-100">
            <p className="text-xs font-bold text-blue-800 mb-2">📋 Recuerda al revisar:</p>
            <ul className="text-xs text-blue-700 space-y-1 font-semibold">
              <li>• No modifiques sustancialmente la idea del estudiante</li>
              <li>• Deja observaciones claras y constructivas</li>
              <li>• Las alertas automáticas son sugerencias, no decisiones</li>
            </ul>
          </div>

          {/* Filtros */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all
                  ${filter === f.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-400'
                  }`}
              >
                {f.label}
                {f.key === 'enviada' && pendientesCount > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{pendientesCount}</span>
                )}
                {f.key === 'requiere_cambios' && cambiosCount > 0 && (
                  <span className="ml-1.5 bg-orange-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{cambiosCount}</span>
                )}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyQueue text="No hay publicaciones pendientes de revisión" />
          ) : (
            filtered.map(item => (
              <ModerationCard
                key={item.id}
                item={item}
                onAprobar={handleAprobar}
                onPedirCambios={handlePedirCambios}
                onRechazar={handleRechazar}
                onArchivar={handleArchivar}
              />
            ))
          )}
        </>
      )}

      {tab === 'comentarios' && (
        comments.length === 0 ? (
          <EmptyQueue text="No hay comentarios pendientes de revisión" />
        ) : (
          <div className="space-y-3">
            {comments.map(c => (
              <div key={c.id} className="ar-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 text-sm truncate">{c.autor_nombre || 'Anónimo'}</p>
                    <p className="text-xs text-[color:var(--ar-muted)] font-semibold truncate">
                      en «{c.publicacion_titulo}»
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold flex-shrink-0">{timeAgo(c.fecha)}</span>
                </div>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">{c.contenido}</p>
                <DecisionButtons
                  disabled={saving}
                  onApprove={() => moderateComment(c.id, 'aprobado')}
                  onReject={() => moderateComment(c.id, 'rechazado')}
                  approveLabel="Publicar"
                />
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'recursos' && (
        resources.length === 0 ? (
          <EmptyQueue text="No hay recursos pendientes de aprobación" />
        ) : (
          <div className="space-y-3">
            {resources.map(r => (
              <div key={r.id} className="ar-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 text-sm truncate">{r.titulo}</p>
                    <p className="text-xs text-[color:var(--ar-muted)] font-semibold">
                      {r.tipo}{r.area ? ` · ${r.area}` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold flex-shrink-0">{timeAgo(r.fecha_creacion)}</span>
                </div>
                {r.descripcion && <p className="text-sm text-slate-700">{r.descripcion}</p>}
                <a
                  href={r.archivo_o_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-xs font-bold text-teal-700 underline break-all"
                >
                  Abrir recurso
                </a>
                <DecisionButtons
                  disabled={saving}
                  onApprove={() => moderateResource(r.id, 'aprobado')}
                  onReject={() => moderateResource(r.id, 'rechazado')}
                  approveLabel="Aprobar"
                />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function EmptyQueue({ text }) {
  return (
    <div className="ar-card p-10 text-center">
      <p className="text-4xl mb-3">🎉</p>
      <p className="font-extrabold text-slate-900">¡Todo al día!</p>
      <p className="text-sm text-[color:var(--ar-muted)] mt-1">{text}</p>
    </div>
  )
}

function DecisionButtons({ disabled, onApprove, onReject, approveLabel }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onApprove}
        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2 text-xs font-extrabold text-white hover:bg-green-700 disabled:opacity-50"
      >
        <Check size={14} /> {approveLabel}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onReject}
        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-red-200 py-2 text-xs font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <X size={14} /> Rechazar
      </button>
    </div>
  )
}
