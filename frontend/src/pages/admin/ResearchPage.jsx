import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Card, SectionTitle } from '../../components/ui'
import * as api from '../../services/api'
import { Download, ShieldAlert, Eye, EyeOff, FlaskConical } from 'lucide-react'

const EXPORTS = [
  { kind: 'resumen', titulo: 'Resumen por estudiante', descripcion: 'Una fila por estudiante: desempeño, participación y engagement agregados.' },
  { kind: 'intentos', titulo: 'Intentos de actividades', descripcion: 'Un registro por intento: puntaje, porcentaje y duración.' },
  { kind: 'respuestas', titulo: 'Respuestas por pregunta', descripcion: 'Detalle de cada respuesta, motor legacy y unificado combinados.' },
  { kind: 'eventos', titulo: 'Eventos de aprendizaje', descripcion: 'Bitácora tipo xAPI: qué hizo cada estudiante y cuándo.' },
  { kind: 'participacion', titulo: 'Participación en el muro', descripcion: 'Publicaciones y comentarios creados, con su resultado de moderación.' },
]

function ExportCard({ item, onDownload, downloading }) {
  const isDownloading = downloading === item.kind
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center flex-shrink-0">
        <FlaskConical size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900">{item.titulo}</p>
        <p className="text-xs text-slate-500">{item.descripcion}</p>
      </div>
      <button
        type="button"
        onClick={() => onDownload(item.kind)}
        disabled={isDownloading}
        className="btn-secondary flex-shrink-0 disabled:opacity-50"
      >
        <Download size={15} /> {isDownloading ? 'Generando…' : 'CSV'}
      </button>
    </Card>
  )
}

export default function ResearchPage() {
  const { user: me } = useAuth()
  const isAdmin = me?.rol === 'administrador'
  const [downloading, setDownloading] = useState(null)
  const [error, setError] = useState('')
  const [showMapping, setShowMapping] = useState(false)
  const [mapping, setMapping] = useState(null)
  const [loadingMapping, setLoadingMapping] = useState(false)

  const handleDownload = async (kind) => {
    setDownloading(kind)
    setError('')
    try {
      await api.downloadResearchExport(kind)
    } catch (e) {
      setError(e.message || 'No se pudo generar el archivo')
    } finally {
      setDownloading(null)
    }
  }

  const toggleMapping = async () => {
    if (showMapping) { setShowMapping(false); return }
    setShowMapping(true)
    if (mapping) return
    setLoadingMapping(true)
    try {
      setMapping(await api.getResearchPseudonimos())
    } catch (e) {
      setError(e.message || 'No se pudo cargar el mapeo')
    } finally {
      setLoadingMapping(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader
        title="Investigación"
        subtitle="Exporta los datos de la clase pseudonimizados para cruzarlos en tu proyecto de grado."
      />

      <Card className="p-4 bg-teal-50 border border-teal-100 flex items-start gap-3">
        <ShieldAlert size={18} className="text-teal-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-teal-800">
          Cada archivo identifica a los estudiantes con un <strong>pseudónimo estable</strong> (ej. SUJ-A1B2C3D4),
          nunca con su nombre o código real. El mismo pseudónimo se repite en todos los archivos, así que puedes
          cruzarlos entre sí sin exponer la identidad de nadie.
        </p>
      </Card>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      <SectionTitle title="Datasets disponibles" subtitle="Cada botón descarga un CSV listo para abrir en Excel/Sheets o analizar con Python/R." />
      <div className="space-y-3">
        {EXPORTS.map(item => (
          <ExportCard key={item.kind} item={item} onDownload={handleDownload} downloading={downloading} />
        ))}
      </div>

      {isAdmin && (
        <>
          <SectionTitle title="Mapeo de identidad (sensible)" subtitle="Solo administrador. No compartas esta tabla junto con los CSV anteriores." />
          <Card className="p-4">
            <button type="button" onClick={toggleMapping} className="flex w-full items-center justify-between text-left">
              <span className="text-sm font-bold text-slate-900">Pseudónimo → estudiante real</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--ar-primary)]">
                {showMapping ? <><EyeOff size={15} /> Ocultar</> : <><Eye size={15} /> Mostrar</>}
              </span>
            </button>
            {showMapping && (
              <div className="mt-3 overflow-x-auto">
                {loadingMapping ? (
                  <p className="text-sm text-slate-500">Cargando…</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-2 pr-3 font-bold text-slate-600">Pseudónimo</th>
                        <th className="py-2 pr-3 font-bold text-slate-600">Nombre</th>
                        <th className="py-2 font-bold text-slate-600">Código</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(mapping || []).map(m => (
                        <tr key={m.id}>
                          <td className="py-2 pr-3 font-mono text-slate-700">{m.pseudonimo}</td>
                          <td className="py-2 pr-3 text-slate-800">{m.nombre_visible}</td>
                          <td className="py-2 text-slate-500">{m.codigo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
