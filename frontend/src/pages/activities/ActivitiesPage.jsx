import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useData } from '../../contexts/DataContext'
import { PageHeader, Card, SectionTitle, EmptyState } from '../../components/ui'
import { ClipboardList, ArrowRight, Search } from 'lucide-react'
import { getAreaLabel, getAreaBadgeClass, getDifficultyLabel, getDifficultyBadgeClass } from '../../utils/format'
import { GridCardSkeleton, SkeletonGroup } from '../../components/ui/Skeleton'

export default function ActivitiesPage() {
  const { activities, categories, loading } = useData()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const areaParam = searchParams.get('area')

  const [selectedArea, setSelectedArea] = useState(areaParam || 'all')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const activityBasePath = location.pathname.startsWith('/admin') ? '/admin/actividades' : '/actividades'

  const filtered = activities.filter(act => {
    const matchesArea = selectedArea === 'all' || act.area === selectedArea
    const matchesDifficulty = selectedDifficulty === 'all' || act.dificultad === selectedDifficulty
    const term = searchTerm.trim().toLowerCase()
    const matchesSearch = !term ||
      act.titulo?.toLowerCase().includes(term) ||
      act.descripcion?.toLowerCase().includes(term)
    return matchesArea && matchesDifficulty && matchesSearch
  })

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Actividades"
        subtitle="Aprende con quizzes interactivos creados por tus docentes."
      />

      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar actividades..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedArea('all')}
            className={`ar-chip press ${selectedArea === 'all' ? 'active' : ''}`}
          >
            Todos los temas
          </button>
          {categories.map(cat => (
            <button
              key={cat.area}
              onClick={() => setSelectedArea(cat.area)}
              className={`ar-chip press ${selectedArea === cat.area ? 'active' : ''}`}
            >
              {getAreaLabel(cat.area)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {['basica', 'media', 'avanzada'].map(diff => (
            <button
              key={diff}
              onClick={() => setSelectedDifficulty(selectedDifficulty === diff ? 'all' : diff)}
              className={`ar-chip press ${selectedDifficulty === diff ? 'active' : ''}`}
            >
              {getDifficultyLabel(diff)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <SkeletonGroup count={4} label="Cargando actividades" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GridCardSkeleton conPortada />
        </SkeletonGroup>
      ) : (
      <>
      <SectionTitle
        title={`${filtered.length} actividad${filtered.length !== 1 ? 'es' : ''}`}
      />

      <div key={`${selectedArea}-${selectedDifficulty}-${searchTerm}`} className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        {filtered.map(act => (
          <Link key={act.id} to={`${activityBasePath}/${act.id}`} className="hover-lift press block rounded-2xl">
            <Card className="h-full overflow-hidden" hover>
              <div className="relative h-32 overflow-hidden bg-gradient-to-br from-teal-500 to-blue-600">
                {act.imagen_portada ? <img src={act.imagen_portada} alt="" className="h-full w-full object-cover transition duration-300 hover:scale-105" /> : <div className="flex h-full items-center justify-center text-white/90"><ClipboardList size={42} /></div>}
                {Number(act.live_questions_count) > 0 && <span className="absolute bottom-3 left-3 rounded-full bg-violet-600/90 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">Juego interactivo</span>}
              </div>
              <div className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                  <ClipboardList size={20} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs font-medium ${getAreaBadgeClass(act.area)}`}>
                    {getAreaLabel(act.area)}
                  </span>
                  <span className={`text-xs font-medium ${getDifficultyBadgeClass(act.dificultad)}`}>
                    {getDifficultyLabel(act.dificultad)}
                  </span>
                </div>
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">{act.titulo}</h3>
              <p className="text-slate-600 text-sm line-clamp-2 mb-4">{act.descripcion}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {act.preguntas_count != null
                    ? `${act.preguntas_count} bloque${Number(act.preguntas_count) === 1 ? '' : 's'}`
                    : `${act.intentos_maximos} intento${Number(act.intentos_maximos) === 1 ? '' : 's'}`}
                </span>
                <span className="text-teal-600 font-medium flex items-center gap-1 text-sm">
                  Empezar <ArrowRight size={16} />
                </span>
              </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          title="No se encontraron actividades"
          description="Prueba con otros filtros de tema o dificultad."
          icon={ClipboardList}
        />
      )}
      </>
      )}
    </div>
  )
}
