import { useState } from 'react'
import { useData } from '../../contexts/DataContext'
import { useNavigate } from 'react-router-dom'
import { Search, BookOpen, ClipboardList, FolderOpen, ChevronRight } from 'lucide-react'
import { areaLabels, areaColors, areaGradients } from '../../data/labels'

const TABS = [
  { key: 'temas',       label: '🗂️ Temas' },
  { key: 'lecturas',    label: '📖 Lecturas' },
  { key: 'actividades', label: '🧩 Actividades' },
  { key: 'recursos',    label: '📁 Recursos' },
]

export default function ExplorePage() {
  const { categories, publications, activities, resources } = useData()
  const navigate = useNavigate()
  const [tab, setTab] = useState('temas')
  const [search, setSearch] = useState('')

  const filterText = (text) =>
    !search || text?.toLowerCase().includes(search.toLowerCase())

  return (
    <div className="feed-container pb-4 fade-in">
      <h1 className="text-xl font-extrabold text-slate-900 mb-4">Explorar</h1>

      {/* Búsqueda */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--ar-muted)]" size={18} />
        <input
          type="search"
          placeholder="Buscar temas, lecturas, actividades…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ar-input pl-11"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-extrabold transition-all
              ${tab === t.key
                ? 'bg-[color:var(--ar-primary)] text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-[color:var(--ar-primary)]'
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Temas */}
      {tab === 'temas' && (
        <div className="grid grid-cols-2 gap-3">
          {categories
            .filter(c => filterText(c.nombre) || filterText(c.descripcion))
            .map(cat => (
              <button
                key={cat.id}
                onClick={() => navigate(`/lecturas?area=${cat.area}`)}
                className="ar-card p-4 text-left hover:shadow-md transition-all active:scale-95"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${areaGradients[cat.area] || 'from-slate-400 to-slate-600'} flex items-center justify-center mb-3`}>
                  <BookOpen size={18} className="text-white" />
                </div>
                <p className="font-extrabold text-sm text-slate-900 leading-tight">{cat.nombre}</p>
                <p className="text-xs text-[color:var(--ar-muted)] mt-1 line-clamp-2">{cat.descripcion}</p>
              </button>
            ))}
        </div>
      )}

      {/* Lecturas */}
      {tab === 'lecturas' && (
        <div className="space-y-3">
          {publications
            .filter(p => filterText(p.titulo) || filterText(p.resumen))
            .map(pub => (
              <button
                key={pub.id}
                onClick={() => navigate(`/lecturas/${pub.slug}`)}
                className="ar-card p-4 w-full text-left flex items-center gap-3 hover:shadow-md transition-all active:scale-95"
              >
                <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${areaGradients[pub.categoria_area] || 'from-blue-400 to-blue-600'}`}>
                  <BookOpen size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 line-clamp-1">{pub.titulo}</p>
                  <p className="text-xs text-[color:var(--ar-muted)] line-clamp-2 mt-0.5">{pub.resumen}</p>
                  <span className={`ar-badge mt-1 ${areaColors[pub.categoria_area] || 'bg-slate-100 text-slate-600'}`}>
                    {areaLabels[pub.categoria_area]}
                  </span>
                </div>
                <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
              </button>
            ))}
        </div>
      )}

      {/* Actividades */}
      {tab === 'actividades' && (
        <div className="space-y-3">
          {activities
            .filter(a => filterText(a.titulo) || filterText(a.descripcion))
            .map(act => (
              <button
                key={act.id}
                onClick={() => navigate(`/actividades/${act.id}`)}
                className="ar-card p-4 w-full text-left flex items-center gap-3 hover:shadow-md transition-all active:scale-95"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex-shrink-0 flex items-center justify-center">
                  <ClipboardList size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 line-clamp-1">{act.titulo}</p>
                  <p className="text-xs text-[color:var(--ar-muted)] mt-0.5">{act.descripcion}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`ar-badge ${areaColors[act.area] || 'bg-slate-100 text-slate-600'}`}>{areaLabels[act.area]}</span>
                    <span className="ar-badge bg-slate-100 text-slate-600 capitalize">{act.dificultad}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
              </button>
            ))}
        </div>
      )}

      {/* Recursos */}
      {tab === 'recursos' && (
        <div className="grid grid-cols-2 gap-3">
          {resources
            .filter(r => filterText(r.titulo) || filterText(r.descripcion))
            .map(res => {
              const iconos = { imagen: '🖼️', video: '🎬', pdf: '📄' }
              return (
                <div key={res.id} className="ar-card p-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-3 text-xl">
                    {iconos[res.tipo] || '📁'}
                  </div>
                  <p className="font-bold text-sm text-slate-900 line-clamp-2">{res.titulo}</p>
                  <p className="text-xs text-[color:var(--ar-muted)] mt-1 capitalize">{res.tipo}</p>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
