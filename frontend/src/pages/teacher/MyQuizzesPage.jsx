import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Edit3, Eye, EyeOff, Rocket, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Card, Badge, SectionTitle, EmptyState, LoadingState } from '../../components/ui'
import * as api from '../../services/api'

const ESTADO_LABEL = { borrador: 'Borrador', publicado: 'Publicado', archivado: 'Archivado' }
const ESTADO_CLASS = {
  borrador: 'bg-amber-100 text-amber-700',
  publicado: 'bg-emerald-100 text-emerald-700',
  archivado: 'bg-slate-200 text-slate-600',
}

export default function MyQuizzesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    setLoading(true)
    api.getActivities({ creado_por: user.id, activas: 'false' })
      .then((activities) => setQuizzes(activities.filter((a) => a.quiz_unificado)))
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const publicar = async (id) => {
    setBusyId(id); setMessage('')
    try { await api.publishQuiz(id); load() }
    catch (error) { setMessage(error.message) }
    finally { setBusyId(null) }
  }

  const alternarPrivado = async (quiz) => {
    setBusyId(quiz.id); setMessage('')
    try { await api.updateQuiz(quiz.id, { privado: !quiz.quiz_privado }); load() }
    catch (error) { setMessage(error.message) }
    finally { setBusyId(null) }
  }

  const retirar = async (id) => {
    if (!window.confirm('¿Archivar este quiz? Dejará de estar disponible para los estudiantes.')) return
    setBusyId(id); setMessage('')
    try { await api.archiveQuiz(id); load() }
    catch (error) { setMessage(error.message) }
    finally { setBusyId(null) }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Mis quizzes" subtitle="Todos los quizzes que has creado: borradores, publicados, privados y archivados." />

      {message && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{message}</p>}

      <section>
        <SectionTitle title={`Tus quizzes (${quizzes.length})`} subtitle="Edítalos, publícalos o hazlos privados en cualquier momento." />
        {loading ? (
          <LoadingState message="Cargando tus quizzes..." />
        ) : quizzes.length === 0 ? (
          <EmptyState title="Todavía no has creado ningún quiz" description="Crea el primero desde el constructor interactivo." emoji="📝" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {quizzes.map((quiz) => (
              <Card key={quiz.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${ESTADO_CLASS[quiz.quiz_estado] || ESTADO_CLASS.borrador}`}>
                    {ESTADO_LABEL[quiz.quiz_estado] || quiz.quiz_estado}
                  </span>
                  {!!quiz.quiz_privado && <Badge className="bg-violet-100 text-violet-700">Privado</Badge>}
                  <Badge className="bg-slate-100 capitalize text-slate-600">{quiz.dificultad}</Badge>
                </div>
                <h3 className="mt-2 text-lg font-bold text-slate-900">{quiz.titulo}</h3>
                {quiz.descripcion && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{quiz.descripcion}</p>}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => navigate(`/admin/crear-juego/${quiz.id}`)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-teal-700">
                    <Edit3 size={15} /> Editar
                  </button>
                  {quiz.quiz_estado === 'borrador' && (
                    <button type="button" disabled={busyId === quiz.id} onClick={() => publicar(quiz.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                      <Rocket size={15} /> Publicar
                    </button>
                  )}
                  <button type="button" disabled={busyId === quiz.id} onClick={() => alternarPrivado(quiz)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-100 px-3.5 py-2 text-sm font-bold text-violet-700 hover:bg-violet-200 disabled:opacity-60">
                    {quiz.quiz_privado ? <Eye size={15} /> : <EyeOff size={15} />}
                    {quiz.quiz_privado ? 'Hacer público' : 'Hacer privado'}
                  </button>
                  {quiz.quiz_estado !== 'archivado' && (
                    <button type="button" disabled={busyId === quiz.id} onClick={() => retirar(quiz.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3.5 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60">
                      <Trash2 size={15} /> Archivar
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
