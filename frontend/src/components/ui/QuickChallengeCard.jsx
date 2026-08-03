import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'

export default function QuickChallengeCard({ challenge }) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (challenge.actividad_id) {
      navigate(`/actividades/${challenge.actividad_id}`)
    }
  }

  return (
    <button
      onClick={handleClick}
      className="challenge-card relative"
      aria-label={`Reto rápido: ${challenge.titulo}`}
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${challenge.gradiente}`} />

      {/* Completed overlay */}
      {challenge.completado && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
          <div className="bg-white/90 rounded-full p-1">
            <CheckCircle size={20} className="text-green-600" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-0 flex flex-col justify-end h-full p-3 text-white">
        <span className="text-2xl mb-1 block">{challenge.emoji}</span>
        <p className="font-extrabold text-sm leading-tight line-clamp-2">{challenge.titulo}</p>
        <p className="text-[10px] font-semibold opacity-80 mt-0.5">{challenge.subtitulo}</p>
      </div>
    </button>
  )
}
