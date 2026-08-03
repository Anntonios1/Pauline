import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useGameRoom } from '../../contexts/WebSocketContext'
import { Card, Badge } from '../../components/ui'
import { QrCode, CheckCircle, Clock, ShieldAlert, Sparkles } from 'lucide-react'

export default function GameJoinPage() {
  const { code: routeCode } = useParams()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const {
    connectToRoom,
    status,
    question,
    questionIndex,
    totalQuestions,
    sendAnswer,
    answerAck,
    questionResults,
    leaderboard,
    error,
  } = useGameRoom()

  const [inputCode, setInputCode] = useState(routeCode || '')
  const [selectedOption, setSelectedOption] = useState(null)
  const [startTime, setStartTime] = useState(Date.now())
  const [secondsLeft, setSecondsLeft] = useState(20)

  const activeCode = routeCode || inputCode

  const handleJoin = (e) => {
    e.preventDefault()
    if (!inputCode.trim()) return
    connectToRoom(inputCode.trim().toUpperCase(), token, user?.nombre_visible || 'Estudiante')
  }

  useEffect(() => {
    if (routeCode && token) {
      connectToRoom(routeCode.toUpperCase(), token, user?.nombre_visible || 'Estudiante')
    }
  }, [routeCode, token, connectToRoom, user])

  useEffect(() => {
    if (question) {
      setSelectedOption(question.tipo === 'multiple_choice' ? [] : null)
      setStartTime(Date.now())
      setSecondsLeft(Number(question.tiempo_segundos || 20))
    }
  }, [question])

  useEffect(() => {
    if (!question || answerAck || questionResults) return undefined
    const timer = window.setInterval(() => setSecondsLeft(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [question, answerAck, questionResults])

  const handleSelectOption = (optIdx) => {
    if (answerAck || secondsLeft <= 0) return
    if (question.tipo === 'multiple_choice') {
      setSelectedOption(current => current.includes(optIdx) ? current.filter(index => index !== optIdx) : [...current, optIdx])
      return
    }
    if (selectedOption !== null) return
    setSelectedOption(optIdx)
    const timeMs = Date.now() - startTime
    sendAnswer(questionIndex, optIdx, timeMs)
  }

  const submitMultipleAnswer = () => {
    if (!Array.isArray(selectedOption) || selectedOption.length === 0 || answerAck || secondsLeft <= 0) return
    sendAnswer(questionIndex, selectedOption, Date.now() - startTime)
  }

  return (
    <div className="animate-fade-in max-w-lg mx-auto space-y-6 pt-4">
      {/* Formulario de Entrada de Código si no se entró por ruta directa */}
      {status === 'disconnected' && !routeCode && (
        <Card className="p-8 text-center space-y-6 border-2 border-teal-200 bg-white shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 text-teal-600 flex items-center justify-center mx-auto shadow-inner">
            <QrCode size={36} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">Unirse a la Sala de Juego</h1>
            <p className="text-slate-500 text-sm mt-1">Ingresa el código de 6 letras que ves en la pantalla del profesor.</p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="Ej: ABC123"
              maxLength={6}
              className="w-full text-center text-3xl font-mono font-bold tracking-widest py-3 border-2 border-slate-300 rounded-xl focus:border-teal-500 focus:outline-none uppercase"
            />

            <button
              type="submit"
              disabled={inputCode.length < 4}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 text-base"
            >
              Unirme a la Sala
            </button>
          </form>
        </Card>
      )}

      {/* Pantalla de Espera (Conectado a la Sala) */}
      {status === 'waiting' && (
        <Card className="p-8 text-center space-y-6 bg-slate-900 text-white shadow-2xl border-slate-800">
          <div className="w-16 h-16 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center mx-auto border border-teal-500/30 animate-pulse">
            <Sparkles size={36} />
          </div>

          <div>
            <Badge className="bg-teal-500/20 text-teal-300 mb-2 border border-teal-500/30">
              Sala {activeCode}
            </Badge>
            <h2 className="text-2xl font-bold">¡Estás dentro!</h2>
            <p className="text-slate-400 text-sm mt-2">
              Mira la pantalla principal. El docente iniciará la partida en cualquier momento.
            </p>
          </div>
        </Card>
      )}

      {/* Pantalla de Juego en Celular / Dispositivo del Estudiante */}
      {status === 'playing' && question && (
        <Card className="p-6 bg-white border-2 border-slate-200 space-y-6 shadow-xl">
          <div className="flex items-center justify-between border-b pb-3">
            <Badge className="bg-orange-500 text-white font-bold">
              Pregunta {questionIndex + 1} de {totalQuestions}
            </Badge>
            <span className={`flex items-center gap-1 text-xs font-black ${secondsLeft <= 5 ? 'text-red-600' : 'text-slate-500'}`}><Clock size={14} />{secondsLeft}s</span>
          </div>

          <h3 className="text-xl font-bold text-slate-900 leading-snug">{question.enunciado}</h3>

          {question.imagen_url && <img src={question.imagen_url} alt="Apoyo visual de la pregunta" className="mx-auto max-h-56 rounded-2xl object-contain" />}

          <div className="grid grid-cols-1 gap-3">
            {question.opciones.map((opt, idx) => {
              const colors = [
                'bg-red-500 text-white',
                'bg-blue-500 text-white',
                'bg-amber-500 text-white',
                'bg-emerald-500 text-white',
              ]

              const isSelected = Array.isArray(selectedOption) ? selectedOption.includes(idx) : selectedOption === idx

              return (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(idx)}
                  disabled={secondsLeft <= 0 || (question.tipo !== 'multiple_choice' && selectedOption !== null)}
                  className={`p-4 rounded-xl font-bold text-left text-base shadow transition-all active:scale-95 flex items-center justify-between ${colors[idx % 4]} ${
                    isSelected ? 'ring-4 ring-slate-900 scale-[1.02]' : ''
                  }`}
                >
                  <span>{opt}</span>
                  {isSelected && <CheckCircle size={22} />}
                </button>
              )
            })}
          </div>

          {question.tipo === 'multiple_choice' && !answerAck && (
            <button type="button" onClick={submitMultipleAnswer} disabled={secondsLeft <= 0 || !selectedOption?.length} className="w-full rounded-xl bg-slate-900 px-4 py-3 font-extrabold text-white disabled:opacity-40">Confirmar {selectedOption?.length || ''} respuesta{selectedOption?.length === 1 ? '' : 's'}</button>
          )}

          {answerAck && (
            <div className={`p-4 rounded-xl font-bold text-center text-sm animate-fade-in ${
              answerAck.correct ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}>
              {answerAck.correct ? `¡Correcto! +${answerAck.pts_earned} pts` : 'Incorrecto'}
            </div>
          )}
          {questionResults && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-center animate-fade-in">
              <p className="text-xs font-black uppercase tracking-wider text-violet-600">Resultado de la ronda</p>
              <p className="mt-1 font-extrabold text-violet-950">Respuesta: {questionResults.correct_answer}</p>
              {questionResults.leaderboard?.length > 0 && <p className="mt-2 text-sm text-violet-800">Líder: {questionResults.leaderboard[0].nombre} · {questionResults.leaderboard[0].puntaje} pts</p>}
            </div>
          )}
        </Card>
      )}

      {/* Podio Final */}
      {status === 'finished' && (
        <Card className="p-8 text-center bg-gradient-to-b from-amber-50 to-white border-2 border-amber-200 space-y-6">
          <Sparkles className="mx-auto text-amber-500" size={56} />
          <h2 className="text-2xl font-bold text-slate-900">¡Partida Concluida!</h2>
          <p className="text-slate-600 text-sm">Revisa tu posición en el podio proyectado por el profesor.</p>
        </Card>
      )}
    </div>
  )
}
