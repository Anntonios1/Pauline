import { Check, Palette } from 'lucide-react'
import { ACENTOS, TEMAS, useTheme } from '../../contexts/ThemeContext'

/** Panel de apariencia: modo claro/oscuro/automático + color de acento. */
export default function ThemePanel() {
  const { tema, setTema, acento, setAcento } = useTheme()

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[color:var(--ar-muted)]">Modo</p>
        <div className="grid grid-cols-3 gap-2">
          {TEMAS.map(opcion => {
            const activo = tema === opcion.value
            return (
              <button
                key={opcion.value}
                type="button"
                onClick={() => setTema(opcion.value)}
                aria-pressed={activo}
                title={opcion.descripcion}
                className={`press rounded-2xl border-2 p-3 text-center transition-all duration-200 ${
                  activo
                    ? 'border-[color:var(--ar-primary)] bg-[color:var(--ar-primary-light)]'
                    : 'border-[color:var(--ar-border)] hover:border-[color:var(--ar-border-strong)]'
                }`}
              >
                <span className="block text-xl">{opcion.emoji}</span>
                <span className={`mt-1 block text-xs font-extrabold ${activo ? 'text-[color:var(--ar-primary)]' : 'text-[color:var(--ar-muted)]'}`}>
                  {opcion.label}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-xs text-[color:var(--ar-subtle)]">
          {TEMAS.find(t => t.value === tema)?.descripcion}
        </p>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[color:var(--ar-muted)]">
          <Palette size={13} /> Color de acento
        </p>
        <div className="flex flex-wrap gap-2.5">
          {ACENTOS.map(opcion => {
            const activo = acento === opcion.value
            return (
              <button
                key={opcion.value}
                type="button"
                onClick={() => setAcento(opcion.value)}
                aria-pressed={activo}
                aria-label={`Acento ${opcion.label}`}
                title={opcion.label}
                className="press grid h-10 w-10 place-items-center rounded-full transition-transform duration-200 hover:scale-110"
                style={{
                  background: opcion.color,
                  boxShadow: activo
                    ? `0 0 0 3px var(--ar-surface), 0 0 0 5px ${opcion.color}`
                    : '0 2px 6px rgba(0,0,0,.18)',
                }}
              >
                {activo && <Check size={18} className="text-white a-pop" strokeWidth={3} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
