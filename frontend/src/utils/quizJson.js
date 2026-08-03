/* Import/export del borrador del creador de quizzes.
 *
 * El JSON que se exporta es el mismo payload que come POST /api/quizzes, así
 * que sirve para tres cosas a la vez: respaldar un quiz, duplicarlo entre
 * docentes y pegar uno generado fuera de la app.
 *
 * `quizFromJson` es una frontera de confianza: recibe texto arbitrario que
 * alguien pegó. Valida en vez de confiar, y devuelve siempre la forma interna
 * completa que espera el editor, para que ningún campo llegue como undefined.
 */

const TIPOS_VALIDOS = new Set([
  'single_choice', 'multiple_choice', 'true_false', 'short_text',
  'flashcard', 'info', 'wordwall',
])
const TIPOS_CON_OPCIONES = new Set(['single_choice', 'multiple_choice'])
const TIPOS_PREGUNTA = new Set(['single_choice', 'multiple_choice', 'true_false', 'short_text'])

const AREAS_VALIDAS = new Set([
  'cuerpo_humano', 'pubertad', 'sistema_reproductor_femenino',
  'sistema_reproductor_masculino', 'celulas_reproductoras', 'fecundacion',
  'embarazo', 'nacimiento', 'autocuidado', 'preguntas_frecuentes',
])
const DIFICULTADES_VALIDAS = new Set(['basica', 'media', 'avanzada'])

function nuevoId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `quiz-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const texto = (valor) => (typeof valor === 'string' ? valor : valor == null ? '' : String(valor))

function numero(valor, porDefecto) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : porDefecto
}

function booleano(valor, porDefecto) {
  return typeof valor === 'boolean' ? valor : porDefecto
}

/** Estado interno -> objeto exportable (misma forma que el POST del quiz). */
export function quizToJson(form, items) {
  return {
    version: 1,
    titulo: texto(form.titulo),
    descripcion: texto(form.descripcion),
    instrucciones: texto(form.instrucciones),
    area: form.area,
    dificultad: form.dificultad,
    intentos_maximos: Number(form.intentos_maximos),
    // categoria_id se omite a propósito: los ids de unidad son locales a cada
    // instalación, y al importar en otra el número apuntaría a otra unidad.
    config: { ...form.config },
    items: items.map((item, i) => ({
      orden: i + 1,
      tipo: item.tipo,
      enunciado: texto(item.enunciado),
      contenido: texto(item.contenido),
      explicacion: texto(item.explicacion),
      puntos: Number(item.puntos),
      tiempo_segundos: Number(item.tiempo_segundos),
      config: { ...(item.config || {}) },
      media: (item.media || []).map(limpiarMedia),
      opciones: (item.opciones || []).map((op) => ({
        texto: texto(op.texto),
        correcta: Boolean(op.correcta),
        feedback: texto(op.feedback),
        media: (op.media || []).map(limpiarMedia),
      })),
      respuesta_correcta: texto(item.respuesta_correcta),
    })),
  }
}

/** Descarta lo que solo vive en el navegador (File, blob: URL, previews). */
function limpiarMedia(asset) {
  return {
    tipo: texto(asset?.tipo) || 'image',
    url: texto(asset?.url),
    nombre_archivo: texto(asset?.nombre_archivo),
    texto_alternativo: texto(asset?.texto_alternativo),
  }
}

function mediaImportada(asset) {
  return {
    id: nuevoId(),
    tipo: texto(asset?.tipo) || 'image',
    url: texto(asset?.url),
    nombre_archivo: texto(asset?.nombre_archivo),
    texto_alternativo: texto(asset?.texto_alternativo),
    file: null,
    preview: texto(asset?.url),
  }
}

/**
 * Texto JSON -> { form, items } listos para el editor.
 * Lanza Error con un mensaje que se le pueda mostrar al docente.
 */
export function quizFromJson(entrada) {
  let crudo
  if (typeof entrada === 'string') {
    try {
      crudo = JSON.parse(entrada)
    } catch {
      throw new Error('El texto no es JSON válido. Revisa que no falte una coma o una llave.')
    }
  } else {
    crudo = entrada
  }

  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) {
    throw new Error('El JSON debe ser un objeto con los datos del quiz.')
  }
  if (!Array.isArray(crudo.items)) {
    throw new Error('Falta la lista "items" con los bloques del quiz.')
  }
  if (crudo.items.length === 0) {
    throw new Error('El quiz importado no tiene ningún bloque.')
  }

  const items = crudo.items.map((item, i) => importarItem(item, i))

  const configCruda = (crudo.config && typeof crudo.config === 'object') ? crudo.config : {}
  const form = {
    titulo: texto(crudo.titulo),
    descripcion: texto(crudo.descripcion),
    instrucciones: texto(crudo.instrucciones),
    area: AREAS_VALIDAS.has(crudo.area) ? crudo.area : 'cuerpo_humano',
    // La unidad se vuelve a elegir a mano: su id no es portable entre instalaciones.
    categoria_id: '',
    dificultad: DIFICULTADES_VALIDAS.has(crudo.dificultad) ? crudo.dificultad : 'basica',
    intentos_maximos: Math.min(20, Math.max(1, Math.round(numero(crudo.intentos_maximos, 2)))),
    config: {
      ...configCruda,
      barajar_preguntas: booleano(configCruda.barajar_preguntas, false),
      barajar_opciones: booleano(configCruda.barajar_opciones, false),
      mostrar_feedback: booleano(configCruda.mostrar_feedback, true),
      mostrar_progreso: booleano(configCruda.mostrar_progreso, true),
      tiempo_global_segundos: Math.max(0, Math.round(numero(configCruda.tiempo_global_segundos, 0))),
      aprobado_porcentaje: Math.min(100, Math.max(0, numero(configCruda.aprobado_porcentaje, 60))),
      tema: texto(configCruda.tema) || 'turquesa',
      sonido: booleano(configCruda.sonido, true),
      celebracion: booleano(configCruda.celebracion, true),
    },
  }

  return { form, items }
}

function importarItem(crudo, indice) {
  const donde = `Bloque ${indice + 1}`
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) {
    throw new Error(`${donde}: cada bloque debe ser un objeto.`)
  }

  const config = (crudo.config && typeof crudo.config === 'object') ? { ...crudo.config } : {}

  // Wordwall no tiene tipo propio en el motor: viaja como 'info' con la URL en
  // config. Al importar hay que deshacer eso para que el editor muestre su
  // formulario, igual que serializeItem lo rehace al guardar.
  let tipo = texto(crudo.tipo) || 'single_choice'
  if (tipo === 'info' && (config.embed_url || config.wordwall_url)) tipo = 'wordwall'

  if (!TIPOS_VALIDOS.has(tipo)) {
    throw new Error(`${donde}: tipo de bloque desconocido "${tipo}".`)
  }

  const opcionesCrudas = Array.isArray(crudo.opciones) ? crudo.opciones : []
  const opciones = TIPOS_CON_OPCIONES.has(tipo)
    ? opcionesCrudas.map((op) => ({
      id: nuevoId(),
      texto: texto(op?.texto),
      correcta: Boolean(op?.correcta),
      feedback: texto(op?.feedback ?? op?.retroalimentacion),
      media: (Array.isArray(op?.media) ? op.media : []).map(mediaImportada),
    }))
    : []

  // El reverso de una ficha vive en `contenido` para el editor, pero la API lo
  // devuelve también en `respuesta_correcta`. Se acepta cualquiera de los dos.
  const contenido = tipo === 'flashcard'
    ? (texto(crudo.contenido) || texto(crudo.respuesta_correcta))
    : texto(crudo.contenido)

  return {
    id: nuevoId(),
    tipo,
    enunciado: texto(crudo.enunciado),
    contenido,
    opciones,
    respuesta_correcta: normalizarRespuesta(tipo, crudo, opcionesCrudas),
    explicacion: texto(crudo.explicacion),
    puntos: Math.max(0, numero(crudo.puntos, TIPOS_PREGUNTA.has(tipo) ? 1 : 0)),
    tiempo_segundos: Math.max(0, Math.round(numero(crudo.tiempo_segundos, TIPOS_PREGUNTA.has(tipo) ? 30 : 0))),
    media: (Array.isArray(crudo.media) ? crudo.media : []).map(mediaImportada),
    config,
  }
}

/* En los tipos con opciones la respuesta vive en `opciones[].correcta`, no en
   este campo: el editor lo ignora ahí. Solo importa para true_false,
   short_text y el reverso de una ficha. */
function normalizarRespuesta(tipo, crudo, opcionesCrudas) {
  if (TIPOS_CON_OPCIONES.has(tipo)) return ''

  if (tipo === 'true_false') {
    const valor = crudo.respuesta_correcta
    if (valor === true || valor === 'true') return 'true'
    if (valor === false || valor === 'false') return 'false'
    // Puede venir como el texto de la opción marcada.
    const marcada = opcionesCrudas.find((op) => op?.correcta)
    if (marcada) return /^(verdadero|true|s[ií])$/i.test(texto(marcada.texto).trim()) ? 'true' : 'false'
    return ''
  }

  if (tipo === 'short_text') {
    // El motor acepta una lista de respuestas válidas; el editor todavía
    // maneja una sola, así que se toma la primera y no se pierde el resto
    // porque `config` viaja intacto.
    const valor = crudo.respuesta_correcta
    return Array.isArray(valor) ? texto(valor[0]) : texto(valor)
  }

  // En una ficha el reverso se guarda en `contenido`, no aquí.
  return ''
}
