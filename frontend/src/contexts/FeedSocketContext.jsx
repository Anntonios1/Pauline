/* Escucha /ws/feed y refresca los datos cuando algo cambia en otro dispositivo.
 *
 * El socket solo trae avisos ("la publicacion 12 cambio"), nunca contenido: al
 * recibir uno se recarga por REST con el token propio, asi los permisos se
 * siguen resolviendo en el backend y no hay forma de que llegue por aqui un
 * borrador ajeno. Ver api/websocket/feed_manager.py.
 *
 * Es un canal aparte del de las salas de juego (WebSocketContext.jsx): aquel
 * tiene estado de partida, este no tiene estado ninguno.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useData } from './DataContext'

const FeedSocketContext = createContext(null)

/* Sin WebSocket (proxy del colegio, red rara) se recae en recargar cada tanto,
   pero solo entonces: con el socket vivo no hay ni una peticion de sobra. */
const RESPALDO_MS = 30000
const REINTENTO_BASE_MS = 1000
const REINTENTO_MAX_MS = 30000

export function FeedSocketProvider({ children }) {
  const { refreshPublications } = useData()
  const [conectado, setConectado] = useState(false)
  const wsRef = useRef(null)
  const reintentoRef = useRef(REINTENTO_BASE_MS)
  const temporizadorRef = useRef(null)
  // El efecto no debe reengancharse cada vez que cambie la función de refresco.
  const refrescarRef = useRef(refreshPublications)
  useEffect(() => { refrescarRef.current = refreshPublications }, [refreshPublications])

  const conectar = useCallback(() => {
    const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname === 'localhost'
      ? '127.0.0.1:8000'
      : `${window.location.hostname}:8000`
    const ws = new WebSocket(`${protocolo}//${host}/ws/feed`)
    wsRef.current = ws

    // Cerrar un socket no cancela sus eventos: los tardios de uno ya
    // reemplazado no deben tocar el estado del vigente (misma razon que en
    // WebSocketContext.jsx).
    const esVigente = () => wsRef.current === ws

    ws.onopen = () => {
      if (!esVigente()) return
      reintentoRef.current = REINTENTO_BASE_MS
      setConectado(true)
      // Al (re)conectar puede haberse perdido algo mientras no habia socket.
      refrescarRef.current?.()
    }

    ws.onmessage = (evento) => {
      if (!esVigente()) return
      try {
        const { event: tipo } = JSON.parse(evento.data)
        // Todos los avisos actuales significan lo mismo para el feed: algo de
        // una publicacion cambio. Se recarga y que el backend decida que se ve.
        if (['publicacion_aprobada', 'publicacion_actualizada', 'comentario_nuevo', 'reaccion'].includes(tipo)) {
          refrescarRef.current?.()
        }
      } catch {
        // Un mensaje ilegible no justifica tirar la conexion.
      }
    }

    ws.onclose = () => {
      if (!esVigente()) return
      setConectado(false)
      // Backoff: si el backend esta caido no tiene sentido insistir cada segundo.
      temporizadorRef.current = window.setTimeout(conectar, reintentoRef.current)
      reintentoRef.current = Math.min(reintentoRef.current * 2, REINTENTO_MAX_MS)
    }

    // onerror siempre viene seguido de onclose: reconectar solo en uno de los
    // dos evita dos temporizadores en marcha.
    ws.onerror = () => {}
  }, [])

  useEffect(() => {
    conectar()
    return () => {
      window.clearTimeout(temporizadorRef.current)
      const ws = wsRef.current
      wsRef.current = null   // invalida los handlers en vuelo antes de cerrar
      ws?.close()
    }
  }, [conectar])

  // Respaldo mientras el socket este caido y la pestana visible. Con el socket
  // conectado esto no corre: los avisos ya llegan solos.
  useEffect(() => {
    if (conectado) return undefined
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === 'visible') refrescarRef.current?.()
    }, RESPALDO_MS)
    return () => window.clearInterval(intervalo)
  }, [conectado])

  // Volver a la pestana tras un rato: ponerse al dia sin esperar al siguiente aviso.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') refrescarRef.current?.()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [])

  return (
    <FeedSocketContext.Provider value={{ conectado }}>
      {children}
    </FeedSocketContext.Provider>
  )
}

export function useFeedSocket() {
  return useContext(FeedSocketContext) || { conectado: false }
}
