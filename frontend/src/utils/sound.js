/**
 * Sonidos de retroalimentación del quiz.
 *
 * Se sintetizan con la Web Audio API en vez de cargar archivos: no añade
 * peso al bundle, funciona sin conexión y evita meter binarios al repo.
 *
 * Reglas:
 *  - Nunca lanza. Si el navegador bloquea el audio, el quiz sigue igual.
 *  - Respeta el silencio guardado por la persona y "reducir movimiento"
 *    del sistema (quien pide menos estímulo tampoco quiere pitidos).
 */

const STORAGE_MUTE = 'ar-sonido'

let contexto = null
let silenciado = leerSilenciado()

function leerSilenciado() {
  try {
    return localStorage.getItem(STORAGE_MUTE) === 'off'
  } catch {
    return false
  }
}

function prefiereMenosMovimiento() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch {
    return false
  }
}

function obtenerContexto() {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!contexto) {
    try { contexto = new AudioCtx() } catch { return null }
  }
  // Los navegadores suspenden el contexto hasta que hay un gesto del usuario.
  if (contexto.state === 'suspended') contexto.resume().catch(() => {})
  return contexto
}

export function estaSilenciado() {
  return silenciado
}

export function setSilenciado(valor) {
  silenciado = Boolean(valor)
  try { localStorage.setItem(STORAGE_MUTE, silenciado ? 'off' : 'on') } catch { /* modo privado */ }
}

export function alternarSilencio() {
  setSilenciado(!silenciado)
  return silenciado
}

/** Llamar tras un gesto del usuario (p. ej. "Comenzar") para desbloquear el audio. */
export function desbloquearAudio() {
  obtenerContexto()
}

/**
 * Reproduce una nota simple.
 * @param {number} frecuencia  Hz
 * @param {number} inicio      segundos de retraso desde ahora
 * @param {number} duracion    segundos
 * @param {object} opciones    { tipo, volumen }
 */
function nota(ctx, frecuencia, inicio, duracion, { tipo = 'sine', volumen = 0.16 } = {}) {
  const t0 = ctx.currentTime + inicio
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = tipo
  osc.frequency.setValueAtTime(frecuencia, t0)
  // Envolvente suave: sin ataque/caída se oye un "clic" desagradable.
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(volumen, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duracion + 0.02)
}

function reproducir(secuencia) {
  if (silenciado || prefiereMenosMovimiento()) return
  const ctx = obtenerContexto()
  if (!ctx) return
  try {
    secuencia(ctx)
  } catch {
    /* Audio no disponible: el quiz funciona igual sin sonido. */
  }
}

/** Acierto: arpegio ascendente breve y alegre. */
export function sonidoAcierto() {
  reproducir(ctx => {
    nota(ctx, 587.33, 0.00, 0.12, { volumen: 0.14 })  // Re5
    nota(ctx, 739.99, 0.09, 0.12, { volumen: 0.14 })  // Fa#5
    nota(ctx, 987.77, 0.18, 0.22, { volumen: 0.16 })  // Si5
  })
}

/** Error: dos notas graves descendentes; corrige sin castigar. */
export function sonidoError() {
  reproducir(ctx => {
    nota(ctx, 311.13, 0.00, 0.16, { tipo: 'triangle', volumen: 0.13 })
    nota(ctx, 233.08, 0.13, 0.26, { tipo: 'triangle', volumen: 0.12 })
  })
}

/** Avance de bloque sin calificación. */
export function sonidoAvance() {
  reproducir(ctx => nota(ctx, 660, 0, 0.09, { tipo: 'sine', volumen: 0.09 }))
}

/** Tic del cronómetro cuando queda poco tiempo. */
export function sonidoTic() {
  reproducir(ctx => nota(ctx, 880, 0, 0.05, { tipo: 'square', volumen: 0.05 }))
}

/** Fin del quiz aprobado: pequeña fanfarria. */
export function sonidoCelebracion() {
  reproducir(ctx => {
    const escala = [523.25, 659.25, 783.99, 1046.5] // Do5 Mi5 Sol5 Do6
    escala.forEach((hz, i) => nota(ctx, hz, i * 0.11, 0.3, { volumen: 0.15 }))
    nota(ctx, 1318.5, 0.46, 0.5, { volumen: 0.13 })
  })
}

/** Fin del quiz sin aprobar: cierre neutro, ni premio ni castigo. */
export function sonidoFin() {
  reproducir(ctx => {
    nota(ctx, 523.25, 0.00, 0.18, { tipo: 'sine', volumen: 0.12 })
    nota(ctx, 440.00, 0.15, 0.30, { tipo: 'sine', volumen: 0.11 })
  })
}
