import { useEffect, useState } from 'react'
import { FileAudio, FileImage, FileText, Film, Link as LinkIcon, Upload, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'

const TYPE_ICON = { pdf: FileText, video: Film, audio: FileAudio, imagen: FileImage }

// El motor de quizzes solo acepta image/audio/video/file; la biblioteca de
// recursos usa sus propios nombres (imagen/pdf/...), así que hay que traducir.
function tipoParaMedia(tipoRecurso) {
  if (tipoRecurso === 'imagen') return 'image'
  if (tipoRecurso === 'audio' || tipoRecurso === 'video') return tipoRecurso
  return 'file'
}

/** Modal para elegir un archivo ya subido (o subir uno nuevo) y reutilizarlo
 * en un quiz o una publicación. `onSelect` recibe { tipo, url, nombre }. */
export default function ResourceLibraryPicker({ onSelect, onClose }) {
  const { user } = useAuth()
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getResources({ subido_por: user.id, estado: '', activos: 'false' })
      .then(setResources)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user.id])

  const elegir = (resource) => {
    onSelect({ id: resource.id, tipo: tipoParaMedia(resource.tipo), url: resource.archivo_o_url, nombre: resource.titulo })
  }

  const subirNuevo = async () => {
    if (!file) return
    setUploading(true); setError('')
    try {
      const uploaded = await api.uploadResourceMedia(file)
      const tipoRecurso = uploaded.tipo === 'image' ? 'imagen' : uploaded.tipo
      const recurso = await api.createResource({ titulo: file.name, tipo: tipoRecurso, archivo_o_url: uploaded.url })
      elegir(recurso)
    } catch (err) {
      setError(err.message || 'No se pudo subir el archivo.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900">Mi biblioteca de medios</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-xl border border-dashed border-teal-300 bg-teal-50 p-3">
          <input
            type="file"
            accept="image/*,audio/*,video/mp4,video/webm,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            className="flex-1 text-xs"
          />
          <button
            type="button"
            disabled={!file || uploading}
            onClick={subirNuevo}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            <Upload size={14} /> {uploading ? 'Subiendo…' : 'Subir y usar'}
          </button>
        </div>
        {error && <p className="mb-3 text-xs font-semibold text-rose-700">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : resources.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no tienes archivos guardados. Sube uno arriba.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {resources.map((resource) => {
              const Icon = TYPE_ICON[resource.tipo] || LinkIcon
              return (
                <button
                  type="button"
                  key={resource.id}
                  onClick={() => elegir(resource)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 p-3 text-center hover:border-teal-400 hover:bg-teal-50"
                >
                  <Icon size={22} className="text-teal-600" />
                  <span className="line-clamp-2 text-[11px] font-semibold text-slate-700">{resource.titulo}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
