import { useData } from '../../contexts/DataContext'
import { PageHeader, Card, ProgressBar, SectionTitle } from '../../components/ui'
import { Trophy, Target, CheckCircle2, Circle } from 'lucide-react'
import { getAreaLabel, getAreaBadgeClass, getDifficultyLabel, getDifficultyBadgeClass, calculateOverallProgress } from '../../utils/format'

export default function ProgressPage() {
  const { progress, activities } = useData()

  const overallProgress = calculateOverallProgress(progress)
  const completed = progress.filter(p => p.mejor_porcentaje === 100).length
  const pending = progress.filter(p => !p.mejor_porcentaje).length
  const inProgress = progress.filter(p => p.mejor_porcentaje && p.mejor_porcentaje < 100).length

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Mi progreso"
        subtitle="Revisa tu avance en cada tema."
      />

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{completed}</p>
            <p className="text-sm text-slate-600">Actividades completadas</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <Target size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{inProgress}</p>
            <p className="text-sm text-slate-600">En progreso</p>
          </div>
        </Card>

        <Card className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Circle size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{pending}</p>
            <p className="text-sm text-slate-600">Sin iniciar</p>
          </div>
        </Card>
      </div>

      {/* Progreso general */}
      <Card className="p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="text-yellow-500" size={24} />
          <h2 className="text-xl font-bold text-slate-900">Avance general</h2>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-600">{overallProgress}% completado</span>
          <span className="text-sm font-medium text-slate-900">{completed} de {progress.length} actividades</span>
        </div>
        <ProgressBar progress={overallProgress} size="lg" />
      </Card>

      {/* Detalle por actividad */}
      <SectionTitle
        title="Detalle por actividad"
        subtitle="Tu mejor puntaje en cada actividad."
      />

      <div className="space-y-3">
        {progress.map(item => {
          const isCompleted = item.mejor_porcentaje === 100
          const notStarted = !item.mejor_porcentaje
          return (
            <Card key={item.id} className="p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-xs font-medium ${getAreaBadgeClass(item.area)}`}>
                      {getAreaLabel(item.area)}
                    </span>
                    <span className={`text-xs font-medium ${getDifficultyBadgeClass(item.dificultad)}`}>
                      {getDifficultyLabel(item.dificultad)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900">{item.titulo}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {notStarted
                      ? 'Sin iniciar'
                      : `${item.total_intentos} intento${item.total_intentos !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <div className="w-full md:w-48">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-900">
                      {notStarted ? '0%' : `${item.mejor_porcentaje}%`}
                    </span>
                    {isCompleted && <CheckCircle2 size={18} className="text-green-600" />}
                  </div>
                  <ProgressBar progress={notStarted ? 0 : item.mejor_porcentaje} size="sm" />
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
