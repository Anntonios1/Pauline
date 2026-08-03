import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'

const WebSocketContext = createContext(null)

export function WebSocketProvider({ children }) {
  const [socket, setSocket] = useState(null)
  const [roomState, setRoomState] = useState({
    status: 'disconnected', // disconnected | connecting | waiting | playing | finished
    roomCode: null,
    isDocente: false,
    players: [],
    question: null,
    questionIndex: 0,
    totalQuestions: 0,
    answerAck: null,
    questionResults: null,
    leaderboard: [],
    gameMode: 'quiz_race',
    error: null,
  })

  const wsRef = useRef(null)

  const connectToRoom = useCallback((roomCode, token, nombre) => {
    if (wsRef.current) {
      wsRef.current.close()
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname === 'localhost' ? '127.0.0.1:8000' : `${window.location.hostname}:8000`
    const wsUrl = `${protocol}//${host}/ws/room/${roomCode}`

    setRoomState(prev => ({ ...prev, status: 'connecting', roomCode, error: null }))

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      // Send join payload with token
      ws.send(JSON.stringify({ event: 'join', token, nombre }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        const { event: evtType, data } = msg

        switch (evtType) {
          case 'room_state':
            setRoomState(prev => ({
              ...prev,
              status: data.status === 'playing' ? 'playing' : 'waiting',
              isDocente: data.es_docente,
              players: data.players || [],
              totalQuestions: data.total_questions || 0,
              gameMode: data.mode || 'quiz_race',
              question: data.question || prev.question,
              questionIndex: data.index ?? prev.questionIndex,
            }))
            break

          case 'player_joined':
            setRoomState(prev => ({
              ...prev,
              players: prev.players.filter(p => p.nombre !== data.nombre).concat(data.nombre ? [{ nombre: data.nombre, puntaje: 0 }] : []),
            }))
            break

          case 'player_left':
            setRoomState(prev => ({ ...prev, players: prev.players.filter(p => p.nombre !== data.nombre) }))
            break

          case 'game_start':
            setRoomState(prev => ({
              ...prev,
              status: 'playing',
              question: data.question,
              questionIndex: data.index,
              totalQuestions: data.total,
              answerAck: null,
              questionResults: null,
            }))
            break

          case 'answer_ack':
            setRoomState(prev => ({
              ...prev,
              answerAck: data,
            }))
            break

          case 'question_results':
            setRoomState(prev => ({
              ...prev,
              questionResults: data,
              leaderboard: data.leaderboard || prev.leaderboard,
            }))
            break

          case 'question':
            setRoomState(prev => ({
              ...prev,
              question: data.question,
              questionIndex: data.index,
              totalQuestions: data.total,
              answerAck: null,
              questionResults: null,
            }))
            break

          case 'game_over':
            setRoomState(prev => ({
              ...prev,
              status: 'finished',
              leaderboard: data.leaderboard || [],
            }))
            break

          case 'error':
            setRoomState(prev => ({ ...prev, error: data.message }))
            break

          default:
            break
        }
      } catch (err) {
        console.error('Error parsing WS message', err)
      }
    }

    ws.onerror = () => {
      setRoomState(prev => ({ ...prev, status: 'disconnected', error: 'Error de conexión a la sala' }))
    }

    ws.onclose = () => {
      setRoomState(prev => ({ ...prev, status: 'disconnected' }))
    }

    setSocket(ws)
  }, [])

  const sendAnswer = useCallback((questionIdx, option, timeMs) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'answer', question_idx: questionIdx, option, time_ms: timeMs }))
    }
  }, [])

  const startGame = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'start' }))
    }
  }, [])

  const nextQuestion = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'next' }))
    }
  }, [])

  const leaveRoom = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setRoomState({
      status: 'disconnected',
      roomCode: null,
      isDocente: false,
      players: [],
      question: null,
      questionIndex: 0,
      totalQuestions: 0,
      answerAck: null,
      questionResults: null,
      leaderboard: [],
      gameMode: 'quiz_race',
      error: null,
    })
  }, [])

  return (
    <WebSocketContext.Provider
      value={{
        ...roomState,
        connectToRoom,
        sendAnswer,
        startGame,
        nextQuestion,
        leaveRoom,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  )
}

export function useGameRoom() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useGameRoom debe ser usado dentro de un WebSocketProvider')
  }
  return context
}
