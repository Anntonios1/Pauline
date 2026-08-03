import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

/** Alterna claro/oscuro de un toque. El panel completo vive en ThemePanel. */
export default function ThemeToggle({ className = '' }) {
  const { esOscuro, alternarTema } = useTheme()

  return (
    <button
      type="button"
      onClick={alternarTema}
      className={`press relative grid h-9 w-9 place-items-center rounded-xl transition-colors ${className}`}
      aria-label={esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={esOscuro ? 'Tema claro' : 'Tema oscuro'}
    >
      {/* Los dos iconos se cruzan con un giro en vez de aparecer de golpe */}
      <Sun
        size={20}
        className="absolute transition-all duration-300"
        style={{
          opacity: esOscuro ? 0 : 1,
          transform: esOscuro ? 'rotate(-90deg) scale(0.5)' : 'rotate(0) scale(1)',
        }}
      />
      <Moon
        size={20}
        className="absolute transition-all duration-300"
        style={{
          opacity: esOscuro ? 1 : 0,
          transform: esOscuro ? 'rotate(0) scale(1)' : 'rotate(90deg) scale(0.5)',
        }}
      />
    </button>
  )
}
