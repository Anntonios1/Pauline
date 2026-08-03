import { Check } from 'lucide-react'
import { ACENTOS_PUB, PATRONES_PUB } from '../../utils/publicationStyle'

/**
 * Selector de apariencia de una publicación: color de acento + patrón de
 * portada. `value` es {acento, patron}; el padre lo manda tal cual al API
 * como `estilo_visual`.
 */
export default function PublicationStylePicker({ value = {}, onChange }) {
  const acento = value.acento || 'turquesa'
  const patron = value.patron || 'liso'

  const actualizar = (cambios) => onChange?.({ acento, patron, ...cambios })

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[color:var(--ar-muted)]">
          Color de la publicación
        </label>
        <div className="flex flex-wrap gap-2.5">
          {ACENTOS_PUB.map(opcion => {
            const activo = acento === opcion.value
            return (
              <button
                key={opcion.value}
                type="button"
                onClick={() => actualizar({ acento: opcion.value })}
                aria-pressed={activo}
                aria-label={opcion.label}
                title={opcion.label}
                className="press grid h-9 w-9 place-items-center rounded-full transition-transform duration-200 hover:scale-110"
                style={{
                  background: opcion.color,
                  boxShadow: activo
                    ? `0 0 0 3px var(--ar-surface), 0 0 0 5px ${opcion.color}`
                    : '0 2px 6px rgba(0,0,0,.18)',
                }}
              >
                {activo && <Check size={16} className="a-pop text-white" strokeWidth={3} />}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-extrabold uppercase tracking-wide text-[color:var(--ar-muted)]">
          Patrón de portada
        </label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PATRONES_PUB.map(opcion => {
            const activo = patron === opcion.value
            return (
              <button
                key={opcion.value}
                type="button"
                onClick={() => actualizar({ patron: opcion.value })}
                aria-pressed={activo}
                className={`press overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                  activo ? 'border-[color:var(--ar-primary)]' : 'border-[color:var(--ar-border)] hover:border-[color:var(--ar-border-strong)]'
                }`}
              >
                {/* Miniatura real del patrón, con el acento elegido */}
                <span
                  className={`block h-10 w-full pub-themed pub-a-${acento} ${opcion.value === 'liso' ? 'pub-cover' : `pub-cover pub-p-${opcion.value}`}`}
                  style={{ height: 40 }}
                />
                <span className={`block py-1 text-[11px] font-bold ${activo ? 'text-[color:var(--ar-primary)]' : 'text-[color:var(--ar-muted)]'}`}>
                  {opcion.label}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-xs text-[color:var(--ar-subtle)]">
          Se usa como portada cuando la publicación no lleva imagen.
        </p>
      </div>
    </div>
  )
}
