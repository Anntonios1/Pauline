import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useData } from '../../contexts/DataContext'
import { PageHeader, Card, SectionTitle, EmptyState } from '../../components/ui'
import { FolderOpen, ExternalLink, FileText, Image, Video, Search } from 'lucide-react'
import { getAreaLabel, getAreaBadgeClass } from '../../utils/format'
import { createEvent } from '../../services/api'

const typeIcons = {
  pdf: FileText,
  imagen: Image,
  video: Video,
}

export default function ResourcesPage() {
  const { resources, categories } = useData()
  const [searchParams] = useSearchParams()
  const areaParam = searchParams.get('area')

  const [selectedArea, setSelectedArea] = useState(areaParam || 'all')
  const [selectedType, setSelectedType] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = resources.filter(res => {
    const matchesArea = selectedArea === 'all' || res.area === selectedArea
    const matchesType = selectedType === 'all' || res.tipo === selectedType
    const term = searchTerm.trim().toLowerCase()
    const matchesSearch = !term ||
      res.titulo?.toLowerCase().includes(term) ||
      res.descripcion?.toLowerCase().includes(term)
    return matchesArea && matchesType && matchesSearch
  })

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Recursos"
        subtitle="Imágenes, videos y documentos para reforzar tu aprendizaje."
      />

      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar recursos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedArea('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedArea === 'all' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.area}
              onClick={() => setSelectedArea(cat.area)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedArea === cat.area ? 'bg-teal-600 text-white' : getAreaBadgeClass(cat.area)
              }`}
            >
              {getAreaLabel(cat.area)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {['pdf', 'imagen', 'video'].map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(selectedType === type ? 'all' : type)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                selectedType === type ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <SectionTitle
        title={`${filtered.length} recurso${filtered.length !== 1 ? 's' : ''}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(res => {
          const Icon = typeIcons[res.tipo] || FolderOpen
          return (
            <Card key={res.id} className="p-5 hover:border-purple-200 transition-colors" hover>
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
                <Icon size={24} />
              </div>
              <span className={`text-xs font-medium ${getAreaBadgeClass(res.area)}`}>
                {getAreaLabel(res.area)}
              </span>
              <h3 className="font-bold text-slate-900 mt-2 mb-1">{res.titulo}</h3>
              <p className="text-sm text-slate-600 line-clamp-2 mb-4">{res.descripcion}</p>
              <a
                href={res.archivo_o_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => createEvent({ verbo: 'abrio', objeto_tipo: 'recurso', objeto_id: res.id }).catch(() => {})}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700"
              >
                Abrir recurso <ExternalLink size={14} />
              </a>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          title="No se encontraron recursos"
          description="Prueba con otros filtros."
          icon={FolderOpen}
        />
      )}
    </div>
  )
}
