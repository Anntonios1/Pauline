import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  ExternalLink,
  FileText,
  Gamepad2,
  Headphones,
  Info,
  RotateCw,
  Send,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react'
import {
  alternarSilencio,
  desbloquearAudio,
  estaSilenciado,
  sonidoAcierto,
  sonidoCelebracion,
  sonidoError,
  sonidoFin,
} from '../../utils/sound'

/** Acentos disponibles para personalizar un quiz (coinciden con [data-accent] del CSS). */
export const TEMAS_QUIZ = ['turquesa', 'violeta', 'azul', 'coral', 'ambar', 'esmeralda']

const TYPE_ALIASES = {
  single_choice: 'single_choice',
  opcion_multiple: 'single_choice',
  opción_multiple: 'single_choice',
  quiz: 'single_choice',
  radio: 'single_choice',
  single: 'single_choice',
  multiple_choice: 'multiple_choice',
  seleccion_multiple: 'multiple_choice',
  selección_multiple: 'multiple_choice',
  checkbox: 'multiple_choice',
  multiple: 'multiple_choice',
  true_false: 'true_false',
  verdadero_falso: 'true_false',
  boolean: 'true_false',
  short_text: 'short_text',
  respuesta_corta: 'short_text',
  text: 'short_text',
  texto: 'short_text',
  flashcard: 'flashcard',
  ficha: 'flashcard',
  tarjeta: 'flashcard',
  info: 'info',
  content: 'info',
  contenido: 'info',
}

const QUESTION_TYPES = new Set(['single_choice', 'multiple_choice', 'true_false', 'short_text'])

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null)
}

function parseJson(value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed || (!trimmed.startsWith('[') && !trimmed.startsWith('{'))) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function parseObject(value) {
  const parsed = parseJson(value)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLocaleLowerCase('es')
  if (['true', 'verdadero', 'v', 'si', 'sí', '1'].includes(normalized)) return true
  if (['false', 'falso', 'f', 'no', '0'].includes(normalized)) return false
  return null
}

function configBoolean(config, keys, fallback) {
  for (const key of keys) {
    if (config[key] !== undefined && config[key] !== null) {
      const parsed = parseBoolean(config[key])
      return parsed === null ? fallback : parsed
    }
  }
  return fallback
}

function shuffled(values) {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const current = copy[index]
    copy[index] = copy[randomIndex]
    copy[randomIndex] = current
  }
  return copy
}

function shuffleQuestionSlots(items) {
  const questions = shuffled(items.filter(item => QUESTION_TYPES.has(item.type)))
  let questionIndex = 0
  return items.map(item => {
    if (!QUESTION_TYPES.has(item.type)) return item
    const shuffledQuestion = questions[questionIndex]
    questionIndex += 1
    return shuffledQuestion
  })
}

function normalizeComparable(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function hasMeaningfulValue(value) {
  if (value === false || value === 0) return true
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function inferMediaKind(value, explicitKind = '') {
  const kind = String(explicitKind).toLocaleLowerCase('es')
  if (kind.includes('audio')) return 'audio'
  if (kind.includes('video')) return 'video'
  if (kind.includes('image') || kind.includes('imagen')) return 'image'
  if (kind.includes('file') || kind.includes('archivo') || kind.includes('document') || kind.includes('pdf') || kind.includes('application/')) return 'file'
  const url = String(value || '').split('?')[0].toLocaleLowerCase('es')
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(url)) return 'audio'
  if (/\.(mp4|webm|mov|m4v)$/.test(url)) return 'video'
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|txt|csv|zip|rar|7z)$/.test(url)) return 'file'
  return 'image'
}

function normalizeMedia(...sources) {
  const media = []

  const visit = (source, forcedKind = '') => {
    if (!source) return
    const parsed = parseJson(source)

    if (Array.isArray(parsed)) {
      parsed.forEach(entry => visit(entry, forcedKind))
      return
    }

    if (typeof parsed === 'string') {
      media.push({
        kind: inferMediaKind(parsed, forcedKind),
        url: parsed,
        alt: '',
        title: '',
      })
      return
    }

    if (typeof parsed !== 'object') return

    const url = firstDefined(
      parsed.url,
      parsed.src,
      parsed.path,
      parsed.file_url,
      parsed.archivo_url,
      parsed.download_url,
    )
    if (url) {
      media.push({
        kind: inferMediaKind(url, firstDefined(parsed.kind, parsed.type, parsed.tipo, parsed.mime_type, parsed.mimeType, forcedKind)),
        url,
        alt: firstDefined(parsed.alt, parsed.alt_text, parsed.texto_alternativo, ''),
        title: firstDefined(
          parsed.title,
          parsed.titulo,
          parsed.filename,
          parsed.file_name,
          parsed.nombre_archivo,
          parsed.name,
          parsed.nombre,
          '',
        ),
      })
    }

    if (parsed.image_url) visit(parsed.image_url, 'image')
    if (parsed.imagen_url) visit(parsed.imagen_url, 'image')
    if (parsed.audio_url) visit(parsed.audio_url, 'audio')
    if (parsed.image) visit(parsed.image, 'image')
    if (parsed.imagen) visit(parsed.imagen, 'image')
    if (parsed.audio) visit(parsed.audio, 'audio')
    if (parsed.images) visit(parsed.images, 'image')
    if (parsed.imagenes) visit(parsed.imagenes, 'image')
    if (parsed.audios) visit(parsed.audios, 'audio')
  }

  sources.forEach(source => visit(source))

  return media.filter((entry, index, all) => (
    entry.url && all.findIndex(other => other.kind === entry.kind && other.url === entry.url) === index
  ))
}

function normalizeChoices(rawChoices, itemKey) {
  const parsed = parseJson(rawChoices)
  const choices = Array.isArray(parsed) ? parsed : []

  return choices.map((rawChoice, index) => {
    const choice = rawChoice && typeof rawChoice === 'object'
      ? rawChoice
      : { text: String(rawChoice ?? '') }
    const text = String(firstDefined(choice.texto, choice.text, choice.label, choice.nombre, choice.value, choice.id, ''))
    const id = firstDefined(choice.id, choice.choice_id, choice.opcion_id, index)
    const value = firstDefined(choice.value, choice.valor, choice.id, text)
    const correctness = firstDefined(choice.correcta, choice.is_correct, choice.correct)

    return {
      key: `${itemKey}-choice-${String(id)}-${index}`,
      id,
      value,
      text,
      isCorrect: correctness === undefined || correctness === null ? null : parseBoolean(correctness),
      media: normalizeMedia(choice.media, choice.medios, {
        imagen_url: choice.imagen_url,
        image_url: choice.image_url,
        audio_url: choice.audio_url,
      }),
      identities: [id, value, text].map(normalizeComparable).filter(Boolean),
    }
  })
}

function normalizeType(value) {
  const raw = String(value || 'info').trim().toLocaleLowerCase('es').replace(/[\s-]+/g, '_')
  return TYPE_ALIASES[raw] || 'unsupported'
}

function normalizeCorrectAnswer(raw) {
  const parsed = parseJson(raw)
  return Array.isArray(parsed) ? parsed : parsed
}

function normalizeItem(rawItem, index, defaultTimer, shuffleOptions = false) {
  const raw = rawItem && typeof rawItem === 'object' ? rawItem : { contenido: String(rawItem ?? '') }
  const originalType = firstDefined(raw.type, raw.tipo, raw.item_type, raw.kind, 'info')
  const type = normalizeType(originalType)
  const itemConfig = parseObject(firstDefined(raw.config, raw.configuracion, {}))
  const id = firstDefined(raw.id, raw.item_id, raw.pregunta_id, `item-${index + 1}`)
  const key = `${String(id)}-${index}`
  const normalizedChoices = normalizeChoices(firstDefined(raw.choices, raw.options, raw.opciones, []), key)
  const choices = shuffleOptions ? shuffled(normalizedChoices) : normalizedChoices
  const acceptedAnswers = firstDefined(
    raw.accepted_answers,
    raw.respuestas_aceptadas,
    raw.correct_answers,
    raw.respuestas_correctas,
  )
  const correctAnswer = normalizeCorrectAnswer(firstDefined(
    acceptedAnswers,
    raw.correct_answer,
    raw.correctAnswer,
    raw.respuesta_correcta,
    raw.answer,
    raw.respuesta,
  ))
  const rawPoints = Number(firstDefined(raw.points, raw.puntos, raw.puntaje, raw.score, 1))
  const rawTimer = Number(firstDefined(
    raw.time_limit_seconds,
    raw.tiempo_limite_segundos,
    raw.time_limit,
    raw.tiempo_limite,
    raw.tiempo_segundos,
    defaultTimer,
    0,
  ))

  return {
    id,
    key,
    index,
    originalType: String(originalType),
    type,
    prompt: String(type === 'info'
      ? ([raw.title, raw.titulo, raw.enunciado, itemConfig.title].find(hasMeaningfulValue) ?? '')
      : firstDefined(
        raw.prompt,
        raw.enunciado,
        raw.question,
        raw.pregunta,
        raw.front,
        raw.anverso,
        raw.title,
        raw.titulo,
        raw.texto,
        '',
      )),
    content: String(firstDefined(raw.content, raw.contenido, raw.body, raw.cuerpo, raw.descripcion, '')),
    back: String(firstDefined(
      raw.back,
      raw.reverso,
      raw.flashcard_back,
      raw.respuesta,
      raw.respuesta_correcta,
      raw.explicacion,
      '',
    )),
    explanation: String(firstDefined(raw.feedback, raw.retroalimentacion, raw.explanation, raw.explicacion, '')),
    choices,
    correctAnswer,
    points: Number.isFinite(rawPoints) && rawPoints >= 0 ? rawPoints : 1,
    timerSeconds: Number.isFinite(rawTimer) && rawTimer > 0 ? Math.ceil(rawTimer) : 0,
    media: normalizeMedia(raw.media, raw.medios, {
      imagen_url: raw.imagen_url,
      image_url: raw.image_url,
      audio_url: raw.audio_url,
    }),
    // El bloque no tiene tipo propio en el backend: viaja como 'info' con la
    // URL en configuracion (ver TeacherCreatorPage.jsx: serializeItem).
    wordwallUrl: typeof itemConfig.wordwall_url === 'string' ? itemConfig.wordwall_url : '',
    // Modos "ordenar" y "emparejar": viajan como short_text con la definición
    // en configuracion, igual que wordwall. Así no hay que ampliar el CHECK de
    // quiz_items.tipo, que en SQLite obliga a reconstruir la tabla.
    mode: MODES.has(itemConfig.modo) ? itemConfig.modo : '',
    piezas: Array.isArray(itemConfig.piezas) ? itemConfig.piezas.map(String) : [],
    pares: Array.isArray(itemConfig.pares)
      ? itemConfig.pares
        .filter(par => Array.isArray(par) && par.length >= 2)
        .map(([izq, der]) => ({ izq: String(izq), der: String(der) }))
      : [],
  }
}

const MODES = new Set(['ordenar', 'emparejar'])

/** Forma canónica de una secuencia. El backend guarda esta misma cadena como
 *  correct_answer, así la comparación de short_text funciona sin tocarla. */
export function canonicalOrden(piezas) {
  return piezas.join(' | ')
}

/** Forma canónica de un emparejamiento: ordenado por término, para que el
 *  orden en que el estudiante empareje no cambie el resultado. */
export function canonicalPares(pares) {
  return pares
    .map(({ izq, der }) => `${izq} = ${der}`)
    .sort()
    .join(' | ')
}

function getConfig(activity) {
  return {
    ...parseObject(activity?.config),
    ...parseObject(activity?.quiz_config),
  }
}

function resolveDefaultTimer(activity, config) {
  const rawTimer = Number(firstDefined(
    config.time_limit_per_item,
    config.time_limit_seconds,
    config.tiempo_por_item,
    config.tiempo_limite_segundos,
    config.tiempo_segundos,
    activity?.time_limit_seconds,
    activity?.tiempo_limite_segundos,
    0,
  ))
  return Number.isFinite(rawTimer) && rawTimer > 0 ? Math.ceil(rawTimer) : 0
}

function resolveGlobalTimer(activity, config) {
  const rawTimer = Number(firstDefined(
    config.global_time_seconds,
    config.tiempo_global_segundos,
    activity?.global_time_seconds,
    activity?.tiempo_global_segundos,
    0,
  ))
  return Number.isFinite(rawTimer) && rawTimer > 0 ? Math.ceil(rawTimer) : 0
}

function resolvePassingThreshold(activity, config) {
  const rawThreshold = Number(firstDefined(
    config.passing_percentage,
    config.aprobado_porcentaje,
    activity?.passing_percentage,
    activity?.aprobado_porcentaje,
    60,
  ))
  if (!Number.isFinite(rawThreshold)) return 60
  return Math.min(100, Math.max(0, rawThreshold))
}

function getCorrectChoiceKeys(item) {
  const flagged = item.choices.filter(choice => choice.isCorrect === true).map(choice => choice.key)
  if (flagged.length > 0) return flagged

  const declared = Array.isArray(item.correctAnswer) ? item.correctAnswer : [item.correctAnswer]
  const comparableAnswers = declared.filter(hasMeaningfulValue).map(normalizeComparable)
  if (comparableAnswers.length === 0) return []

  return item.choices
    .filter(choice => choice.identities.some(identity => comparableAnswers.includes(identity)))
    .map(choice => choice.key)
}

function defaultDraft(type) {
  if (type === 'multiple_choice') return []
  if (type === 'true_false') return null
  return ''
}

function evaluateItem(item, draft, timedOut = false) {
  if (item.type === 'single_choice') {
    const selected = item.choices.find(choice => choice.key === draft)
    const correctKeys = getCorrectChoiceKeys(item)
    const scorable = correctKeys.length > 0
    const isCorrect = timedOut ? (scorable ? false : null) : (scorable ? correctKeys.includes(draft) : null)
    return {
      answer: timedOut ? null : firstDefined(selected?.value, selected?.text, null),
      selectedOptionIds: selected ? [selected.id] : [],
      selectedOptionTexts: selected ? [selected.text] : [],
      scorable,
      isCorrect,
    }
  }

  if (item.type === 'multiple_choice') {
    const selectedKeys = Array.isArray(draft) ? draft : []
    const selected = item.choices.filter(choice => selectedKeys.includes(choice.key))
    const correctKeys = getCorrectChoiceKeys(item)
    const scorable = correctKeys.length > 0
    const sortedSelection = [...selectedKeys].sort()
    const sortedCorrect = [...correctKeys].sort()
    const exactMatch = sortedSelection.length === sortedCorrect.length
      && sortedSelection.every((value, index) => value === sortedCorrect[index])
    return {
      answer: timedOut ? [] : selected.map(choice => choice.value),
      selectedOptionIds: selected.map(choice => choice.id),
      selectedOptionTexts: selected.map(choice => choice.text),
      scorable,
      isCorrect: timedOut ? (scorable ? false : null) : (scorable ? exactMatch : null),
    }
  }

  if (item.type === 'true_false') {
    const correctBoolean = parseBoolean(item.correctAnswer)
    const scorable = correctBoolean !== null
    return {
      answer: timedOut ? null : draft,
      selectedOptionIds: [],
      selectedOptionTexts: [],
      scorable,
      isCorrect: timedOut ? (scorable ? false : null) : (scorable ? draft === correctBoolean : null),
    }
  }

  if (item.type === 'short_text') {
    const declared = Array.isArray(item.correctAnswer) ? item.correctAnswer : [item.correctAnswer]
    const accepted = declared.filter(hasMeaningfulValue).map(normalizeComparable)
    const scorable = accepted.length > 0
    const answer = timedOut ? '' : String(draft || '').trim()
    return {
      answer,
      selectedOptionIds: [],
      selectedOptionTexts: [],
      scorable,
      isCorrect: timedOut ? (scorable ? false : null) : (scorable ? accepted.includes(normalizeComparable(answer)) : null),
    }
  }

  return {
    answer: true,
    selectedOptionIds: [],
    selectedOptionTexts: [],
    scorable: false,
    isCorrect: null,
  }
}

function createRecord(item, draft, startedAt, timedOut = false, extra = {}) {
  const evaluation = evaluateItem(item, draft, timedOut)
  const earnedPoints = evaluation.scorable && evaluation.isCorrect ? item.points : 0
  const elapsed = Math.max(0, Math.round(performance.now() - startedAt))

  return {
    item_id: item.id,
    pregunta_id: item.id,
    type: item.type,
    tipo: item.originalType,
    normalized_type: item.type,
    answer: evaluation.answer,
    respuesta: evaluation.answer,
    selected_option_ids: evaluation.selectedOptionIds,
    selected_option_texts: evaluation.selectedOptionTexts,
    is_correct: evaluation.isCorrect,
    correcta: evaluation.isCorrect === null ? null : (evaluation.isCorrect ? 1 : 0),
    score: earnedPoints,
    puntaje_obtenido: earnedPoints,
    max_score: evaluation.scorable ? item.points : 0,
    puntaje_maximo: evaluation.scorable ? item.points : 0,
    time_spent_ms: elapsed,
    tiempo_ms: elapsed,
    timed_out: timedOut,
    respondida_en: new Date().toISOString(),
    draft,
    scorable: evaluation.scorable,
    ...extra,
  }
}

function stripInternalFields(record) {
  if (!record) return record
  const { draft, scorable, ...serializable } = record
  return serializable
}

function isReadyToSubmit(type, draft) {
  if (type === 'multiple_choice') return Array.isArray(draft) && draft.length > 0
  if (type === 'true_false') return draft !== null
  if (type === 'single_choice') return Boolean(draft)
  if (type === 'short_text') return String(draft || '').trim().length > 0
  return true
}

function formatDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`
}

function mediaFileName(entry) {
  if (entry.title) return entry.title
  try {
    const pathname = new URL(entry.url, 'http://local').pathname
    return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || 'Archivo adjunto')
  } catch {
    return 'Archivo adjunto'
  }
}

/** Solo se llega aquí con una URL ya validada por el backend (dominio wordwall.net, https). */
function WordwallEmbed({ url }) {
  if (!url) return null
  return (
    <div className="a-fade-up my-5 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--ar-border)' }}>
      <div className="relative w-full" style={{ paddingBottom: '75%' }}>
        <iframe
          src={url}
          title="Juego interactivo de Wordwall"
          className="absolute inset-0 h-full w-full"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          loading="lazy"
          allowFullScreen
        />
      </div>
      <div
        className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs"
        style={{ borderColor: 'var(--ar-border)', background: 'var(--ar-surface-2)' }}
      >
        <span className="flex items-center gap-1.5 font-bold text-[color:var(--ar-muted)]">
          <Gamepad2 size={14} /> Juego de Wordwall
        </span>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-bold text-[color:var(--ar-primary)] hover:underline"
        >
          Abrir en pestaña nueva <ExternalLink size={13} />
        </a>
      </div>
    </div>
  )
}

function MediaGallery({ media, compact = false }) {
  if (!media?.length) return null

  return (
    <div className={`grid gap-3 ${compact ? 'mt-3' : 'my-5'} ${media.filter(entry => entry.kind === 'image').length > 1 ? 'sm:grid-cols-2' : ''}`}>
      {media.map((entry, index) => (
        entry.kind === 'audio' ? (
          /* El audio se destaca: en primaria muchas consignas se escuchan
             antes de leerse, así que no puede pasar como un adjunto más. */
          <div
            key={`${entry.url}-${index}`}
            className="a-fade-up rounded-2xl border p-4 sm:col-span-2"
            style={{ borderColor: 'var(--ar-primary)', background: 'var(--ar-primary-light)' }}
          >
            <div className="mb-2.5 flex items-center gap-2">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
                style={{ background: 'var(--ar-primary)' }}
              >
                <Headphones size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold" style={{ color: 'var(--ar-primary-dark)' }}>
                  {entry.title || 'Escucha este audio'}
                </p>
                <p className="text-xs text-[color:var(--ar-muted)]">Puedes reproducirlo las veces que necesites.</p>
              </div>
            </div>
            <audio controls preload="metadata" className="w-full" src={entry.url}>
              Tu navegador no puede reproducir este audio.
            </audio>
          </div>
        ) : entry.kind === 'video' ? (
          <div key={`${entry.url}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
            {entry.title && <p className="mb-2 text-sm font-medium text-slate-700">{entry.title}</p>}
            <video controls preload="metadata" className="w-full rounded-lg" src={entry.url}>
              Tu navegador no puede reproducir este video.
            </video>
          </div>
        ) : entry.kind === 'file' ? (
          <div key={`${entry.url}-${index}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <FileText size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{mediaFileName(entry)}</p>
              <p className="text-xs text-slate-500">Archivo adjunto</p>
            </div>
            <a
              href={entry.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              Abrir <ExternalLink size={14} />
            </a>
            <a href={entry.url} download className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">
              Descargar
            </a>
          </div>
        ) : (
          <figure key={`${entry.url}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img
              src={entry.url}
              alt={entry.alt || entry.title || 'Imagen del bloque'}
              className={`${compact ? 'max-h-36' : 'max-h-80'} w-full object-contain`}
              loading="lazy"
            />
            {entry.title && <figcaption className="border-t border-slate-200 px-3 py-2 text-xs text-slate-600">{entry.title}</figcaption>}
          </figure>
        )
      ))}
    </div>
  )
}

function ChoiceButton({ choice, selected, submitted, correct, revealEvaluation, onClick, multiple }) {
  let stateClass = 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/50'
  if (selected) stateClass = 'border-teal-500 bg-teal-50 text-teal-950 ring-1 ring-teal-500'
  if (submitted && revealEvaluation && correct === true) stateClass = 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500'
  if (submitted && revealEvaluation && selected && correct === false) stateClass = 'border-rose-400 bg-rose-50 text-rose-950 ring-1 ring-rose-400'
  if (submitted && revealEvaluation && !selected && correct === false) stateClass = 'border-slate-200 bg-slate-50 text-slate-500 opacity-70'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={submitted}
      aria-pressed={selected}
      className={`w-full rounded-2xl border-2 p-4 text-left transition-all disabled:cursor-default ${stateClass}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 text-xs font-bold ${
          multiple ? 'rounded-md' : 'rounded-full'
        } ${selected ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
          {selected ? '✓' : '•'}
        </span>
        <div className="min-w-0 flex-1">
          <span className="font-semibold">{choice.text}</span>
          <MediaGallery media={choice.media} compact />
        </div>
        {submitted && revealEvaluation && correct === true && <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />}
        {submitted && revealEvaluation && selected && correct === false && <XCircle size={20} className="shrink-0 text-rose-600" />}
      </div>
    </button>
  )
}

/* Modo "ordenar": subir/bajar en vez de arrastrar. Sin librería de drag, y
   funciona igual con dedo, ratón y teclado. */
function OrdenarBloque({ piezas, bloqueado, valorActual, onChange }) {
  const [orden, setOrden] = useState(() => {
    // Al volver a un bloque ya respondido hay que mostrar lo que el estudiante
    // dejó, no una baraja nueva.
    const guardado = String(valorActual || '').split(' | ')
    if (guardado.length === piezas.length && guardado.every(p => piezas.includes(p))) {
      return guardado
    }
    // Barajar hasta que no salga ya ordenado (si hay más de una pieza).
    let intento = shuffled(piezas)
    for (let i = 0; i < 5 && piezas.length > 1 && intento.join('|') === piezas.join('|'); i += 1) {
      intento = shuffled(piezas)
    }
    return intento
  })

  useEffect(() => { onChange(orden) }, [orden])

  const mover = (desde, hacia) => {
    if (bloqueado || hacia < 0 || hacia >= orden.length) return
    const copia = [...orden]
    ;[copia[desde], copia[hacia]] = [copia[hacia], copia[desde]]
    setOrden(copia)
  }

  return (
    <div className="mt-6 space-y-2">
      <p className="text-sm font-semibold text-slate-500">Ordena los pasos de primero a último.</p>
      {orden.map((pieza, i) => (
        <div
          key={pieza}
          className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-100 text-sm font-black text-teal-700">
            {i + 1}
          </span>
          <span className="flex-1 text-sm font-semibold text-slate-800">{pieza}</span>
          <div className="flex shrink-0 flex-col">
            <button
              type="button" disabled={bloqueado || i === 0} onClick={() => mover(i, i - 1)}
              aria-label={`Subir "${pieza}"`}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25"
            >
              <ChevronUp size={17} />
            </button>
            <button
              type="button" disabled={bloqueado || i === orden.length - 1} onClick={() => mover(i, i + 1)}
              aria-label={`Bajar "${pieza}"`}
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25"
            >
              <ChevronDown size={17} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* Modo "emparejar": tocar un término y luego su pareja. Tocar un par ya hecho
   lo deshace, que es la forma más simple de corregirse sin un botón extra. */
function EmparejarBloque({ pares, bloqueado, valorActual, onChange }) {
  // Igual que en ordenar: al revisitar el bloque hay que recuperar lo hecho.
  const [hechos, setHechos] = useState(() => String(valorActual || '')
    .split(' | ')
    .map(trozo => trozo.split(' = '))
    .filter(par => par.length === 2)
    .map(([izq, der]) => ({ izq, der })))
  const [activo, setActivo] = useState(null)
  const derechas = useMemo(() => shuffled(pares.map(p => p.der)), [pares])

  useEffect(() => { onChange(hechos) }, [hechos])

  const usadoIzq = izq => hechos.some(h => h.izq === izq)
  const usadoDer = der => hechos.some(h => h.der === der)

  const tocarIzq = (izq) => {
    if (bloqueado) return
    const yaHecho = hechos.find(h => h.izq === izq)
    if (yaHecho) { setHechos(hechos.filter(h => h.izq !== izq)); setActivo(null); return }
    setActivo(activo === izq ? null : izq)
  }

  const tocarDer = (der) => {
    if (bloqueado) return
    const yaHecho = hechos.find(h => h.der === der)
    if (yaHecho) { setHechos(hechos.filter(h => h.der !== der)); return }
    if (!activo) return
    setHechos([...hechos, { izq: activo, der }])
    setActivo(null)
  }

  const parejaDe = izq => hechos.find(h => h.izq === izq)?.der

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm font-semibold text-slate-500">
        Toca un concepto y luego su pareja. Toca una pareja hecha para deshacerla.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          {pares.map(({ izq }) => (
            <button
              key={izq} type="button" disabled={bloqueado} onClick={() => tocarIzq(izq)}
              className={`w-full rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold transition-all ${
                activo === izq ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200'
                  : usadoIzq(izq) ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white hover:border-teal-300'
              }`}
            >
              {izq}
              {parejaDe(izq) && (
                <span className="mt-1 block text-xs font-bold text-emerald-700">→ {parejaDe(izq)}</span>
              )}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {derechas.map(der => (
            <button
              key={der} type="button" disabled={bloqueado || (!activo && !usadoDer(der))}
              onClick={() => tocarDer(der)}
              className={`w-full rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold transition-all disabled:opacity-45 ${
                usadoDer(der) ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white hover:border-teal-300'
              }`}
            >
              {der}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-xs font-bold text-slate-400">
        {hechos.length} de {pares.length} emparejados
      </p>
    </div>
  )
}

/* Ficha que gira en 3D. El "medidor" es una copia invisible de la cara más
   larga: fija la altura del contenedor, porque las dos caras reales van en
   position:absolute y no aportan alto. */
function Ficha3D({ frente, reverso, flipped, onFlip }) {
  const masLarga = String(reverso || '').length > String(frente || '').length ? reverso : frente
  return (
    <div className={`ficha3d mt-6 ${flipped ? 'is-flipped' : ''}`}>
      <button
        type="button"
        onClick={onFlip}
        aria-pressed={flipped}
        aria-label={flipped ? 'Ver el anverso de la ficha' : 'Girar la ficha para ver el reverso'}
        className="ficha3d-inner block w-full text-left"
      >
        <span className="ficha3d-medidor block text-xl font-bold leading-relaxed" aria-hidden="true">
          {masLarga}
        </span>

        <span className="ficha3d-cara border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50 shadow-inner">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Anverso</span>
          <span className="block whitespace-pre-wrap text-xl font-bold leading-relaxed text-slate-900">
            {frente}
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
            <RotateCw size={17} /> Girar ficha
          </span>
        </span>

        <span className="ficha3d-cara atras border-indigo-300 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-inner">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Reverso</span>
          <span className="block whitespace-pre-wrap text-xl font-bold leading-relaxed text-slate-900">
            {reverso}
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
            <RotateCw size={17} /> Volver
          </span>
        </span>
      </button>
    </div>
  )
}

function Feedback({ record, explanation }) {
  if (!record) return null

  const state = record.timed_out
    ? { title: 'Tiempo agotado', className: 'border-amber-200 bg-amber-50 text-amber-950', icon: <Clock3 size={21} /> }
    : record.is_correct === true
      ? { title: 'Respuesta correcta', className: 'border-emerald-200 bg-emerald-50 text-emerald-950', icon: <CheckCircle2 size={21} /> }
      : record.is_correct === false
        ? { title: 'Respuesta incorrecta', className: 'border-rose-200 bg-rose-50 text-rose-950', icon: <XCircle size={21} /> }
        : { title: 'Respuesta registrada', className: 'border-blue-200 bg-blue-50 text-blue-950', icon: <Info size={21} /> }

  return (
    <div role="status" className={`mt-6 rounded-2xl border p-4 ${state.className}`}>
      <div className="flex items-center gap-2 font-bold">
        {state.icon}
        <span>{state.title}</span>
      </div>
      {explanation && <p className="mt-2 text-sm leading-relaxed text-slate-700">{explanation}</p>}
    </div>
  )
}

function finiteNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return null
}

function mergeServerCompletion(payload, serverResult, passingThreshold) {
  if (!serverResult || typeof serverResult !== 'object') return payload
  const summary = firstDefined(serverResult.intento, serverResult.attempt, serverResult.result, serverResult)
  const detail = firstDefined(serverResult.detalle, serverResult.answers, serverResult.respuestas, [])
  const details = Array.isArray(detail) ? detail : []
  const detailById = new Map(details.map(entry => [String(firstDefined(entry.item_id, entry.pregunta_id, entry.id, '')), entry]))
  const answers = payload.answers.map(answer => {
    const serverAnswer = detailById.get(String(firstDefined(answer.item_id, answer.pregunta_id, '')))
    return serverAnswer ? { ...answer, ...serverAnswer } : answer
  })
  const percentage = finiteNumber(summary?.percentage, summary?.porcentaje, serverResult.percentage, serverResult.porcentaje, payload.percentage)
  const score = finiteNumber(summary?.score, summary?.puntaje, serverResult.score, serverResult.puntaje, payload.score) ?? 0
  const maxScore = finiteNumber(
    summary?.maxScore,
    summary?.max_score,
    summary?.puntaje_maximo,
    serverResult.maxScore,
    serverResult.puntaje_maximo,
    payload.maxScore,
  ) ?? 0
  const detailCorrectCount = details.filter(entry => entry.is_correct === true || entry.correcta === 1 || entry.correcta === true).length
  const correctCount = finiteNumber(
    summary?.correctCount,
    summary?.respuestas_correctas,
    serverResult.correctCount,
    serverResult.respuestas_correctas,
    details.length > 0 ? detailCorrectCount : null,
    payload.correctCount,
  ) ?? 0
  const incorrectCount = finiteNumber(
    summary?.incorrectCount,
    summary?.respuestas_incorrectas,
    serverResult.incorrectCount,
    serverResult.respuestas_incorrectas,
    percentage !== null ? Math.max(0, payload.metrics.questionCount - correctCount) : null,
    payload.metrics.incorrectCount,
  ) ?? 0
  const passed = percentage === null ? null : percentage >= passingThreshold
  const metrics = {
    ...payload.metrics,
    score,
    maxScore,
    percentage,
    correctCount,
    incorrectCount,
    gradingPending: percentage === null,
    passingThreshold,
    passed,
  }

  return {
    ...payload,
    answers,
    respuestas: answers,
    metrics,
    score,
    puntaje: score,
    maxScore,
    puntaje_maximo: maxScore,
    percentage,
    porcentaje: percentage,
    correctCount,
    respuestas_correctas: correctCount,
    passed,
    aprobado: passed,
    serverResult,
  }
}

export default function UnifiedQuiz({ activity, questions, items, onComplete }) {
  const config = useMemo(() => getConfig(activity), [activity])
  const sourceItems = firstDefined(items, questions, activity?.items, activity?.quiz_items, activity?.preguntas, [])
  const defaultTimer = resolveDefaultTimer(activity, config)
  const globalTimer = resolveGlobalTimer(activity, config)
  const passingThreshold = resolvePassingThreshold(activity, config)
  const showFeedback = configBoolean(config, ['show_feedback', 'mostrar_feedback'], true)
  const showProgress = configBoolean(config, ['show_progress', 'mostrar_progreso'], true)
  const shuffleQuestions = configBoolean(config, ['shuffle_questions', 'barajar_preguntas'], false)
  const shuffleOptions = configBoolean(config, ['shuffle_options', 'barajar_opciones'], false)
  // Personalización del quiz. Viaja dentro del JSON `configuracion`, que ya es
  // libre, así que no hace falta migrar la base para añadir opciones.
  const temaQuiz = TEMAS_QUIZ.includes(config?.tema) ? config.tema : 'turquesa'
  const sonidoHabilitado = configBoolean(config, ['sonido', 'sound'], true)
  const celebracionHabilitada = configBoolean(config, ['celebracion', 'celebration'], true)
  const [silencio, setSilencio] = useState(() => estaSilenciado())
  const normalizedSourceItems = useMemo(() => {
    const parsed = parseJson(sourceItems)
    return (Array.isArray(parsed) ? parsed : []).map((item, index) => normalizeItem(item, index, defaultTimer, shuffleOptions))
  }, [sourceItems, defaultTimer, shuffleOptions])
  const normalizedItems = useMemo(
    () => (shuffleQuestions ? shuffleQuestionSlots(normalizedSourceItems) : normalizedSourceItems),
    [normalizedSourceItems, shuffleQuestions],
  )
  const quizIdentity = `${firstDefined(activity?.id, activity?.quiz_id, 'quiz')}:${normalizedItems.map(item => item.key).join('|')}`

  const [currentIndex, setCurrentIndex] = useState(0)
  const [records, setRecords] = useState({})
  const [draft, setDraft] = useState(() => defaultDraft(normalizedItems[0]?.type))
  const [flipped, setFlipped] = useState(false)
  const [timeLeft, setTimeLeft] = useState(normalizedItems[0]?.timerSeconds || 0)
  const [globalTimeLeft, setGlobalTimeLeft] = useState(globalTimer)
  const [result, setResult] = useState(null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [completionError, setCompletionError] = useState('')
  const attemptStartedAtRef = useRef(Date.now())
  const itemStartedAtRef = useRef(performance.now())
  const globalTimedOutRef = useRef(false)
  const current = normalizedItems[currentIndex]
  const currentRecord = current ? records[current.key] : null
  const isQuestion = current ? QUESTION_TYPES.has(current.type) : false

  useEffect(() => {
    setCurrentIndex(0)
    setRecords({})
    setDraft(defaultDraft(normalizedItems[0]?.type))
    setFlipped(false)
    setTimeLeft(normalizedItems[0]?.timerSeconds || 0)
    setGlobalTimeLeft(globalTimer)
    setResult(null)
    setCompletionError('')
    attemptStartedAtRef.current = Date.now()
    itemStartedAtRef.current = performance.now()
    globalTimedOutRef.current = false
  }, [quizIdentity, globalTimer]) // eslint-disable-line react-hooks/exhaustive-deps

  // Los navegadores solo permiten audio tras un gesto: se desbloquea al
  // primer clic o tecla dentro del quiz para que el primer acierto ya suene.
  useEffect(() => {
    if (!sonidoHabilitado) return undefined
    const desbloquear = () => desbloquearAudio()
    window.addEventListener('pointerdown', desbloquear, { once: true })
    window.addEventListener('keydown', desbloquear, { once: true })
    return () => {
      window.removeEventListener('pointerdown', desbloquear)
      window.removeEventListener('keydown', desbloquear)
    }
  }, [sonidoHabilitado])

  useEffect(() => {
    if (!current) return
    const saved = records[current.key]
    setDraft(saved ? saved.draft : defaultDraft(current.type))
    setFlipped(Boolean(saved?.revealed))
    setTimeLeft(saved ? 0 : current.timerSeconds)
    itemStartedAtRef.current = performance.now()
  }, [current?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const buildPayload = useCallback((completedRecords) => {
    const answers = normalizedItems
      .map(item => completedRecords[item.key])
      .filter(Boolean)
      .map(stripInternalFields)
    const questionRecords = normalizedItems
      .filter(item => QUESTION_TYPES.has(item.type))
      .map(item => completedRecords[item.key])
      .filter(Boolean)
    const scoredRecords = questionRecords.filter(record => record.scorable)
    const score = scoredRecords.reduce((sum, record) => sum + Number(record.score || 0), 0)
    const maxScore = scoredRecords.reduce((sum, record) => sum + Number(record.max_score || 0), 0)
    const correctCount = scoredRecords.filter(record => record.is_correct === true).length
    const incorrectCount = scoredRecords.filter(record => record.is_correct === false).length
    const timedOutCount = questionRecords.filter(record => record.timed_out).length
    const answeredCount = questionRecords.filter(record => !record.timed_out && (
      Array.isArray(record.answer) ? record.answer.length > 0 : hasMeaningfulValue(record.answer)
    )).length
    const questionCount = normalizedItems.filter(item => QUESTION_TYPES.has(item.type)).length
    const gradingPending = scoredRecords.length < questionCount
    const percentage = questionCount === 0
      ? 100
      : gradingPending
        ? null
        : maxScore > 0
          ? Math.round((score / maxScore) * 100)
          : Math.round((correctCount / Math.max(1, scoredRecords.length)) * 100)
    const passed = percentage === null ? null : percentage >= passingThreshold
    const completedAt = new Date()
    const durationMs = Math.max(0, completedAt.getTime() - attemptStartedAtRef.current)
    const metrics = {
      score,
      maxScore,
      percentage,
      correctCount,
      incorrectCount,
      answeredCount,
      questionCount,
      scoredQuestionCount: scoredRecords.length,
      totalItems: normalizedItems.length,
      timedOutCount,
      gradingPending,
      passingThreshold,
      passed,
      durationMs,
      startedAt: new Date(attemptStartedAtRef.current).toISOString(),
      completedAt: completedAt.toISOString(),
    }

    return {
      activityId: activity?.id ?? null,
      actividad_id: activity?.id ?? null,
      quizId: firstDefined(activity?.quiz_id, activity?.id, null),
      quiz_id: firstDefined(activity?.quiz_id, activity?.id, null),
      answers,
      respuestas: answers,
      metrics,
      score,
      puntaje: score,
      maxScore,
      puntaje_maximo: maxScore,
      percentage,
      porcentaje: percentage,
      correctCount,
      respuestas_correctas: correctCount,
      passed,
      aprobado: passed,
      passingThreshold,
      aprobado_porcentaje: passingThreshold,
      totalQuestions: metrics.questionCount,
      total_preguntas: metrics.questionCount,
      durationMs,
      duracion_ms: durationMs,
      startedAt: metrics.startedAt,
      completedAt: metrics.completedAt,
    }
  }, [activity, normalizedItems, passingThreshold])

  const deliverResult = useCallback(async (payload) => {
    setIsCompleting(true)
    setCompletionError('')
    try {
      if (onComplete) {
        const serverResult = await onComplete(payload)
        if (serverResult) {
          setResult(currentResult => mergeServerCompletion(currentResult || payload, serverResult, passingThreshold))
        }
      }
    } catch (error) {
      setCompletionError(error?.message || 'No se pudo guardar el resultado. Puedes volver a intentarlo.')
    } finally {
      setIsCompleting(false)
    }
  }, [onComplete, passingThreshold])

  const finishQuiz = useCallback((completedRecords = records) => {
    const payload = buildPayload(completedRecords)
    setResult(payload)
    if (sonidoHabilitado && !silencio) {
      if (payload.metrics?.passed === true) sonidoCelebracion()
      else sonidoFin()
    }
    void deliverResult(payload)
  }, [records, buildPayload, deliverResult, sonidoHabilitado, silencio])

  const goForward = useCallback((completedRecords = records) => {
    if (currentIndex >= normalizedItems.length - 1) {
      finishQuiz(completedRecords)
      return
    }
    setCurrentIndex(index => index + 1)
  }, [currentIndex, normalizedItems.length, records, finishQuiz])

  const recordCurrent = useCallback((answerDraft, timedOut = false, extra = {}) => {
    if (!current || records[current.key]) return records
    const record = createRecord(current, answerDraft, itemStartedAtRef.current, timedOut, extra)
    // Refuerzo sonoro inmediato: llega antes de que el ojo lea el mensaje.
    if (sonidoHabilitado && !silencio && record.is_correct !== null && record.is_correct !== undefined) {
      if (record.is_correct === true) sonidoAcierto()
      else if (record.is_correct === false) sonidoError()
    }
    const nextRecords = { ...records, [current.key]: record }
    setRecords(nextRecords)
    return nextRecords
  }, [current, records, sonidoHabilitado, silencio])

  const submitQuestion = useCallback((timedOut = false) => {
    if (!current || currentRecord || !QUESTION_TYPES.has(current.type)) return
    const answerDraft = timedOut ? defaultDraft(current.type) : draft
    if (!timedOut && !isReadyToSubmit(current.type, answerDraft)) return
    recordCurrent(answerDraft, timedOut)
  }, [current, currentRecord, draft, recordCurrent])

  useEffect(() => {
    if (!current || !isQuestion || currentRecord || !current.timerSeconds || result) return undefined
    const timer = window.setInterval(() => {
      setTimeLeft(value => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [current?.key, current?.timerSeconds, currentRecord, isQuestion, result])

  useEffect(() => {
    if (current?.timerSeconds && isQuestion && timeLeft === 0 && !currentRecord && !result) {
      submitQuestion(true)
    }
  }, [timeLeft, current, currentRecord, isQuestion, result, submitQuestion])

  useEffect(() => {
    if (!globalTimer || result) return undefined
    const timer = window.setInterval(() => {
      setGlobalTimeLeft(value => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [globalTimer, result])

  const finishForGlobalTimeout = useCallback(() => {
    if (globalTimedOutRef.current || result) return
    globalTimedOutRef.current = true
    const now = performance.now()
    const completedRecords = { ...records }
    normalizedItems.forEach(item => {
      if (completedRecords[item.key]) return
      const timedOut = QUESTION_TYPES.has(item.type)
      completedRecords[item.key] = createRecord(
        item,
        defaultDraft(item.type),
        item.key === current?.key ? itemStartedAtRef.current : now,
        timedOut,
        {
          global_timeout: true,
          skipped: true,
          ...(timedOut ? {} : { viewed: false, answer: false, respuesta: false }),
        },
      )
    })
    setRecords(completedRecords)
    finishQuiz(completedRecords)
  }, [current?.key, finishQuiz, normalizedItems, records, result])

  useEffect(() => {
    if (globalTimer && globalTimeLeft === 0 && !result) finishForGlobalTimeout()
  }, [globalTimer, globalTimeLeft, result, finishForGlobalTimeout])

  const continueContent = () => {
    if (!current) return
    const nextRecords = currentRecord
      ? records
      : recordCurrent(true, false, current.type === 'flashcard' ? { revealed: flipped } : { viewed: true })
    goForward(nextRecords)
  }

  if (normalizedItems.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <Info size={38} className="mx-auto text-slate-400" />
        <h2 className="mt-3 text-xl font-bold text-slate-900">Este quiz todavía no tiene contenido</h2>
        <p className="mt-2 text-sm text-slate-600">Agrega bloques o preguntas antes de iniciar la actividad.</p>
      </div>
    )
  }

  if (result) {
    const metrics = result.metrics
    const resultTitle = metrics.passed === true
      ? 'Actividad aprobada'
      : metrics.passed === false
        ? 'Quiz completado'
        : 'Quiz completado'
    const aprobado = metrics.passed === true
    return (
      <section className="a-scale overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl" data-accent={temaQuiz}>
        <div
          className="relative px-6 py-9 text-center text-white sm:px-10"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, var(--ar-primary-dark) 100%)' }}
        >
          {/* Confeti sutil solo al aprobar; nunca cuando no se logró. */}
          {aprobado && celebracionHabilitada && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              {Array.from({ length: 14 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute block rounded-sm a-float"
                  style={{
                    left: `${(i * 7.3 + 4) % 96}%`,
                    top: `${(i * 13) % 70}%`,
                    width: 7,
                    height: 7,
                    background: ['#fbbf24', '#34d399', '#60a5fa', '#f472b6'][i % 4],
                    opacity: 0.75,
                    animationDelay: `${(i % 6) * 0.28}s`,
                    animationDuration: `${3 + (i % 4) * 0.6}s`,
                    transform: `rotate(${i * 27}deg)`,
                  }}
                />
              ))}
            </div>
          )}
          <div className={`relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 ${aprobado && celebracionHabilitada ? 'a-celebrate' : ''}`}>
            <Trophy size={36} className="text-amber-300" />
          </div>
          <h2 className="mt-4 text-2xl font-black sm:text-3xl">{resultTitle}</h2>
          <p className="mt-2 text-sm text-slate-300">{activity?.titulo || activity?.title || 'Resultado de la actividad'}</p>
          {metrics.percentage !== null && (
            <p className="mt-2 text-xs font-medium text-slate-300">
              {metrics.passed
                ? `Superaste el mínimo de ${metrics.passingThreshold}%.`
                : `El mínimo de aprobación es ${metrics.passingThreshold}%.`}
            </p>
          )}
        </div>

        <div className="space-y-6 p-5 sm:p-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-center">
              <span className="block text-2xl font-black text-teal-700">{metrics.percentage === null ? '—' : `${metrics.percentage}%`}</span>
              <span className="text-xs font-medium text-teal-900">Resultado</span>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
              <span className="block text-2xl font-black text-emerald-700">{metrics.gradingPending ? '—' : metrics.correctCount}</span>
              <span className="text-xs font-medium text-emerald-900">Correctas</span>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-center">
              <span className="block text-2xl font-black text-indigo-700">{metrics.gradingPending ? '—' : `${metrics.score}/${metrics.maxScore}`}</span>
              <span className="text-xs font-medium text-indigo-900">Puntos</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
              <span className="block text-lg font-black text-slate-700">{formatDuration(metrics.durationMs)}</span>
              <span className="text-xs font-medium text-slate-600">Tiempo</span>
            </div>
          </div>

          {completionError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <p className="font-bold">El quiz terminó, pero el resultado no se guardó.</p>
              <p className="mt-1">{completionError}</p>
              <button
                type="button"
                onClick={() => deliverResult(result)}
                disabled={isCompleting}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 font-bold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                <RotateCw size={16} /> Reintentar envío
              </button>
            </div>
          )}

          {isCompleting && (
            <div role="status" className="flex items-center justify-center gap-2 text-sm font-medium text-slate-600">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              Guardando resultado…
            </div>
          )}

          {!isCompleting && !completionError && metrics.gradingPending && (
            <p className="text-center text-sm text-slate-600">
              El servidor no devolvió todavía la calificación de este intento.
            </p>
          )}
        </div>
      </section>
    )
  }

  const progress = ((currentIndex + 1) / normalizedItems.length) * 100
  const correctKeys = current ? getCorrectChoiceKeys(current) : []
  const activeDraft = currentRecord ? currentRecord.draft : draft

  return (
    /* data-accent tiñe todo el subárbol: el acento elegido por quien creó el
       quiz se aplica a barras, botones y realces sin duplicar estilos. */
    <section className="space-y-5" data-accent={temaQuiz}>
      <header className="overflow-hidden rounded-3xl p-5 text-white shadow-xl sm:p-7 gradient-pan"
              style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, var(--ar-primary-dark) 100%)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Motor interactivo</p>
            <h2 className="mt-1 truncate text-xl font-black sm:text-2xl">{activity?.titulo || activity?.title || 'Quiz'}</h2>
            {showProgress && <p className="mt-1 text-sm text-white/70">Bloque {currentIndex + 1} de {normalizedItems.length}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sonidoHabilitado && (
              <button
                type="button"
                onClick={() => { desbloquearAudio(); setSilencio(alternarSilencio()) }}
                className="press flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white/85 transition-colors hover:bg-white/20"
                aria-pressed={!silencio}
                title={silencio ? 'Activar sonidos' : 'Silenciar sonidos'}
              >
                {silencio ? <VolumeX size={18} /> : <Volume2 size={18} />}
                <span className="hidden sm:inline">{silencio ? 'Sin sonido' : 'Sonido'}</span>
              </button>
            )}
            {globalTimer > 0 && (
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-sm font-bold ${
                globalTimeLeft <= 10
                  ? 'border-rose-400/50 bg-rose-500/20 text-rose-200'
                  : 'border-white/15 bg-white/10 text-cyan-200'
              }`} title="Tiempo total restante">
                <Clock3 size={18} /> Total {globalTimeLeft}s
              </div>
            )}
            {isQuestion && current.timerSeconds > 0 && (
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-sm font-bold ${
                timeLeft <= 5 && !currentRecord
                  ? 'border-rose-400/50 bg-rose-500/20 text-rose-200'
                  : 'border-white/15 bg-white/10 text-amber-200'
              }`} title="Tiempo del bloque">
                <Clock3 size={18} /> Bloque {timeLeft}s
              </div>
            )}
          </div>
        </div>
        {showProgress && (
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin="0" aria-valuemax="100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--ar-primary), #fff)',
                transition: 'width var(--ar-dur-slower) var(--ar-ease-out)',
              }}
            />
          </div>
        )}
      </header>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg sm:p-8">
        {current.type === 'unsupported' && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Este bloque usa el tipo “{current.originalType}”, que aún no tiene una interacción específica. Su contenido se mostrará como información.
          </div>
        )}

        {current.prompt && current.type !== 'flashcard' && (
          <h3 className="text-xl font-bold leading-relaxed text-slate-950 sm:text-2xl">
            {current.prompt}
          </h3>
        )}
        {current.content && current.type !== 'flashcard' && (
          <p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-700">{current.content}</p>
        )}

        <WordwallEmbed url={current.wordwallUrl} />
        <MediaGallery media={current.media} />

        {(current.type === 'single_choice' || current.type === 'multiple_choice') && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {current.choices.map(choice => {
              const selected = current.type === 'multiple_choice'
                ? Array.isArray(activeDraft) && activeDraft.includes(choice.key)
                : activeDraft === choice.key
              return (
                <ChoiceButton
                  key={choice.key}
                  choice={choice}
                  selected={selected}
                  submitted={Boolean(currentRecord)}
                  correct={correctKeys.length > 0 ? correctKeys.includes(choice.key) : null}
                  revealEvaluation={showFeedback && correctKeys.length > 0}
                  multiple={current.type === 'multiple_choice'}
                  onClick={() => {
                    if (current.type === 'multiple_choice') {
                      setDraft(previous => previous.includes(choice.key)
                        ? previous.filter(key => key !== choice.key)
                        : [...previous, choice.key])
                    } else {
                      setDraft(choice.key)
                    }
                  }}
                />
              )
            })}
            {current.choices.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 sm:col-span-2">
                Esta pregunta no tiene opciones configuradas.
              </p>
            )}
          </div>
        )}

        {current.type === 'true_false' && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { value: true, label: 'Verdadero' },
              { value: false, label: 'Falso' },
            ].map(option => {
              const correctValue = parseBoolean(current.correctAnswer)
              const selected = activeDraft === option.value
              const correct = correctValue === option.value
              let stateClass = selected
                ? 'border-teal-500 bg-teal-50 text-teal-950 ring-1 ring-teal-500'
                : 'border-slate-200 bg-white hover:border-teal-300'
              if (currentRecord && showFeedback && correctValue !== null && correct) stateClass = 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500'
              if (currentRecord && showFeedback && correctValue !== null && selected && !correct) stateClass = 'border-rose-400 bg-rose-50 text-rose-950 ring-1 ring-rose-400'
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  disabled={Boolean(currentRecord)}
                  aria-pressed={selected}
                  onClick={() => setDraft(option.value)}
                  className={`rounded-2xl border-2 px-5 py-6 text-lg font-black transition-all disabled:cursor-default ${stateClass}`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        )}

        {current.type === 'short_text' && current.mode === 'ordenar' && (
          <OrdenarBloque
            key={current.key}
            piezas={current.piezas}
            bloqueado={Boolean(currentRecord)}
            valorActual={activeDraft}
            onChange={orden => setDraft(canonicalOrden(orden))}
          />
        )}

        {current.type === 'short_text' && current.mode === 'emparejar' && (
          <EmparejarBloque
            key={current.key}
            pares={current.pares}
            bloqueado={Boolean(currentRecord)}
            valorActual={activeDraft}
            onChange={hechos => setDraft(hechos.length === current.pares.length ? canonicalPares(hechos) : '')}
          />
        )}

        {current.type === 'short_text' && !current.mode && (
          <textarea
            value={activeDraft || ''}
            disabled={Boolean(currentRecord)}
            onChange={event => setDraft(event.target.value)}
            rows={5}
            placeholder="Escribe tu respuesta…"
            className="mt-6 w-full resize-y rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-50"
          />
        )}

        {current.type === 'flashcard' && (
          <Ficha3D
            frente={current.prompt || current.content}
            reverso={current.back}
            flipped={flipped}
            onFlip={() => setFlipped(value => !value)}
          />
        )}

        {showFeedback && <Feedback record={currentRecord} explanation={current.explanation} />}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={() => setCurrentIndex(index => Math.max(0, index - 1))}
            disabled={currentIndex === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={18} /> Anterior
          </button>

          {isQuestion ? (
            currentRecord ? (
              <button
                type="button"
                onClick={() => goForward(records)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-slate-800"
              >
                {currentIndex === normalizedItems.length - 1 ? (
                  <>Finalizar quiz <Send size={17} /></>
                ) : (
                  <>Siguiente <ChevronRight size={18} /></>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => submitQuestion(false)}
                disabled={!isReadyToSubmit(current.type, draft)}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Comprobar <CheckCircle2 size={18} />
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={continueContent}
              disabled={current.type === 'flashcard' && !flipped}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {currentIndex === normalizedItems.length - 1 ? (
                <>Finalizar quiz <Send size={17} /></>
              ) : (
                <>Continuar <ChevronRight size={18} /></>
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
