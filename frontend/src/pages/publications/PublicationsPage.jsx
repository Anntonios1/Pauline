import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useData } from '../../contexts/DataContext'
import { PageHeader, Card, SectionTitle, EmptyState } from '../../components/ui'
import { BookOpen, Search, ArrowRight } from 'lucide-react'
import { getAreaLabel, getAreaBadgeClass } from '../../utils/format'
import { GridCardSkeleton, SkeletonGroup } from '../../components/ui/Skeleton'
import { publicationStyleClasses, publicationCoverClasses } from '../../utils/publicationStyle'

export default function PublicationsPage() {
  const { publications, categories, loading } = useData()
  const [searchParams] = useSearchParams()
  const areaParam = searchParams.get('area')

  const [selectedArea, setSelectedArea] = useState(areaParam || 'all')
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = publications.filter(pub => {
    const matchesArea = selectedArea === 'all' || pub.categoria_area === selectedArea
    const matchesSearch = pub.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pub.resumen?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesArea && matchesSearch
  })

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Lecturas"
        subtitle="Artículos educativos revisados por tus docentes."
      />

      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar lecturas..."
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
            Todos
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
      </div>

      {loading ? (
        <SkeletonGroup count={4} label="Cargando lecturas" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <GridCardSkeleton conPortada />
        </SkeletonGroup>
      ) : (
      <>
      <SectionTitle
        title={`${filtered.length} lectura${filtered.length !== 1 ? 's' : ''}`}
      />

      <div key={`${selectedArea}-${searchTerm}`} className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger">
        {filtered.map(pub => {
          const estiloClases = publicationStyleClasses(pub.estilo_visual, { conBarra: false })
          const portadaClases = publicationCoverClasses(pub.estilo_visual)
          return (
            <Link key={pub.id} to={`/lecturas/${pub.slug}`} className="hover-lift press block rounded-2xl">
              <Card className={`h-full overflow-hidden ${estiloClases}`} hover>
                {pub.imagen_portada ? (
                  <div className="h-32 overflow-hidden bg-slate-100">
                    <img src={pub.imagen_portada} alt="" className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                  </div>
                ) : portadaClases ? (
                  <div className={portadaClases} style={{ height: 128 }} aria-hidden="true" />
                ) : null}
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                      <BookOpen size={20} />
                    </div>
                    <span className={`text-xs font-medium ${getAreaBadgeClass(pub.categoria_area)}`}>
                      {getAreaLabel(pub.categoria_area)}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg mb-2">{pub.titulo}</h3>
                  <p className="text-slate-600 text-sm line-clamp-3 mb-4">{pub.resumen}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{pub.autor_nombre}</span>
                    <span className="text-teal-600 font-medium flex items-center gap-1">
                      Leer <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          title="No se encontraron lecturas"
          description="Prueba con otros filtros o términos de búsqueda."
          icon={BookOpen}
        />
      )}
      </>
      )}
    </div>
  )
}
