import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useGameRoom } from '../../contexts/WebSocketContext'
import { PageHeader, Card, Badge } from '../../components/ui'
import { QrCode, Play, Users, Sparkles, CheckCircle2, ArrowRight, ShieldAlert } from 'lucide-react'

export default function GameRoomPage() {
  const { code } = useParams()
  const { user, token, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const {
    connectToRoom,
    leaveRoom,
    status,
    players,
    isDocente,
    startGame,
    nextQuestion,
    question,
    questionIndex,
    totalQuestions,
    questionResults,
    leaderboard,
    gameMode,
    error,
  } = useGameRoom()

  const [qrBase64, setQrBase64] = useState(null)
  const [joinUrl, setJoinUrl] = useState('')
  const [qrError, setQrError] = useState('')

  useEffect(() => {
    // `user` pasa de null al objeto real justo después de montar (AuthContext
    // lo restaura en su propio efecto). Esperar a `authLoading === false`
    // evita conectar una vez con el nombre de respaldo y tener que reconectar
    // enseguida con el real — un solo intento, ya con los datos correctos.
    if (!code || !token || authLoading) return
    connectToRoom(code, token, user?.nombre_visible || 'Docente')

    // Fetch QR desde API
    fetch(`/api/rooms/${code}/qr`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.join_url) setJoinUrl(data.join_url)
        if (data.qr_base64) {
          setQrBase64(data.qr_base64)
        } else {
          setQrError(data.error || 'No se pudo generar el código QR.')
        }
      })
      .catch(() => setQrError('No se pudo cargar el código QR.'))

    return () => leaveRoom()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- user se lee una sola vez al conectar, no debe disparar reconexión
  }, [code, token, authLoading, connectToRoom, leaveRoom])

  const isPlaying = status === 'playing'
  const isFinished = status === 'finished'

  return (
    <div className="animate-fade-in space-y-6 max-w-5xl mx-auto">
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Juego interactivo · {gameMode === 'speed' ? 'Velocidad extrema' : gameMode === 'classic' ? 'Clásico' : 'Carrera en vivo'}
            </Badge>
            <span className="text-xs text-slate-400">Código de Sala:</span>
            <span className="font-mono text-lg font-bold text-amber-400 tracking-wider">{code}</span>
          </div>
          <h1 className="text-2xl font-bold">Sala de Juego Multijugador</h1>
        </div>

        {isDocente && status === 'waiting' && (
          <button
            onClick={startGame}
            disabled={players.length === 0}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all text-base"
          >
            <Play size={20} /> Iniciar Partida ({players.length} unidos)
          </button>
        )}

        {isDocente && isPlaying && (
          <button
            onClick={nextQuestion}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all text-base"
          >
            {questionResults ? (questionIndex + 1 >= totalQuestions ? 'Finalizar partida' : 'Siguiente pregunta') : 'Mostrar resultados'} <ArrowRight size={20} />
          </button>
        )}
      </div>

      {error && (
        <Card className="p-4 bg-rose-500/10 border-rose-500/30 text-rose-800 font-medium flex items-center gap-3">
          <ShieldAlert size={20} /> {error}
        </Card>
      )}

      {/* Vista de Espera / Lobby de Jugadores con QR */}
      {status === 'waiting' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tarjeta del Código QR */}
          <Card className="p-8 text-center bg-white border-2 border-slate-200 space-y-4 shadow-md flex flex-col items-center justify-center">
            <h3 className="font-bold text-slate-900 text-xl">¡Escanea para Unirte!</h3>
            <p className="text-slate-500 text-sm">Los estudiantes pueden apuntar con la cámara del celular:</p>

            {qrBase64 ? (
              <div className="p-4 bg-white rounded-2xl border shadow-inner inline-block">
                <img
                  src={`data:image/png;base64,${qrBase64}`}
                  alt={`QR Sala ${code}`}
                  className="w-56 h-56 mx-auto"
                />
              </div>
            ) : qrError ? (
              <div className="w-56 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left space-y-2">
                <p className="text-xs font-bold text-amber-800 flex items-center gap-1">
                  <ShieldAlert size={14} /> QR no disponible
                </p>
                <p className="text-xs text-amber-700">{qrError}</p>
                <p className="text-xs text-slate-600">
                  Los estudiantes pueden unirse escribiendo esta dirección en su navegador:
                </p>
              </div>
            ) : (
              <div className="w-56 h-56 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                Cargando QR...
              </div>
            )}

            <div className={`px-4 py-2 rounded-xl font-mono select-all ${qrError && !qrBase64 ? 'bg-teal-600 text-white text-sm font-bold' : 'bg-slate-100 text-xs text-slate-700'}`}>
              {joinUrl || `${window.location.origin}/sala/${code}`}
            </div>
          </Card>

          {/* Lista de Estudiantes Conectados */}
          <Card className="p-6 bg-white border-2 border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Users className="text-teal-600" size={22} />
                <h3 className="font-bold text-slate-900 text-lg">Estudiantes en Sala</h3>
              </div>
              <Badge className="bg-teal-100 text-teal-800 font-bold">{players.length} Conectados</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
              {players.map((p, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3 animate-fade-in">
                  <div className="w-8 h-8 rounded-full bg-teal-500 text-white font-bold flex items-center justify-center text-xs">
                    {p.nombre.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-slate-800 text-sm truncate">{p.nombre}</span>
                </div>
              ))}

              {players.length === 0 && (
                <p className="col-span-2 text-center text-slate-400 text-sm py-8">
                  Esperando a que los estudiantes escaneen el QR...
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Vista durante el Juego Activo */}
      {isPlaying && question && (
        <Card className="p-8 bg-white border-2 border-slate-200 space-y-6 shadow-lg">
          <div className="flex items-center justify-between border-b pb-4">
            <Badge className="bg-orange-500 text-white font-bold">
              Pregunta {questionIndex + 1} de {totalQuestions}
            </Badge>
            <span className="text-sm font-bold text-slate-500">{question.tipo}</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 leading-snug">{question.enunciado}</h2>

          {question.imagen_url && <img src={question.imagen_url} alt="Apoyo visual de la pregunta" className="mx-auto max-h-72 rounded-2xl object-contain" />}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {question.opciones.map((opt, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-slate-100 font-bold text-slate-800 text-lg border-2 border-slate-200 shadow-sm">
                {opt}
              </div>
            ))}
          </div>

          {questionResults && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 animate-fade-in">
              <span className="font-bold text-emerald-900 text-sm block">Respuesta Correcta: {questionResults.correct_answer}</span>
              {questionResults.explicacion && (
                <p className="text-emerald-700 text-sm">{questionResults.explicacion}</p>
              )}
              {questionResults.distribution?.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2">{questionResults.distribution.map((count, index) => <div key={index} className="rounded-lg bg-white p-2 text-xs font-bold text-slate-700">Opción {index + 1}: {count} respuesta{count === 1 ? '' : 's'}</div>)}</div>}
              {questionResults.leaderboard?.length > 0 && <div className="mt-3 border-t border-emerald-200 pt-3"><p className="mb-2 text-xs font-black uppercase text-emerald-900">Clasificación en vivo</p>{questionResults.leaderboard.slice(0, 5).map((item, index) => <div key={item.usuario_id || item.nombre} className="flex justify-between text-sm"><span>#{index + 1} {item.nombre}</span><b>{item.puntaje} pts</b></div>)}</div>}
            </div>
          )}
        </Card>
      )}

      {/* Podio / Finalización */}
      {isFinished && (
        <Card className="p-8 text-center bg-gradient-to-b from-amber-50 to-white border-2 border-amber-200 space-y-6">
          <Sparkles className="mx-auto text-amber-500" size={56} />
          <h2 className="text-3xl font-bold text-slate-900">¡Partida Finalizada!</h2>

          <div className="max-w-md mx-auto space-y-3 text-left">
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider text-center">Podio de Posiciones</h3>
            {leaderboard.map((item, idx) => (
              <div key={idx} className={`p-4 rounded-xl flex items-center justify-between font-bold ${
                idx === 0 ? 'bg-amber-100 text-amber-900 border-2 border-amber-400' : 'bg-slate-50 text-slate-800 border'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                    #{idx + 1}
                  </span>
                  <span>{item.nombre}</span>
                </div>
                <span className="text-teal-600">{item.puntaje} pts</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
