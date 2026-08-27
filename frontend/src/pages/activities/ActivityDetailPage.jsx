import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Play, RotateCcw } from 'lucide-react'
import { useData } from '../../contexts/DataContext'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { Badge, Button, Card, EmptyState, LoadingState } from '../../components/ui'
import GameEngine from '../../engines/GameEngine'
import { getAreaBadgeClass, getAreaLabel, getDifficultyBadgeClass, getDifficultyLabel } from '../../utils/format'

function normalizeQuizPayload(payload, fallbackActivity) {
  const source = payload?.quiz || payload || {}
  const embeddedActivity = source.actividad || source.activity || {}
  const activity = {
    ...fallbackActivity,
    ...embeddedActivity,
    ...(source.titulo ? source : {}),
  }
  const items = source.items
    || source.preguntas
    || embeddedActivity.items
    || embeddedActivity.preguntas
    || fallbackActivity?.items
    || fallbackActivity?.preguntas
    || []
  const config = source.config
    || source.quiz_config
    || embeddedActivity.config
    || embeddedActivity.quiz_config
    || fallbackActivity?.config
    || fallbackActivity?.quiz_config
    || {}

  return {
    activity: {
      ...activity,
      config,
      quiz_config: config,
      items,
      preguntas: items,
    },
    items: Array.isArray(items) ? items : [],
    config,
  }
}

/**
 * Una actividad que es un solo bloque incrustado (Wordwall, YouTube, …) no
 * gana nada con la pantalla intermedia de "Comenzar": el contenido es el
 * juego en sí. En ese caso se entra directo y se ahorra un clic. Con varios
 * bloques la pantalla sí aporta (instrucciones, cuántos bloques, tiempo).
 */
function esActividadDeUnSoloEmbed(items) {
  if (!Array.isArray(items) || items.length !== 1) return false
  const raw = items[0] || {}
  let config = raw.config ?? raw.configuracion ?? {}
  if (typeof config === 'string') {
    try { config = JSON.parse(config) } catch { config = {} }
  }
  return Boolean(config?.embed_url || config?.wordwall_url)
}

function getAnswerValue(entry) {
  if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) return entry
  if (Object.prototype.hasOwnProperty.call(entry, 'respuesta')) return entry.respuesta
  if (Object.prototype.hasOwnProperty.call(entry, 'answer')) return entry.answer
  if (Object.prototype.hasOwnProperty.call(entry, 'value')) return entry.value
  if (Object.prototype.hasOwnProperty.call(entry, 'selected')) return entry.selected
  if (Object.prototype.hasOwnProperty.call(entry, 'seleccion')) return entry.seleccion
  return null
}

function getAnswerTime(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  const value = entry.tiempo_ms ?? entry.time_spent_ms ?? entry.time_ms
  return Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : null
}

function normalizeAnswers(completion, items) {
  const rawAnswers = completion?.respuestas ?? completion?.answers ?? completion?.responses ?? []

  if (!Array.isArray(rawAnswers) && rawAnswers && typeof rawAnswers === 'object') {
    return Object.entries(rawAnswers).map(([questionId, answer]) => {
      const tiempoMs = getAnswerTime(answer)
      return {
        pregunta_id: Number.isNaN(Number(questionId)) ? questionId : Number(questionId),
        respuesta: getAnswerValue(answer),
        ...(tiempoMs != null ? { tiempo_ms: tiempoMs } : {}),
      }
    })
  }

  if (!Array.isArray(rawAnswers)) return []

  return rawAnswers.map((entry, index) => {
    const fallbackId = items[index]?.id
    if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
      return { pregunta_id: fallbackId, respuesta: entry }
    }

    const tiempoMs = getAnswerTime(entry)
    return {
      pregunta_id: entry.pregunta_id
        ?? entry.questionId
        ?? entry.question_id
        ?? entry.itemId
        ?? entry.id
        ?? fallbackId,
      respuesta: getAnswerValue(entry),
      ...(tiempoMs != null ? { tiempo_ms: tiempoMs } : {}),
    }
  }).filter(answer => answer.pregunta_id != null)
}

export default function ActivityDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { getActivityById, refreshProgress } = useData()
  const { user } = useAuth()
  const isTeacher = user?.rol === 'docente' || user?.rol === 'administrador'
  const contextActivity = getActivityById(id)
  const activityBasePath = location.pathname.startsWith('/admin') ? '/admin/actividades' : '/actividades'

  const [quizData, setQuizData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [started, setStarted] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [attemptId, setAttemptId] = useState(null)
  const [saveState, setSaveState] = useState('idle')
  const [saveError, setSaveError] = useState('')
  const [savedResult, setSavedResult] = useState(null)
  const [runKey, setRunKey] = useState(0)
  const activeSubmission = useRef(null)
  const lastCompletion = useRef(null)
  const autoStarted = useRef(null)

  useEffect(() => {
    let active = true

    async function loadQuiz() {
      setQuizData(null)
      setLoadError('')
      setStarted(false)
      setStarting(false)
      setStartError('')
      setAttemptId(null)
      setSaveState('idle')
      setSaveError('')
      setSavedResult(null)

      try {
        let baseActivity = contextActivity
        try {
          baseActivity = await api.getActivityById(id)
        } catch (error) {
          if (!baseActivity) throw error
        }

        // `motor_quiz` (backend) ya decide de forma autoritativa qué motor de
        // preguntas usa la actividad y `get_activity` devuelve `preguntas`/
        // `items` resueltos para ambos casos — ya no hace falta un segundo
        // fetch a /quiz para "adivinar" si el legacy vino vacío.
        if (active) setQuizData(normalizeQuizPayload(baseActivity, baseActivity))
      } catch (error) {
        if (active) setLoadError(error.message || 'No se pudo cargar el quiz')
      }
    }

    loadQuiz()
    return () => { active = false }
  }, [id])

  const activity = quizData?.activity || contextActivity
  const items = quizData?.items || []

  const fullActivity = useMemo(() => {
    if (!activity) return null
    return {
      ...activity,
      config: quizData?.config || {},
      quiz_config: quizData?.config || {},
      items,
      preguntas: items,
    }
  }, [activity, items, quizData?.config])

  const handleStart = useCallback(async () => {
    if (!activity || starting) return
    if (isTeacher) {
      setStarted(true)
      return
    }
    setStarting(true)
    setStartError('')

    try {
      // El intento se crea aquí, no al terminar: así `duracion_segundos` mide el tiempo real
      // y abandonar a mitad consume intento. El 400 del backend es la única fuente de
      // verdad sobre `intentos_maximos`.
      // Si ya hay un intento abierto sin enviar (el estudiante volvió al detalle), se reusa.
      if (!attemptId) {
        const intento = await api.createAttempt(activity.id)
        setAttemptId(intento.id)
      }
      setStarted(true)
    } catch (error) {
      setStartError(error.message || 'No se pudo iniciar el intento. Inténtalo de nuevo.')
    } finally {
      setStarting(false)
    }
  }, [activity, attemptId, isTeacher, starting])

  // Entra directo al juego cuando la actividad es un único bloque incrustado.
  // El ref evita volver a entrar si el estudiante pulsa "Volver al detalle".
  useEffect(() => {
    if (!quizData || started || autoStarted.current === id) return
    if (!esActividadDeUnSoloEmbed(items)) return
    autoStarted.current = id
    handleStart()
  }, [quizData, items, started, id, handleStart])

  const persistCompletion = useCallback(async (completion) => {
    if (!activity || activeSubmission.current) return activeSubmission.current

    if (isTeacher) {
      setSaveState('saved')
      setSavedResult(null)
      return { preview: true, completion }
    }

    if (!attemptId) {
      setSaveState('error')
      setSaveError('No hay un intento activo. Vuelve al detalle y comienza de nuevo.')
      return null
    }

    lastCompletion.current = completion
    setSaveState('saving')
    setSaveError('')

    const submission = (async () => {
      try {
        const respuestas = normalizeAnswers(completion, items)
        const result = await api.submitAttempt(attemptId, respuestas)
        const storedResult = {
          ...(result?.intento || result || {}),
          detalle: result?.detalle || [],
          completion,
        }

        localStorage.setItem(`activity-result-${activity.id}`, JSON.stringify(storedResult))
        setSavedResult(result)
        setSaveState('saved')
        await refreshProgress()
        return result
      } catch (error) {
        setSaveState('error')
        setSaveError(error.message || 'No se pudo guardar el resultado')
        return null
      } finally {
        activeSubmission.current = null
      }
    })()

    activeSubmission.current = submission
    return submission
  }, [activity, attemptId, isTeacher, items, refreshProgress])

  const retrySave = useCallback(() => {
    if (lastCompletion.current) persistCompletion(lastCompletion.current)
  }, [persistCompletion])

  const restart = () => {
    activeSubmission.current = null
    lastCompletion.current = null
    setSaveError('')
    setSavedResult(null)
    // Un intento ya enviado no admite más respuestas: hay que volver al detalle y
    // consumir un intento nuevo (el backend valida `intentos_maximos`).
    if (saveState === 'saved') {
      setAttemptId(null)
      setStarted(false)
    }
    setSaveState('idle')
    setRunKey(key => key + 1)
  }

  if (loadError) {
    return (
      <div className="animate-fade-in">
        <button type="button" onClick={() => navigate(activityBasePath)} className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft size={20} /> Volver a actividades
        </button>
        <EmptyState title="No se pudo cargar la actividad" description={loadError} emoji="⚠️" />
      </div>
    )
  }

  if (!quizData) return <LoadingState message="Cargando experiencia interactiva..." />

  if (!activity) {
    return (
      <div className="animate-fade-in">
        <button type="button" onClick={() => navigate(activityBasePath)} className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft size={20} /> Volver a actividades
        </button>
        <EmptyState title="Actividad no encontrada" description="Esta actividad no existe o fue eliminada." emoji="🔍" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="animate-fade-in">
        <button type="button" onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft size={20} /> Volver
        </button>
        <Card className="p-6 md:p-8">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge className={getAreaBadgeClass(activity.area)}>{getAreaLabel(activity.area)}</Badge>
            <Badge className={getDifficultyBadgeClass(activity.dificultad)}>{getDifficultyLabel(activity.dificultad)}</Badge>
          </div>
          <h1 className="mb-3 text-2xl font-bold text-slate-900 md:text-3xl">{activity.titulo}</h1>
          <EmptyState title="Sin contenido todavía" description="El docente aún no ha publicado bloques para este quiz." emoji="🧩" />
        </Card>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="animate-fade-in">
        <button type="button" onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft size={20} /> Volver
        </button>

        <Card className="p-6 md:p-8">
          <div className="mb-4 flex flex-wrap gap-2">
            <Badge className={getAreaBadgeClass(activity.area)}>{getAreaLabel(activity.area)}</Badge>
            <Badge className={getDifficultyBadgeClass(activity.dificultad)}>{getDifficultyLabel(activity.dificultad)}</Badge>
            <Badge variant="teal">Quiz interactivo</Badge>
          </div>

          <h1 className="mb-3 text-2xl font-bold text-slate-900 md:text-3xl">{activity.titulo}</h1>
          {activity.descripcion && <p className="mb-6 text-slate-600">{activity.descripcion}</p>}

          {activity.instrucciones && (
            <div className="mb-6 rounded-xl bg-slate-50 p-4">
              <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
                <AlertCircle size={18} /> Instrucciones
              </h2>
              <p className="text-sm text-slate-700">{activity.instrucciones}</p>
            </div>
          )}

          <div className="mb-6 flex flex-wrap items-center gap-6 text-sm text-slate-600">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={18} />
              {items.length} bloque{items.length === 1 ? '' : 's'}
            </span>
            {quizData.config?.tiempo_global_segundos > 0 && (
              <span className="flex items-center gap-1.5">
                <Clock size={18} /> {Math.ceil(quizData.config.tiempo_global_segundos / 60)} min
              </span>
            )}
          </div>

          <Button variant="primary" className="w-full gap-2 md:w-auto" onClick={handleStart} disabled={starting}>
            <Play size={18} /> {starting ? 'Iniciando intento...' : isTeacher ? 'Abrir vista previa' : 'Comenzar experiencia interactiva'}
          </Button>
          {startError && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{startError}</p>}
        </Card>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setStarted(false)} className="flex items-center gap-2 font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft size={20} /> Volver al detalle
        </button>
        <button type="button" onClick={restart} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-700">
          <RotateCcw size={16} /> Reiniciar
        </button>
      </div>

      {saveState === 'saving' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800" role="status">
          Guardando tu resultado...
        </div>
      )}
      {saveState === 'saved' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800" role="status">
          <span className="flex items-center gap-2"><CheckCircle2 size={18} /> {isTeacher ? 'Vista previa completada: no se registró un intento de estudiante.' : 'Resultado guardado correctamente.'}</span>
          {savedResult && (
            <button type="button" className="underline" onClick={() => navigate(`${activityBasePath}/${activity.id}/resultado`)}>
              Ver resumen
            </button>
          )}
        </div>
      )}
      {saveState === 'error' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <span><strong>No se guardó el resultado.</strong> {saveError}</span>
          <button type="button" className="font-bold underline" onClick={retrySave}>Reintentar guardado</button>
        </div>
      )}

      <GameEngine key={runKey} activity={fullActivity} onComplete={persistCompletion} />
    </div>
  )
}
