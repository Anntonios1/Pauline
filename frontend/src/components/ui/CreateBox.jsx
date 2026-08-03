import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const STUDENT_OPTIONS = [
  { icon: '💡', label: 'Algo que aprendí', path: '/crear?tipo=aprendizaje' },
  { icon: '❓', label: 'Una pregunta', path: '/crear?tipo=pregunta' },
  { icon: '🧪', label: 'La solución de un reto', path: '/crear?tipo=solucion' },
]

const TEACHER_OPTIONS = [
  { icon: '🧩', label: 'Crear un quiz', path: '/admin/crear-juego' },
  { icon: '📚', label: 'Publicar una lectura', path: '/admin/crear?tipo=lectura' },
  { icon: '📎', label: 'Añadir un recurso', path: '/admin/recursos' },
]

export default function CreateBox() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isTeacher = ['docente', 'administrador'].includes(user?.rol)
  const options = isTeacher ? TEACHER_OPTIONS : STUDENT_OPTIONS
  const name = user?.nombre_visible?.split(' ')[0] || (isTeacher ? 'docente' : 'explorador')

  return (
    <div className={`ar-card mb-3 overflow-hidden ${isTeacher ? 'ring-1 ring-violet-200' : ''}`}>
      <button onClick={() => navigate(isTeacher ? '/admin/crear' : '/crear')} className="create-box w-full border-b border-slate-100 rounded-none" id="create-box-btn">
        <div className={`avatar-md text-white flex-shrink-0 ${isTeacher ? 'bg-violet-600' : 'bg-[color:var(--ar-primary)]'}`}>
          {user?.imagen_perfil
            ? <img src={user.imagen_perfil} alt="" className="h-full w-full object-cover" />
            : (user?.nombre_visible?.charAt(0) || '?')}
        </div>
        <div className={`flex-1 text-left px-4 py-2.5 rounded-full border text-sm font-semibold transition-colors ${isTeacher ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-slate-50 border-slate-200 text-[color:var(--ar-muted)]'}`}>
          {isTeacher ? `¿Qué vas a enseñar hoy, ${name}?` : `¿Qué aprendiste hoy, ${name}?`}
        </div>
      </button>
      <div className="px-4 py-3 grid grid-cols-3 gap-2">
        {options.map(option => <button key={option.label} onClick={() => navigate(option.path)} className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center hover:bg-slate-50">
          <span className="text-xl">{option.icon}</span><span className="text-[10px] font-bold text-[color:var(--ar-muted)] leading-tight">{option.label}</span>
        </button>)}
      </div>
    </div>
  )
}
