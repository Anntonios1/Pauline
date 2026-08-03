import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, ProgressBar } from '../../components/ui'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function ActivityResultPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState(null)

  useEffect(() => {
    const saved = localStorage.getItem(`activity-result-${id}`)
    if (saved) {
      setResult(JSON.parse(saved))
    }
  }, [id])

  if (!result) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">No hay resultados disponibles. Completa una actividad primero.</p>
        <Button variant="primary" className="mt-4" onClick={() => navigate(`/actividades/${id}`)}>
          Ir a la actividad
        </Button>
      </div>
    )
  }

  return (
    <div className="animate-slide-up">
      <button
        onClick={() => navigate('/actividades')}
        className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={20} /> Volver a actividades
      </button>

      <Card className="p-6 md:p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Resultado guardado</h2>
          <p className="text-slate-600">Actividad #{id}</p>
        </div>
        <ProgressBar progress={result.porcentaje || 0} size="lg" className="mb-6" />
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate('/actividades')}>
            Más actividades
          </Button>
          <Button variant="primary" className="flex-1" onClick={() => navigate(`/actividades/${id}`)}>
            <CheckCircle2 size={18} className="mr-2" /> Reintentar
          </Button>
        </div>
      </Card>
    </div>
  )
}
