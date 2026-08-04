import { useEffect, useState } from 'react'
import { FileAudio, FileImage, FileText, Film, Link as LinkIcon, Plus, Search } from 'lucide-react'
import * as api from '../../services/api'

const TYPE_ICONS = { pdf: FileText, video: Film, audio: FileAudio, imagen: FileImage }

/** Busca recursos ya aprobados en la biblioteca para reutilizarlos sin volver a subirlos. */
export default function ResourcePicker({ onSelect, excludeIds = [] }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults([]); return }
    setLoading(true)
    const timer = setTimeout(() => {
      api.getResources({ q: term, estado: 'aprobado' })
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  const visibles = results.filter(r => !excludeIds.includes(r.id))

  return (
    <div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar en la biblioteca de recursos…"
          className="ar-input pl-9"
        />
      </div>
      {loading && <p className="mt-2 text-xs text-[color:var(--ar-muted)]">Buscando…</p>}
      {!loading && q.trim().length >= 2 && visibles.length === 0 && (
        <p className="mt-2 text-xs text-[color:var(--ar-muted)]">No hay recursos que coincidan con "{q}".</p>
      )}
      {visibles.length > 0 && (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
          {visibles.map(r => {
            const Icon = TYPE_ICONS[r.tipo] || LinkIcon
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelect(r)}
                className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-slate-50 transition-colors"
              >
                <Icon size={16} className="text-[color:var(--ar-primary)] flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900 truncate">{r.titulo}</span>
                  {r.descripcion && <span className="block text-xs text-[color:var(--ar-muted)] truncate">{r.descripcion}</span>}
                </span>
                <Plus size={16} className="text-[color:var(--ar-primary)] flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
