import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  File,
  Gamepad2,
  Image,
  Info,
  Layers3,
  ListChecks,
  Loader2,
  Plus,
  Save,
  Settings2,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import { PageHeader, Card, SectionTitle } from '../../components/ui'
import { handleUnauthorized } from '../../services/api'

const BLOCK_TYPES = [
  {
    value: 'single_choice',
    label: 'Selección única',
    description: 'Una sola respuesta correcta.',
    icon: ListChecks,
    colorClass: 'bg-teal-100 text-teal-700',
  },
  {
    value: 'multiple_choice',
    label: 'Selección múltiple',
    description: 'Dos o más respuestas pueden ser correctas.',
    icon: CheckCircle2,
    colorClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    value: 'true_false',
    label: 'Verdadero o falso',
    description: 'Una afirmación con dos posibilidades.',
    icon: Check,
    colorClass: 'bg-blue-100 text-blue-700',
  },
  {
    value: 'short_text',
    label: 'Respuesta corta',
    description: 'El estudiante escribe la respuesta.',
    icon: Type,
    colorClass: 'bg-violet-100 text-violet-700',
  },
  {
    value: 'flashcard',
    label: 'Ficha',
    description: 'Una tarjeta con frente y reverso.',
    icon: Layers3,
    colorClass: 'bg-amber-100 text-amber-700',
  },
  {
    value: 'info',
    label: 'Contenido',
    description: 'Texto y medios sin calificación.',
    icon: Info,
    colorClass: 'bg-slate-200 text-slate-700',
  },
  {
    value: 'wordwall',
    label: 'Juego de Wordwall',
    description: 'Incrusta un juego ya creado en wordwall.net.',
    icon: Gamepad2,
    colorClass: 'bg-fuchsia-100 text-fuchsia-700',
  },
]

const BLOCK_TYPE_BY_VALUE = Object.fromEntries(BLOCK_TYPES.map((type) => [type.value, type]))
const QUESTION_TYPES = new Set(['single_choice', 'multiple_choice', 'true_false', 'short_text'])
const CHOICE_TYPES = new Set(['single_choice', 'multiple_choice'])
// Dominios embebibles: deben coincidir con ALLOWED_EMBED_HOSTS en api/services/quizzes.py.
const ALLOWED_EMBED_HOSTS = ['wordwall.net']

function parseEmbedUrl(input) {
  if (!input) return ''
  const trimmed = input.trim()
  // Admite tanto una URL suelta como el <iframe> completo que Wordwall entrega en "Compartir → Insertar".
  const iframeMatch = trimmed.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i)
  return (iframeMatch ? iframeMatch[1] : trimmed).trim()
}

function isAllowedEmbedUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    return ALLOWED_EMBED_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

const AREA_OPTIONS = [
  { value: 'cuerpo_humano', label: 'Cuerpo humano' },
  { value: 'pubertad', label: 'Pubertad' },
  { value: 'sistema_reproductor_femenino', label: 'Sistema reproductor femenino' },
  { value: 'sistema_reproductor_masculino', label: 'Sistema reproductor masculino' },
  { value: 'celulas_reproductoras', label: 'Células reproductoras' },
  { value: 'fecundacion', label: 'Fecundación' },
  { value: 'embarazo', label: 'Embarazo' },
  { value: 'nacimiento', label: 'Nacimiento' },
  { value: 'autocuidado', label: 'Autocuidado' },
  { value: 'preguntas_frecuentes', label: 'Preguntas frecuentes' },
]

/* Deben coincidir con TEMAS_QUIZ del motor y con [data-accent] del CSS. */
const TEMAS_QUIZ_OPCIONES = [
  { value: 'turquesa',  label: 'Turquesa',  color: '#0ea5a5' },
  { value: 'violeta',   label: 'Violeta',   color: '#7c3aed' },
  { value: 'azul',      label: 'Azul',      color: '#2563eb' },
  { value: 'coral',     label: 'Coral',     color: '#f43f5e' },
  { value: 'ambar',     label: 'Ámbar',     color: '#f59e0b' },
  { value: 'esmeralda', label: 'Esmeralda', color: '#10b981' },
]

const FIELD_CLASS =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100'
const LABEL_CLASS = 'mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600'

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `quiz-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createOption() {
  return {
    id: createId(),
    texto: '',
    correcta: false,
    media: [],
  }
}

function createBlock(tipo) {
  return {
    id: createId(),
    tipo,
    enunciado: '',
    contenido: '',
    opciones: CHOICE_TYPES.has(tipo) ? [createOption(), createOption()] : [],
    respuesta_correcta: '',
    explicacion: '',
    puntos: QUESTION_TYPES.has(tipo) ? 1 : 0,
    tiempo_segundos: QUESTION_TYPES.has(tipo) ? 30 : 0,
    media: [],
    // Solo lo usa el bloque 'wordwall' por ahora; viaja tal cual en configuracion.
    config: {},
  }
}

function mediaTypeForFile(file) {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  return 'file'
}

function displayApiError(body, fallback) {
  if (!body) return fallback
  if (typeof body === 'string') return body
  if (typeof body.error === 'string') return body.error
  if (typeof body.message === 'string') return body.message
  if (typeof body.detail === 'string') return body.detail
  if (Array.isArray(body.detail)) {
    return body.detail.map((item) => item.msg || item.message || String(item)).join(' · ')
  }
  return fallback
}

async function uploadMediaAsset(file, token) {
  const form = new FormData()
  form.append('file', file)

  const response = await fetch('/api/quiz-media', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')
  }
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(displayApiError(body, `No fue posible subir ${file.name}.`))
  }

  const url = body?.url || body?.media?.url || body?.archivo_o_url
  if (!url) throw new Error(`La API no devolvió la URL de ${file.name}.`)

  return {
    tipo: body?.tipo || mediaTypeForFile(file),
    url,
    nombre: body?.nombre || body?.filename || file.name,
  }
}

function cloneItemsWithMedia(items) {
  return items.map((item) => ({
    ...item,
    media: item.media.map((media) => ({ ...media })),
    opciones: item.opciones.map((option) => ({
      ...option,
      media: option.media.map((media) => ({ ...media })),
    })),
  }))
}

function snapshotItems(items) {
  return cloneItemsWithMedia(items)
}

async function uploadPendingMedia(items, token, onProgress) {
  const prepared = cloneItemsWithMedia(items)

  const uploadCollection = async (collection, locationLabel) => {
    for (const media of collection) {
      if (media.url) continue
      if (!media.file) throw new Error(`${locationLabel}: falta el archivo seleccionado.`)

      media.status = 'uploading'
      media.error = ''
      onProgress(snapshotItems(prepared))

      try {
        const uploaded = await uploadMediaAsset(media.file, token)
        media.tipo = uploaded.tipo
        media.url = uploaded.url
        media.nombre = uploaded.nombre
        media.status = 'uploaded'
        media.error = ''
      } catch (error) {
        media.status = 'error'
        media.error = error.message
        onProgress(snapshotItems(prepared))
        throw new Error(`${locationLabel}: ${error.message}`)
      }

      onProgress(snapshotItems(prepared))
    }
  }

  for (let itemIndex = 0; itemIndex < prepared.length; itemIndex += 1) {
    const item = prepared[itemIndex]
    await uploadCollection(item.media, `Bloque ${itemIndex + 1}`)

    for (let optionIndex = 0; optionIndex < item.opciones.length; optionIndex += 1) {
      await uploadCollection(
        item.opciones[optionIndex].media,
        `Bloque ${itemIndex + 1}, opción ${optionIndex + 1}`,
      )
    }
  }

  return prepared
}

function cleanMedia(media) {
  return media.map((asset) => ({
    tipo: asset.tipo,
    url: asset.url,
    ...(asset.nombre ? { nombre: asset.nombre } : {}),
    ...(asset.alt?.trim() ? { alt: asset.alt.trim() } : {}),
  }))
}

function serializeItem(item, index) {
  let respuestaCorrecta = null

  if (item.tipo === 'single_choice') {
    respuestaCorrecta = item.opciones.find((option) => option.correcta)?.id || ''
  } else if (item.tipo === 'multiple_choice') {
    respuestaCorrecta = item.opciones.filter((option) => option.correcta).map((option) => option.id)
  } else if (item.tipo === 'true_false' || item.tipo === 'short_text') {
    respuestaCorrecta = item.respuesta_correcta.trim()
  } else if (item.tipo === 'flashcard') {
    respuestaCorrecta = item.contenido.trim()
  }

  // El motor no tiene un tipo 'wordwall' propio: viaja como bloque de
  // contenido ('info') con la URL en config, así no hace falta migrar nada.
  const esWordwall = item.tipo === 'wordwall'
  const enunciado = item.enunciado.trim()

  return {
    id: item.id,
    tipo: esWordwall ? 'info' : item.tipo,
    orden: index + 1,
    enunciado: esWordwall ? (enunciado || 'Juego interactivo') : enunciado,
    contenido: item.contenido.trim(),
    opciones: item.opciones.map((option) => ({
      id: option.id,
      texto: option.texto.trim(),
      correcta: option.correcta,
      media: cleanMedia(option.media),
    })),
    respuesta_correcta: respuestaCorrecta,
    explicacion: item.explicacion.trim(),
    puntos: Number(item.puntos),
    tiempo_segundos: Number(item.tiempo_segundos),
    media: cleanMedia(item.media),
    config: esWordwall ? { ...item.config, wordwall_url: parseEmbedUrl(item.config?.wordwall_url) } : (item.config || {}),
  }
}

function validateQuiz(form, items) {
  const fieldErrors = {}
  const itemErrors = {}
  const generalErrors = []

  if (form.titulo.trim().length < 3) fieldErrors.titulo = 'Escribe un título de al menos 3 caracteres.'
  if (!AREA_OPTIONS.some((option) => option.value === form.area)) fieldErrors.area = 'Selecciona un área válida.'

  const attempts = Number(form.intentos_maximos)
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 20) {
    fieldErrors.intentos_maximos = 'Los intentos deben ser un número entre 1 y 20.'
  }

  const globalTime = Number(form.config.tiempo_global_segundos)
  if (!Number.isInteger(globalTime) || globalTime < 0) {
    fieldErrors.tiempo_global_segundos = 'Usa 0 para no limitar el tiempo o un número entero positivo.'
  }

  const approved = Number(form.config.aprobado_porcentaje)
  if (!Number.isFinite(approved) || approved < 0 || approved > 100) {
    fieldErrors.aprobado_porcentaje = 'El porcentaje debe estar entre 0 y 100.'
  }

  if (items.length === 0) {
    generalErrors.push('Añade al menos un bloque al quiz.')
  } else if (!items.some((item) => item.tipo !== 'info')) {
    generalErrors.push('Añade al menos una pregunta o una ficha además del contenido informativo.')
  }

  items.forEach((item, index) => {
    const errors = []
    const label = `Bloque ${index + 1}`

    if (item.tipo === 'info') {
      if (!item.contenido.trim() && item.media.length === 0) {
        errors.push('Agrega texto, una imagen o un audio.')
      }
    } else if (item.tipo === 'wordwall') {
      const url = parseEmbedUrl(item.config?.wordwall_url)
      if (!url) errors.push('Pega el enlace o el código <iframe> que te da Wordwall al insertar.')
      else if (!isAllowedEmbedUrl(url)) errors.push('Solo se admiten enlaces de wordwall.net.')
    } else if (item.tipo === 'flashcard') {
      if (!item.enunciado.trim()) errors.push('Escribe el frente de la ficha.')
      if (!item.contenido.trim()) errors.push('Escribe el reverso de la ficha.')
    } else {
      if (!item.enunciado.trim()) errors.push('Escribe el enunciado.')
    }

    if (CHOICE_TYPES.has(item.tipo)) {
      const filled = item.opciones.filter((option) => option.texto.trim())
      const correct = item.opciones.filter((option) => option.correcta)
      const normalized = filled.map((option) => option.texto.trim().toLocaleLowerCase())

      if (filled.length < 2 || filled.length !== item.opciones.length) {
        errors.push('Completa al menos dos opciones y elimina las que estén vacías.')
      }
      if (new Set(normalized).size !== normalized.length) errors.push('Las opciones no pueden estar repetidas.')
      if (item.tipo === 'single_choice' && correct.length !== 1) {
        errors.push('Marca exactamente una respuesta correcta.')
      }
      if (item.tipo === 'multiple_choice' && correct.length < 1) {
        errors.push('Marca al menos una respuesta correcta.')
      }
    }

    if (item.tipo === 'true_false' && !['true', 'false'].includes(item.respuesta_correcta)) {
      errors.push('Selecciona si la afirmación es verdadera o falsa.')
    }

    if (item.tipo === 'short_text' && !item.respuesta_correcta.trim()) {
      errors.push('Escribe la respuesta que se aceptará como correcta.')
    }

    if (QUESTION_TYPES.has(item.tipo)) {
      const points = Number(item.puntos)
      const seconds = Number(item.tiempo_segundos)
      if (!Number.isFinite(points) || points <= 0) errors.push('Los puntos deben ser mayores que cero.')
      if (!Number.isInteger(seconds) || seconds < 0) errors.push('El tiempo debe ser 0 o un entero positivo.')
    }

    if (errors.length) itemErrors[item.id] = { label, errors }
  })

  return { fieldErrors, itemErrors, generalErrors }
}

function hasValidationErrors(errors) {
  return (
    Object.keys(errors.fieldErrors).length > 0 ||
    Object.keys(errors.itemErrors).length > 0 ||
    errors.generalErrors.length > 0
  )
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="mt-0.5 flex h-5 w-9 flex-shrink-0 rounded-full bg-slate-300 p-0.5 transition peer-checked:bg-teal-600">
        <span className={`h-4 w-4 rounded-full bg-white shadow transition ${checked ? 'translate-x-4' : ''}`} />
      </span>
      <span>
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>
      </span>
    </label>
  )
}

function MediaPreview({ asset }) {
  const source = asset.previewUrl || asset.url

  if (asset.tipo === 'image') {
    return <img src={source} alt={asset.alt || asset.nombre || ''} className="h-32 w-full rounded-lg object-cover" />
  }

  if (asset.tipo === 'audio') {
    return <audio src={source} controls className="w-full" preload="metadata" />
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
      <File size={18} />
      <span className="truncate">{asset.nombre}</span>
    </div>
  )
}

function MediaPicker({ media, onChange, compact = false, maxItems = 4 }) {
  const addFiles = (fileList) => {
    const available = Math.max(0, maxItems - media.length)
    const selected = Array.from(fileList).slice(0, available)
    if (!selected.length) return

    const additions = selected.map((file) => ({
      id: createId(),
      tipo: mediaTypeForFile(file),
      nombre: file.name,
      alt: '',
      url: '',
      previewUrl: URL.createObjectURL(file),
      file,
      status: 'pending',
      error: '',
    }))
    onChange([...media, ...additions])
  }

  const removeAsset = (assetId) => {
    const asset = media.find((item) => item.id === assetId)
    if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl)
    onChange(media.filter((item) => item.id !== assetId))
  }

  const updateAsset = (assetId, changes) => {
    onChange(media.map((item) => (item.id === assetId ? { ...item, ...changes } : item)))
  }

  return (
    <div className="space-y-2">
      {media.length > 0 && (
        <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
          {media.map((asset) => (
            <div key={asset.id} className="relative rounded-xl border border-slate-200 bg-white p-2">
              <MediaPreview asset={asset} />
              <button
                type="button"
                onClick={() => removeAsset(asset.id)}
                className="absolute right-1 top-1 rounded-full bg-slate-900/75 p-1 text-white hover:bg-rose-600"
                aria-label={`Quitar ${asset.nombre}`}
              >
                <X size={13} />
              </button>

              <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                <span className="truncate font-semibold text-slate-600">{asset.nombre}</span>
                {asset.status === 'uploading' && (
                  <span className="flex items-center gap-1 text-teal-700"><Loader2 size={11} className="animate-spin" /> Subiendo</span>
                )}
                {asset.status === 'uploaded' && <span className="font-bold text-emerald-700">Listo</span>}
                {asset.status === 'error' && <span className="font-bold text-rose-700">Error</span>}
              </div>

              {asset.tipo === 'image' && !compact && (
                <input
                  value={asset.alt}
                  onChange={(event) => updateAsset(asset.id, { alt: event.target.value })}
                  placeholder="Descripción accesible de la imagen"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-teal-500"
                />
              )}
              {asset.error && <p className="mt-1 text-xs font-semibold text-rose-700">{asset.error}</p>}
            </div>
          ))}
        </div>
      )}

      {media.length < maxItems && (
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-teal-300 bg-teal-50 font-bold text-teal-700 hover:bg-teal-100 ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}>
          <Image size={compact ? 14 : 16} />
          {compact ? 'Añadir imagen o audio' : 'Adjuntar imagen, audio o archivo'}
          <input
            type="file"
            multiple={maxItems > 1}
            accept="image/*,audio/*,video/mp4,video/webm,.pdf"
            className="sr-only"
            onChange={(event) => {
              addFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </label>
      )}
      {!compact && <p className="text-xs text-slate-500">La vista previa es local; los archivos se subirán al publicar.</p>}
    </div>
  )
}

function ChoiceEditor({ block, onChange }) {
  const updateOption = (optionId, changes) => {
    let options = block.opciones.map((option) => (option.id === optionId ? { ...option, ...changes } : option))
    if (changes.correcta && block.tipo === 'single_choice') {
      options = options.map((option) => ({ ...option, correcta: option.id === optionId }))
    }
    onChange({ opciones: options })
  }

  const removeOption = (optionId) => {
    if (block.opciones.length <= 2) return
    const removed = block.opciones.find((option) => option.id === optionId)
    removed?.media.forEach((asset) => asset.previewUrl && URL.revokeObjectURL(asset.previewUrl))
    onChange({ opciones: block.opciones.filter((option) => option.id !== optionId) })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-slate-800">Opciones</p>
        <span className="text-xs font-semibold text-slate-500">
          {block.tipo === 'single_choice' ? 'Marca una correcta' : 'Marca todas las correctas'}
        </span>
      </div>

      {block.opciones.map((option, optionIndex) => (
        <div key={option.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <input
              type={block.tipo === 'single_choice' ? 'radio' : 'checkbox'}
              name={block.tipo === 'single_choice' ? `correct-${block.id}` : undefined}
              checked={option.correcta}
              onChange={(event) => updateOption(option.id, { correcta: event.target.checked })}
              className="h-4 w-4 flex-shrink-0 accent-teal-600"
              aria-label={`Marcar opción ${optionIndex + 1} como correcta`}
            />
            <input
              value={option.texto}
              onChange={(event) => updateOption(option.id, { texto: event.target.value })}
              placeholder={`Opción ${optionIndex + 1}`}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
            <button
              type="button"
              onClick={() => removeOption(option.id)}
              disabled={block.opciones.length <= 2}
              className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-25"
              aria-label={`Eliminar opción ${optionIndex + 1}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="ml-6 mt-2">
            <MediaPicker
              media={option.media}
              onChange={(media) => updateOption(option.id, { media })}
              compact
              maxItems={1}
            />
          </div>
        </div>
      ))}

      {block.opciones.length < 8 && (
        <button
          type="button"
          onClick={() => onChange({ opciones: [...block.opciones, createOption()] })}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-extrabold text-teal-700 hover:bg-teal-50"
        >
          <Plus size={14} /> Añadir opción
        </button>
      )}
    </div>
  )
}

function WordwallBlockFields({ block, onChange }) {
  const raw = block.config?.wordwall_url || ''
  const parsedUrl = parseEmbedUrl(raw)
  const isValid = parsedUrl && isAllowedEmbedUrl(parsedUrl)

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-3 text-xs text-fuchsia-900">
        <Gamepad2 size={16} className="mt-0.5 shrink-0" />
        <p>
          En <strong>wordwall.net</strong> abre tu juego → <strong>Compartir → Insertar (Embed)</strong> y pega aquí
          el enlace, o directamente el código <code>&lt;iframe&gt;</code> completo — lo detectamos igual.
        </p>
      </div>

      <div>
        <label className={LABEL_CLASS}>Título opcional</label>
        <input
          value={block.enunciado}
          onChange={(event) => onChange({ enunciado: event.target.value })}
          placeholder="Ej. Repasemos con un juego"
          className={FIELD_CLASS}
        />
      </div>

      <div>
        <label className={LABEL_CLASS}>Enlace o código de Wordwall</label>
        <textarea
          value={raw}
          onChange={(event) => onChange({ config: { ...block.config, wordwall_url: event.target.value } })}
          rows={3}
          placeholder="https://wordwall.net/es/embed/… o <iframe src=…>"
          className={`${FIELD_CLASS} resize-y font-mono text-xs`}
        />
        {raw && !isValid && (
          <p className="mt-1 text-xs font-semibold text-rose-700">
            Solo se admiten enlaces https de wordwall.net. Revisa que copiaste el enlace de "Insertar", no el de "Compartir".
          </p>
        )}
      </div>

      {isValid && (
        <div>
          <label className={LABEL_CLASS}>Vista previa</label>
          <div className="overflow-hidden rounded-xl border border-slate-200" style={{ aspectRatio: '4 / 3' }}>
            <iframe
              src={parsedUrl}
              title="Vista previa del juego de Wordwall"
              className="h-full w-full"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function BlockEditor({ block, index, total, errors, onChange, onRemove, onMove, onTypeChange }) {
  const type = BLOCK_TYPE_BY_VALUE[block.tipo]
  const TypeIcon = type.icon

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${errors?.length ? 'border-rose-300' : 'border-slate-200'}`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${type.colorClass}`}>
          <TypeIcon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Bloque {index + 1}</p>
          <select
            value={block.tipo}
            onChange={(event) => onTypeChange(event.target.value)}
            className="max-w-full bg-transparent text-sm font-extrabold text-slate-900 outline-none"
            aria-label={`Tipo del bloque ${index + 1}`}
          >
            {BLOCK_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-teal-700 disabled:opacity-25"
            aria-label="Mover bloque hacia arriba"
          >
            <ArrowUp size={16} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-teal-700 disabled:opacity-25"
            aria-label="Mover bloque hacia abajo"
          >
            <ArrowDown size={16} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            aria-label="Eliminar bloque"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:p-5">
        {errors?.length > 0 && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <p className="mb-1 font-extrabold">Revisa este bloque:</p>
            <ul className="list-inside list-disc space-y-0.5 text-xs font-semibold">
              {errors.map((error) => <li key={error}>{error}</li>)}
            </ul>
          </div>
        )}

        {block.tipo === 'wordwall' ? (
          <WordwallBlockFields block={block} onChange={onChange} />
        ) : block.tipo === 'info' ? (
          <>
            <div>
              <label className={LABEL_CLASS}>Título opcional</label>
              <input
                value={block.enunciado}
                onChange={(event) => onChange({ enunciado: event.target.value })}
                placeholder="Ej. Antes de comenzar"
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Contenido</label>
              <textarea
                value={block.contenido}
                onChange={(event) => onChange({ contenido: event.target.value })}
                rows={4}
                placeholder="Explica, contextualiza o da instrucciones al estudiante…"
                className={`${FIELD_CLASS} resize-y`}
              />
            </div>
          </>
        ) : block.tipo === 'flashcard' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL_CLASS}>Frente de la ficha</label>
              <textarea
                value={block.enunciado}
                onChange={(event) => onChange({ enunciado: event.target.value })}
                rows={4}
                placeholder="Concepto, imagen o pregunta…"
                className={`${FIELD_CLASS} resize-y`}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Reverso de la ficha</label>
              <textarea
                value={block.contenido}
                onChange={(event) => onChange({ contenido: event.target.value })}
                rows={4}
                placeholder="Definición o explicación…"
                className={`${FIELD_CLASS} resize-y`}
              />
            </div>
          </div>
        ) : (
          <div>
            <label className={LABEL_CLASS}>Enunciado</label>
            <textarea
              value={block.enunciado}
              onChange={(event) => onChange({ enunciado: event.target.value })}
              rows={3}
              placeholder={block.tipo === 'true_false' ? 'Escribe una afirmación…' : 'Escribe la pregunta…'}
              className={`${FIELD_CLASS} resize-y`}
            />
          </div>
        )}

        {block.tipo !== 'wordwall' && (
          <div>
            <label className={LABEL_CLASS}>Medios del bloque</label>
            <MediaPicker media={block.media} onChange={(media) => onChange({ media })} />
          </div>
        )}

        {CHOICE_TYPES.has(block.tipo) && <ChoiceEditor block={block} onChange={onChange} />}

        {block.tipo === 'true_false' && (
          <fieldset>
            <legend className={LABEL_CLASS}>Respuesta correcta</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { value: 'true', label: 'Verdadero' },
                { value: 'false', label: 'Falso' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold ${block.respuesta_correcta === option.value ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                >
                  <input
                    type="radio"
                    name={`true-false-${block.id}`}
                    value={option.value}
                    checked={block.respuesta_correcta === option.value}
                    onChange={(event) => onChange({ respuesta_correcta: event.target.value })}
                    className="accent-teal-600"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {block.tipo === 'short_text' && (
          <div>
            <label className={LABEL_CLASS}>Respuesta correcta</label>
            <input
              value={block.respuesta_correcta}
              onChange={(event) => onChange({ respuesta_correcta: event.target.value })}
              placeholder="Texto que el motor aceptará como respuesta"
              className={FIELD_CLASS}
            />
            <p className="mt-1 text-xs text-slate-500">El motor podrá normalizar mayúsculas y acentos al calificar.</p>
          </div>
        )}

        {block.tipo !== 'info' && (
          <>
            <div>
              <label className={LABEL_CLASS}>Explicación o retroalimentación</label>
              <textarea
                value={block.explicacion}
                onChange={(event) => onChange({ explicacion: event.target.value })}
                rows={2}
                placeholder="Se mostrará al estudiante después de responder…"
                className={`${FIELD_CLASS} resize-y`}
              />
            </div>

            {QUESTION_TYPES.has(block.tipo) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={LABEL_CLASS}>Puntos</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={block.puntos}
                    onChange={(event) => onChange({ puntos: event.target.value })}
                    className={FIELD_CLASS}
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Tiempo del bloque (segundos)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={block.tiempo_segundos}
                    onChange={(event) => onChange({ tiempo_segundos: event.target.value })}
                    className={FIELD_CLASS}
                  />
                  <p className="mt-1 text-xs text-slate-500">Usa 0 para dejarlo sin límite individual.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </article>
  )
}

export default function TeacherCreatorPage() {
  const { token } = useAuth()
  const { categories, refresh } = useData()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    instrucciones: '',
    area: 'cuerpo_humano',
    categoria_id: '',
    dificultad: 'basica',
    intentos_maximos: 2,
    config: {
      barajar_preguntas: false,
      barajar_opciones: false,
      mostrar_feedback: true,
      mostrar_progreso: true,
      tiempo_global_segundos: 0,
      aprobado_porcentaje: 60,
      // Personalización: viaja en el mismo JSON de configuración del quiz.
      tema: 'turquesa',
      sonido: true,
      celebracion: true,
    },
  })
  const [items, setItems] = useState([])
  const [cover, setCover] = useState(null)
  const [validation, setValidation] = useState({ fieldErrors: {}, itemErrors: {}, generalErrors: [] })
  const [isSaving, setIsSaving] = useState(false)
  const [submitStage, setSubmitStage] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(null)

  const updateForm = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value }
      // La unidad de ruta debe pertenecer al área seleccionada.
      if (field === 'area') next.categoria_id = ''
      return next
    })
    setSuccess(null)
    setValidation((current) => ({
      ...current,
      fieldErrors: { ...current.fieldErrors, [field]: undefined },
    }))
  }

  const categoriesForArea = categories.filter((cat) => cat.area === form.area)

  const updateConfig = (field, value) => {
    setForm((current) => ({
      ...current,
      config: { ...current.config, [field]: value },
    }))
    setSuccess(null)
    setValidation((current) => ({
      ...current,
      fieldErrors: { ...current.fieldErrors, [field]: undefined },
    }))
  }

  const addBlock = (tipo) => {
    const block = createBlock(tipo)
    setItems((current) => [...current, block])
    setValidation((current) => ({ ...current, generalErrors: [] }))
    setSuccess(null)
  }

  const updateBlock = (blockId, changes) => {
    setItems((current) => current.map((item) => (item.id === blockId ? { ...item, ...changes } : item)))
    setValidation((current) => {
      const itemErrors = { ...current.itemErrors }
      delete itemErrors[blockId]
      return { ...current, itemErrors }
    })
    setSuccess(null)
  }

  const changeBlockType = (blockId, tipo) => {
    setItems((current) => current.map((item) => {
      if (item.id !== blockId) return item
      item.opciones.forEach((option) => {
        option.media.forEach((asset) => asset.previewUrl && URL.revokeObjectURL(asset.previewUrl))
      })
      const fresh = createBlock(tipo)
      return {
        ...fresh,
        id: item.id,
        enunciado: item.enunciado,
        contenido: item.contenido,
        explicacion: item.explicacion,
        media: item.media,
      }
    }))
    setValidation((current) => {
      const itemErrors = { ...current.itemErrors }
      delete itemErrors[blockId]
      return { ...current, itemErrors }
    })
  }

  const removeBlock = (blockId) => {
    setItems((current) => {
      const removed = current.find((item) => item.id === blockId)
      removed?.media.forEach((asset) => asset.previewUrl && URL.revokeObjectURL(asset.previewUrl))
      removed?.opciones.forEach((option) => {
        option.media.forEach((asset) => asset.previewUrl && URL.revokeObjectURL(asset.previewUrl))
      })
      return current.filter((item) => item.id !== blockId)
    })
    setValidation((current) => {
      const itemErrors = { ...current.itemErrors }
      delete itemErrors[blockId]
      return { ...current, itemErrors }
    })
  }

  const moveBlock = (index, direction) => {
    setItems((current) => {
      const destination = index + direction
      if (destination < 0 || destination >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(destination, 0, moved)
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')
    setSuccess(null)

    const nextValidation = validateQuiz(form, items)
    setValidation(nextValidation)
    if (hasValidationErrors(nextValidation)) {
      setSubmitError('Hay campos pendientes. Revisa los mensajes antes de publicar.')
      window.requestAnimationFrame(() => document.getElementById('quiz-builder-errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return
    }

    setIsSaving(true)

    try {
      setSubmitStage('Subiendo imágenes y audios…')
      let uploadedCover = null
      if (cover?.file) uploadedCover = await uploadMediaAsset(cover.file, token)
      const preparedItems = await uploadPendingMedia(items, token, setItems)
      setItems(preparedItems)

      const payload = {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        instrucciones: form.instrucciones.trim(),
        area: form.area,
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
        dificultad: form.dificultad,
        intentos_maximos: Number(form.intentos_maximos),
        config: {
          ...form.config,
          feed_card: {
            ...(form.config.feed_card || {}),
            ...(uploadedCover ? { cover_url: uploadedCover.url } : {}),
          },
          tiempo_global_segundos: Number(form.config.tiempo_global_segundos),
          aprobado_porcentaje: Number(form.config.aprobado_porcentaje),
        },
        media: uploadedCover ? [uploadedCover] : [],
        items: preparedItems.map(serializeItem),
      }

      setSubmitStage('Creando el quiz completo…')
      const response = await fetch('/api/quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })
      if (response.status === 401) {
        handleUnauthorized()
        throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.')
      }
      const body = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(displayApiError(body, 'No fue posible crear el quiz.'))
      }

      setSuccess({ id: body?.actividad_id || body?.id || body?.quiz_id, title: form.titulo.trim() })
      setSubmitStage('')
      // Sin esto el feed sigue mostrando la lista de actividades que tenía en
      // memoria desde que se cargó la app: el quiz recién creado no aparece
      // hasta recargar la página a mano, aunque ya existe en el servidor.
      refresh()
    } catch (error) {
      setSubmitError(error.message || 'Ocurrió un error inesperado al guardar el quiz.')
      setSubmitStage('')
    } finally {
      setIsSaving(false)
    }
  }

  const totalPoints = items.reduce((sum, item) => sum + (QUESTION_TYPES.has(item.tipo) ? Number(item.puntos) || 0 : 0), 0)

  return (
    <div className="mx-auto max-w-6xl animate-fade-in space-y-6 pb-10">
      <PageHeader
        title="Constructor de quizzes interactivos"
        subtitle="Combina preguntas, fichas, imágenes y audio. El motor unificado mostrará los bloques en el orden que definas."
      >
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-white/90">
          <span className="rounded-full bg-white/15 px-3 py-1.5">{items.length} bloques</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5">{totalPoints} puntos</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5">Guardado completo en una sola operación</span>
        </div>
      </PageHeader>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <Card className="border-2 border-slate-200 bg-white p-5 sm:p-6">
          <SectionTitle
            title="Información general"
            subtitle="Datos que verá el estudiante antes de comenzar."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={LABEL_CLASS}>Título del quiz *</label>
              <input
                value={form.titulo}
                onChange={(event) => updateForm('titulo', event.target.value)}
                placeholder="Ej. Cambios físicos durante la pubertad"
                className={`${FIELD_CLASS} ${validation.fieldErrors.titulo ? 'border-rose-400' : ''}`}
              />
              {validation.fieldErrors.titulo && <p className="mt-1 text-xs font-semibold text-rose-700">{validation.fieldErrors.titulo}</p>}
            </div>

            <div>
              <label className={LABEL_CLASS}>Área temática *</label>
              <select
                value={form.area}
                onChange={(event) => updateForm('area', event.target.value)}
                className={FIELD_CLASS}
              >
                {AREA_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {validation.fieldErrors.area && <p className="mt-1 text-xs font-semibold text-rose-700">{validation.fieldErrors.area}</p>}
            </div>

            <div>
              <label className={LABEL_CLASS}>Unidad de la ruta</label>
              <select
                value={form.categoria_id}
                onChange={(event) => updateForm('categoria_id', event.target.value)}
                className={FIELD_CLASS}
              >
                <option value="">Sin unidad (quiz personal, no aparece en Mi ruta)</option>
                {categoriesForArea.map((cat) => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">Elige una unidad para que el quiz aparezca como paso en la ruta de los estudiantes, igual que las actividades base.</p>
            </div>

            <div>
              <label className={LABEL_CLASS}>Dificultad</label>
              <select value={form.dificultad} onChange={(event) => updateForm('dificultad', event.target.value)} className={FIELD_CLASS}>
                <option value="basica">Básica</option>
                <option value="media">Media</option>
                <option value="avanzada">Avanzada</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className={LABEL_CLASS}>Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={(event) => updateForm('descripcion', event.target.value)}
                rows={3}
                placeholder="¿Qué aprenderán o practicarán los estudiantes?"
                className={`${FIELD_CLASS} resize-y`}
              />
            </div>

            <div className="md:col-span-2">
              <label className={LABEL_CLASS}>Imagen de portada</label>
              <label className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-teal-400 hover:bg-teal-50">
                {cover?.previewUrl ? (
                  <img src={cover.previewUrl} alt="Vista previa de portada" className="h-24 w-36 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-20 w-28 items-center justify-center rounded-xl bg-white text-teal-600 shadow-sm"><Image size={28} /></span>
                )}
                <span>
                  <span className="block text-sm font-extrabold text-slate-800">{cover?.file?.name || 'Seleccionar portada'}</span>
                  <span className="mt-1 block text-xs text-slate-500">Se mostrará en las tarjetas pequeñas de la actividad.</span>
                </span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  if (cover?.previewUrl) URL.revokeObjectURL(cover.previewUrl)
                  setCover({ file, previewUrl: URL.createObjectURL(file) })
                }} />
              </label>
            </div>

            <div className="md:col-span-2">
              <label className={LABEL_CLASS}>Instrucciones</label>
              <textarea
                value={form.instrucciones}
                onChange={(event) => updateForm('instrucciones', event.target.value)}
                rows={3}
                placeholder="Indica cómo responder, qué recursos usar o cuánto tiempo dedicar."
                className={`${FIELD_CLASS} resize-y`}
              />
            </div>
          </div>
        </Card>

        <Card className="border-2 border-slate-200 bg-white p-5 sm:p-6">
          <SectionTitle
            title="Reglas del quiz"
            subtitle="Controla el orden, el tiempo y la retroalimentación del motor."
          />

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className={LABEL_CLASS}>Intentos máximos</label>
              <input
                type="number"
                min="1"
                max="20"
                step="1"
                value={form.intentos_maximos}
                onChange={(event) => updateForm('intentos_maximos', event.target.value)}
                className={FIELD_CLASS}
              />
              {validation.fieldErrors.intentos_maximos && <p className="mt-1 text-xs font-semibold text-rose-700">{validation.fieldErrors.intentos_maximos}</p>}
            </div>
            <div>
              <label className={LABEL_CLASS}>Tiempo global (segundos)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.config.tiempo_global_segundos}
                onChange={(event) => updateConfig('tiempo_global_segundos', event.target.value)}
                className={FIELD_CLASS}
              />
              <p className="mt-1 text-xs text-slate-500">0 significa sin límite global.</p>
              {validation.fieldErrors.tiempo_global_segundos && <p className="mt-1 text-xs font-semibold text-rose-700">{validation.fieldErrors.tiempo_global_segundos}</p>}
            </div>
            <div>
              <label className={LABEL_CLASS}>Porcentaje para aprobar</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={form.config.aprobado_porcentaje}
                  onChange={(event) => updateConfig('aprobado_porcentaje', event.target.value)}
                  className={`${FIELD_CLASS} pr-9`}
                />
                <span className="absolute right-3 top-2.5 text-sm font-bold text-slate-400">%</span>
              </div>
              {validation.fieldErrors.aprobado_porcentaje && <p className="mt-1 text-xs font-semibold text-rose-700">{validation.fieldErrors.aprobado_porcentaje}</p>}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Toggle
              checked={form.config.barajar_preguntas}
              onChange={(value) => updateConfig('barajar_preguntas', value)}
              label="Barajar bloques calificables"
              description="Cambia el orden de las preguntas en cada intento."
            />
            <Toggle
              checked={form.config.barajar_opciones}
              onChange={(value) => updateConfig('barajar_opciones', value)}
              label="Barajar opciones"
              description="Evita que la respuesta correcta quede siempre en la misma posición."
            />
            <Toggle
              checked={form.config.mostrar_feedback}
              onChange={(value) => updateConfig('mostrar_feedback', value)}
              label="Mostrar retroalimentación"
              description="Presenta las explicaciones configuradas después de responder."
            />
            <Toggle
              checked={form.config.mostrar_progreso}
              onChange={(value) => updateConfig('mostrar_progreso', value)}
              label="Mostrar progreso"
              description="Indica cuántos bloques faltan durante el quiz."
            />
            <Toggle
              checked={form.config.sonido}
              onChange={(value) => updateConfig('sonido', value)}
              label="Sonidos de respuesta"
              description="Un tono corto al acertar o fallar; cada estudiante puede silenciarlo."
            />
            <Toggle
              checked={form.config.celebracion}
              onChange={(value) => updateConfig('celebracion', value)}
              label="Celebrar al aprobar"
              description="Confeti y fanfarria en la pantalla de resultado."
            />
          </div>

          <div className="mt-5">
            <label className={LABEL_CLASS}>Color del quiz</label>
            <div className="flex flex-wrap gap-2.5">
              {TEMAS_QUIZ_OPCIONES.map((opcion) => {
                const activo = form.config.tema === opcion.value
                return (
                  <button
                    key={opcion.value}
                    type="button"
                    onClick={() => updateConfig('tema', opcion.value)}
                    aria-pressed={activo}
                    aria-label={opcion.label}
                    title={opcion.label}
                    className="grid h-9 w-9 place-items-center rounded-full transition-transform duration-200 hover:scale-110 active:scale-95"
                    style={{
                      background: opcion.color,
                      boxShadow: activo ? `0 0 0 3px #fff, 0 0 0 5px ${opcion.color}` : '0 2px 6px rgba(0,0,0,.18)',
                    }}
                  >
                    {activo && <Check size={16} className="text-white" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Tiñe la cabecera, la barra de progreso y los realces que ve el estudiante.</p>
          </div>
        </Card>

        <Card className="border-2 border-slate-200 bg-white p-5 sm:p-6">
          <SectionTitle
            title="Añadir un bloque"
            subtitle="Puedes mezclar todos los tipos y reordenarlos después."
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BLOCK_TYPES.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => addBlock(type.value)}
                  className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-teal-400 hover:bg-teal-50 hover:shadow-sm"
                >
                  <span className="rounded-lg bg-white p-2 text-teal-700 shadow-sm"><Icon size={18} /></span>
                  <span>
                    <span className="block text-sm font-extrabold text-slate-900">{type.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{type.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Contenido del quiz</h2>
              <p className="text-sm font-semibold text-slate-500">Usa las flechas para definir el recorrido.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-600">{items.length} bloques</span>
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <Layers3 className="mx-auto mb-3 text-slate-300" size={38} />
              <h3 className="font-extrabold text-slate-800">El quiz todavía está vacío</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Elige arriba una pregunta, ficha o bloque de contenido para comenzar.</p>
            </div>
          ) : (
            items.map((item, index) => (
              <BlockEditor
                key={item.id}
                block={item}
                index={index}
                total={items.length}
                errors={validation.itemErrors[item.id]?.errors}
                onChange={(changes) => updateBlock(item.id, changes)}
                onRemove={() => removeBlock(item.id)}
                onMove={(direction) => moveBlock(index, direction)}
                onTypeChange={(tipo) => changeBlockType(item.id, tipo)}
              />
            ))
          )}
        </section>

        {(submitError || validation.generalErrors.length > 0) && (
          <div id="quiz-builder-errors" role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 flex-shrink-0" size={20} />
              <div>
                <p className="font-extrabold">No se pudo publicar todavía</p>
                {submitError && <p className="mt-0.5 text-sm font-semibold">{submitError}</p>}
                {validation.generalErrors.length > 0 && (
                  <ul className="mt-2 list-inside list-disc text-sm font-semibold">
                    {validation.generalErrors.map((error) => <li key={error}>{error}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {success && (
          <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <div className="flex flex-wrap items-center gap-3">
              <CheckCircle2 className="flex-shrink-0" size={22} />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">Quiz creado correctamente</p>
                <p className="truncate text-sm font-semibold">“{success.title}” ya quedó guardado con todos sus bloques.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(success.id ? `/admin/actividades/${success.id}` : '/admin/actividades')}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-800"
              >
                Ver actividad
              </button>
            </div>
          </div>
        )}

        <div className="sticky bottom-3 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span className="rounded-xl bg-teal-50 p-2 text-teal-700"><Settings2 size={18} /></span>
              <span>
                <strong className="block text-slate-900">{items.length} bloques · {totalPoints} puntos</strong>
                <span className="text-xs">{submitStage || 'Los cambios se guardarán juntos al publicar.'}</span>
              </span>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-teal-700 disabled:cursor-wait disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isSaving ? 'Publicando…' : 'Publicar quiz'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
