import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useData } from '../../contexts/DataContext'
import * as api from '../../services/api'
import { ChevronLeft, ChevronRight, Send, X, CheckCircle, AlertCircle, Image as ImageIcon, Loader, Paperclip } from 'lucide-react'
import PublicationStylePicker from '../../components/publications/PublicationStylePicker'
import ResourceLibraryPicker from '../../components/media/ResourceLibraryPicker'

/* ---- Paso 1: Propósito ---- */
const PROPOSITOS = [
  { key: 'aprendizaje', emoji: '💡', label: 'Algo que aprendí',      desc: 'Comparte un descubrimiento' },
  { key: 'pregunta',    emoji: '❓', label: 'Una pregunta',          desc: 'Consulta a tus compañeros o docente' },
  { key: 'solucion',    emoji: '🧮', label: 'La solución de un reto', desc: 'Muestra cómo resolviste algo' },
  { key: 'observacion', emoji: '🌱', label: 'Una observación',       desc: 'Algo que notaste en la naturaleza' },
  { key: 'dibujo',      emoji: '🎨', label: 'Un dibujo o esquema',   desc: 'Explica con imágenes' },
  { key: 'evidencia',   emoji: '📷', label: 'Una evidencia',         desc: 'Foto de tu tarea o experimento' },
]

const PROPOSITOS_DOCENTE = [
  { key: 'lectura', emoji: '📚', label: 'Una lectura guiada', desc: 'Explica un tema para tu grupo' },
  { key: 'aviso', emoji: '📣', label: 'Un aviso de clase', desc: 'Comparte una indicación importante' },
  { key: 'recurso', emoji: '📎', label: 'Un recurso recomendado', desc: 'Presenta material para explorar' },
  { key: 'reto', emoji: '⚡', label: 'Un reto de aprendizaje', desc: 'Invita a practicar antes del quiz' },
]

/* ---- Paso 2: Temas (area → se mapea a categoria_id) ---- */
const TEMAS = [
  { key: 'cuerpo_humano',                  label: 'Conociendo mi cuerpo',      emoji: '🫀' },
  { key: 'pubertad',                       label: 'La pubertad',               emoji: '🌱' },
  { key: 'sistema_reproductor_femenino',   label: 'Sist. reproductor femenino',emoji: '🌸' },
  { key: 'sistema_reproductor_masculino',  label: 'Sist. reproductor masculino',emoji: '🚹' },
  { key: 'celulas_reproductoras',          label: 'Células reproductoras',     emoji: '🔬' },
  { key: 'fecundacion',                    label: 'Fecundación y embarazo',    emoji: '🐣' },
  { key: 'embarazo',                       label: 'Embarazo',                  emoji: '🤰' },
  { key: 'nacimiento',                     label: 'Nacimiento',               emoji: '👶' },
  { key: 'autocuidado',                    label: 'Autocuidado y respeto',      emoji: '💚' },
  { key: 'preguntas_frecuentes',           label: 'Preguntas frecuentes',      emoji: '❓' },
]

/* ---- Checklist de revisión (Paso 4) ---- */
const CHECKLIST = [
  '¿Escribiste con respeto hacia todos?',
  '¿No pusiste teléfonos ni direcciones?',
  '¿La imagen es apropiada para la clase?',
  '¿Explicaste con tus propias palabras?',
  '¿Mencionaste la fuente que consultaste?',
]

const TOTAL_STEPS = 5
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5 MB

export default function CreatePage() {
  const { user } = useAuth()
  const { categories, refresh } = useData()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isTeacher = ['docente', 'administrador'].includes(user?.rol)
  const propositosDisponibles = isTeacher ? PROPOSITOS_DOCENTE : PROPOSITOS

  const [step, setStep] = useState(1)
  const [proposito, setProposito] = useState(searchParams.get('tipo') || '')
  const [tema, setTema] = useState('')
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [fuente, setFuente] = useState('')
  const [pregunta, setPregunta] = useState('')
  const [checks, setChecks] = useState(new Array(CHECKLIST.length).fill(false))
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageError, setImageError] = useState('')
  const [imageUploadWarning, setImageUploadWarning] = useState('')
  const [estiloVisual, setEstiloVisual] = useState({ acento: 'turquesa', patron: 'liso' })
  const [etiquetas, setEtiquetas] = useState([])
  const [etiquetasSugeridas, setEtiquetasSugeridas] = useState([])
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')
  const [recursosAdjuntos, setRecursosAdjuntos] = useState([])
  const [showLibrary, setShowLibrary] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    api.getTags().then(setEtiquetasSugeridas).catch(() => {})
  }, [])

  const alternarEtiqueta = (nombre) => {
    setEtiquetas(actuales => actuales.includes(nombre)
      ? actuales.filter(e => e !== nombre)
      : [...actuales, nombre])
  }

  const agregarEtiquetaNueva = () => {
    const nombre = nuevaEtiqueta.trim()
    if (!nombre || etiquetas.includes(nombre)) return
    setEtiquetas(actuales => [...actuales, nombre])
    setNuevaEtiqueta('')
  }

  const canNext = () => {
    if (step === 1) return !!proposito
    if (step === 2) return !!tema
    if (step === 3) return titulo.trim().length > 2 && contenido.trim().length > 10
    if (step === 4) return isTeacher || checks.every(Boolean)
    return true
  }

  const handleCheck = (i) => {
    const nuevo = [...checks]
    nuevo[i] = !nuevo[i]
    setChecks(nuevo)
  }

  const handleImageChange = (e) => {
    setImageError('')
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImageError('Formato no permitido. Usa JPG, PNG o WEBP.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError('La imagen es demasiado grande (máx 5 MB).')
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setImageError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const temaObj = TEMAS.find(t => t.key === tema)
  const categoria = categories.find(c => c.area === tema)
  const propositoObj = propositosDisponibles.find(p => p.key === proposito)

  // `fuente` y `pregunta` no tienen columna propia: se anexan al cuerpo para no perderse.
  const buildContenido = () => {
    const partes = [contenido.trim()]
    if (pregunta.trim()) partes.push(`Pregunta para mis compañeros: ${pregunta.trim()}`)
    if (fuente.trim()) partes.push(`Fuente consultada: ${fuente.trim()}`)
    return partes.join('\n\n')
  }

  const handleEnviar = async () => {
    if (submitting) return
    setSubmitting(true)
    setError('')
    setImageUploadWarning('')
    try {
      const cuerpo = buildContenido()
      const resumen = cuerpo.length > 120 ? cuerpo.slice(0, 117) + '...' : cuerpo

      let created
      try {
        created = await api.createPublication({
          titulo: titulo.trim(),
          contenido: cuerpo,
          resumen,
          categoria_id: categoria?.id || null,
          estado: isTeacher ? 'aprobada' : 'enviada',
          visibilidad: 'publica',
          estilo_visual: estiloVisual,
        })
      } catch (err) {
        throw new Error(err.message || 'No se pudo enviar la publicación')
      }

      const pubId = created?.id
      if (pubId && imageFile) {
        try {
          await api.uploadCoverImage(pubId, imageFile)
        } catch (err) {
          setImageUploadWarning(`La publicación se envió, pero no se pudo guardar la imagen: ${err.message}`)
        }
      }
      if (pubId && recursosAdjuntos.length) {
        try {
          await Promise.all(recursosAdjuntos.map(r => api.addResourceToPublication(pubId, r.id)))
        } catch (err) {
          setImageUploadWarning(`La publicación se envió, pero no se pudieron adjuntar todos los recursos: ${err.message}`)
        }
      }
      if (pubId && etiquetas.length) {
        try {
          await api.setPublicationTags(pubId, etiquetas)
        } catch (err) {
          setImageUploadWarning(`La publicación se envió, pero no se pudieron guardar las etiquetas: ${err.message}`)
        }
      }

      // Refrescar la data global para que aparezca en moderación / perfil
      try { await refresh() } catch {}

      setEnviado(true)
      setTimeout(() => navigate(isTeacher ? '/admin/lecturas' : '/'), 2500)
    } catch (err) {
      setError(err.message || 'Ocurrió un error al enviar')
    } finally {
      setSubmitting(false)
    }
  }

  /* ---- Enviado ---- */
  if (enviado) {
    return (
      <div className="feed-container flex flex-col items-center justify-center min-h-[70vh] text-center fade-in">
        <div className="w-24 h-24 bg-[color:var(--ar-primary-light)] rounded-full flex items-center justify-center mb-6">
          <CheckCircle size={52} className="text-[color:var(--ar-primary)]" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">
          {isTeacher ? '¡Publicación creada!' : '¡Enviado al docente!'}
        </h2>
        <p className="text-[color:var(--ar-muted)] text-sm max-w-xs leading-relaxed">
          {isTeacher
            ? <>Tu publicación "<strong>{titulo}</strong>" ya está publicada y visible para tu grupo.</>
            : <>Tu publicación "<strong>{titulo}</strong>" fue enviada para revisión. El docente podrá aprobarla o enviarte recomendaciones.</>}
        </p>
        {imageUploadWarning && (
          <div className="mt-4 max-w-sm rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-left">
            <p className="text-xs font-semibold text-yellow-800">{imageUploadWarning}</p>
          </div>
        )}
        <p className="text-xs text-[color:var(--ar-subtle)] mt-4">Regresando…</p>
      </div>
    )
  }

  return (
    <div className="feed-container pb-24 md:pb-8 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1">
          <h1 className="font-extrabold text-slate-900 text-lg">Nueva publicación</h1>
          <p className="text-xs text-[color:var(--ar-muted)] font-semibold">Paso {step} de {TOTAL_STEPS}</p>
        </div>
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
          <X size={20} />
        </button>
      </div>

      {/* Indicador de progreso */}
      <div className="flex items-center gap-1.5 mb-6">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} className={`step-dot ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}`} />
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 mt-4 mb-4 p-3 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-red-800">{error}</p>
        </div>
      )}

      {/* ===== Paso 1 — Propósito ===== */}
      {step === 1 && (
        <section className="scale-in">
          <h2 className="text-xl font-extrabold text-slate-900 mb-1">¿Qué quieres compartir?</h2>
          <p className="text-sm text-[color:var(--ar-muted)] mb-5">Elige el tipo de publicación</p>
          <div className="grid grid-cols-2 gap-3">
            {propositosDisponibles.map(p => (
              <button
                key={p.key}
                onClick={() => setProposito(p.key)}
                className={`ar-card p-4 text-left transition-all active:scale-95 ${
                  proposito === p.key
                    ? 'border-2 border-[color:var(--ar-primary)] bg-[color:var(--ar-primary-light)]'
                    : 'hover:shadow-md'
                }`}
              >
                <span className="text-2xl block mb-2">{p.emoji}</span>
                <p className="font-extrabold text-sm text-slate-900">{p.label}</p>
                <p className="text-xs text-[color:var(--ar-muted)] mt-0.5 leading-snug">{p.desc}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ===== Paso 2 — Tema ===== */}
      {step === 2 && (
        <section className="scale-in">
          <h2 className="text-xl font-extrabold text-slate-900 mb-1">¿Sobre qué tema?</h2>
          <p className="text-sm text-[color:var(--ar-muted)] mb-5">Selecciona el área de tu publicación</p>
          <div className="grid grid-cols-2 gap-2">
            {TEMAS.map(t => (
              <button
                key={t.key}
                onClick={() => setTema(t.key)}
                className={`ar-card p-3 flex items-center gap-2 text-left transition-all active:scale-95 ${
                  tema === t.key
                    ? 'border-2 border-[color:var(--ar-primary)] bg-[color:var(--ar-primary-light)]'
                    : 'hover:shadow-md'
                }`}
              >
                <span className="text-xl flex-shrink-0">{t.emoji}</span>
                <span className="font-bold text-xs text-slate-900 leading-tight">{t.label}</span>
                {tema === t.key && <CheckCircle size={14} className="ml-auto text-[color:var(--ar-primary)] flex-shrink-0" />}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ===== Paso 3 — Contenido ===== */}
      {step === 3 && (
        <section className="scale-in space-y-4">
          <h2 className="text-xl font-extrabold text-slate-900 mb-1">Crea tu publicación</h2>
          <p className="text-sm text-[color:var(--ar-muted)] mb-5">Escribe con claridad y respeto</p>

          {/* Subida de imagen de portada */}
          <div>
            <label className="block text-sm font-extrabold text-slate-700 mb-1.5">
              Imagen de portada <span className="font-normal text-[color:var(--ar-muted)]">(opcional)</span>
            </label>
            {!imagePreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full ar-card p-6 flex flex-col items-center justify-center gap-2 text-slate-500 hover:bg-slate-50 hover:border-[color:var(--ar-primary)] transition-all"
              >
                <ImageIcon size={28} className="text-slate-400" />
                <p className="text-sm font-bold text-slate-700">Toca para agregar una imagen</p>
                <p className="text-xs text-[color:var(--ar-muted)]">JPG, PNG o WEBP · máx 5 MB</p>
              </button>
            ) : (
              <div className="ar-card overflow-hidden">
                <div className="relative">
                  <img src={imagePreview} alt="Vista previa" className="w-full max-h-56 object-cover" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    aria-label="Quitar imagen"
                  >
                    <X size={16} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 text-xs font-bold text-[color:var(--ar-primary)] hover:bg-slate-50 transition-colors"
                >
                  Cambiar imagen
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="hidden"
            />
            {imageError && (
              <p className="text-xs font-semibold text-red-600 mt-1.5">{imageError}</p>
            )}
          </div>

          {isTeacher && (
            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5">
                Recursos adjuntos <span className="font-normal text-[color:var(--ar-muted)]">(opcional)</span>
              </label>
              {recursosAdjuntos.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {recursosAdjuntos.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                      <span className="truncate">{r.nombre}</span>
                      <button type="button" onClick={() => setRecursosAdjuntos(recursosAdjuntos.filter(x => x.id !== r.id))} className="text-slate-400 hover:text-rose-600">
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => setShowLibrary(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[color:var(--ar-primary)] px-3 py-2 text-xs font-bold text-[color:var(--ar-primary)] hover:bg-[color:var(--ar-primary-light)]"
              >
                <Paperclip size={14} /> Adjuntar PDF, audio o imagen de mi biblioteca
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Título *</label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Un título claro y descriptivo"
              className="ar-input"
              maxLength={100}
            />
            <p className="text-xs text-[color:var(--ar-subtle)] mt-1 text-right">{titulo.length}/100</p>
          </div>

          <div>
            <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Explicación *</label>
            <textarea
              value={contenido}
              onChange={e => setContenido(e.target.value)}
              placeholder="Explica con tus propias palabras lo que quieres compartir…"
              className="ar-input resize-none"
              rows={6}
              maxLength={800}
            />
            <p className="text-xs text-[color:var(--ar-subtle)] mt-1 text-right">{contenido.length}/800</p>
          </div>

          <div>
            <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Fuente consultada <span className="font-normal text-[color:var(--ar-muted)]">(recomendada)</span></label>
            <input
              type="text"
              value={fuente}
              onChange={e => setFuente(e.target.value)}
              placeholder="Libro, sitio web, video…"
              className="ar-input"
            />
          </div>

          <div>
            <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Pregunta para tus compañeros <span className="font-normal text-[color:var(--ar-muted)]">(opcional)</span></label>
            <input
              type="text"
              value={pregunta}
              onChange={e => setPregunta(e.target.value)}
              placeholder="¿Sabían que…? ¿Qué opinan de…?"
              className="ar-input"
            />
          </div>

          <div className="rounded-2xl border border-[color:var(--ar-border)] p-4">
            <p className="mb-1 text-sm font-extrabold text-slate-700">Etiquetas</p>
            <p className="mb-3 text-xs text-[color:var(--ar-muted)]">
              Opcional. Sirven para agrupar publicaciones por tus propios criterios (por ejemplo
              «Laboratorio» o «Refuerzo»); no reemplazan al tema.
            </p>

            {etiquetas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {etiquetas.map(nombre => (
                  <button
                    key={nombre}
                    type="button"
                    onClick={() => alternarEtiqueta(nombre)}
                    className="inline-flex items-center gap-1 rounded-full bg-[color:var(--ar-primary)] px-2.5 py-1 text-[11px] font-bold text-white"
                  >
                    {nombre} <X size={12} />
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={nuevaEtiqueta}
                onChange={e => setNuevaEtiqueta(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarEtiquetaNueva() } }}
                placeholder="Crear una etiqueta nueva"
                maxLength={40}
                className="ar-input flex-1"
              />
              <button
                type="button"
                onClick={agregarEtiquetaNueva}
                disabled={!nuevaEtiqueta.trim()}
                className="rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                Añadir
              </button>
            </div>

            {etiquetasSugeridas.filter(e => !etiquetas.includes(e.nombre)).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {etiquetasSugeridas
                  .filter(e => !etiquetas.includes(e.nombre))
                  .map(etiqueta => (
                    <button
                      key={etiqueta.id}
                      type="button"
                      onClick={() => alternarEtiqueta(etiqueta.nombre)}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                    >
                      + {etiqueta.nombre}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[color:var(--ar-border)] p-4">
            <p className="mb-3 text-sm font-extrabold text-slate-700">Apariencia de tu publicación</p>
            <PublicationStylePicker value={estiloVisual} onChange={setEstiloVisual} />
          </div>
        </section>
      )}

      {/* ===== Paso 4 — Revisión ===== */}
      {step === 4 && (
        <section className="scale-in">
          <h2 className="text-xl font-extrabold text-slate-900 mb-1">Revisa antes de {isTeacher ? 'publicar' : 'enviar'}</h2>
          <p className="text-sm text-[color:var(--ar-muted)] mb-5">
            {isTeacher ? 'Comprueba que todo está como quieres' : 'Confirma que tu publicación cumple las normas de la clase'}
          </p>

          <div className="ar-card overflow-hidden mb-4">
            {imagePreview && (
              <img src={imagePreview} alt="Portada" className="w-full max-h-44 object-cover" />
            )}
            <div className="p-4">
              <p className="text-xs font-extrabold text-[color:var(--ar-muted)] uppercase tracking-wide mb-1">Vista previa</p>
              <p className="font-extrabold text-slate-900">{titulo}</p>
              <p className="text-sm text-slate-700 mt-1 line-clamp-3">{contenido}</p>
              {pregunta && <p className="text-xs text-slate-600 mt-2 italic">Pregunta: {pregunta}</p>}
              {fuente && <p className="text-xs text-[color:var(--ar-muted)] mt-2">Fuente: {fuente}</p>}
            </div>
          </div>

          {!isTeacher && (
            <>
              <div className="space-y-3">
                {CHECKLIST.map((item, i) => (
                  <label
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      checks[i] ? 'bg-[color:var(--ar-primary-light)]' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                      checks[i] ? 'bg-[color:var(--ar-primary)] border-[color:var(--ar-primary)]' : 'border-slate-300'
                    }`}>
                      {checks[i] && <CheckCircle size={12} className="text-white" />}
                    </div>
                    <span className={`text-sm font-semibold leading-snug ${checks[i] ? 'text-[color:var(--ar-primary-dark)]' : 'text-slate-700'}`}>
                      ✓ {item}
                    </span>
                    <input type="checkbox" checked={checks[i]} onChange={() => handleCheck(i)} className="sr-only" />
                  </label>
                ))}
              </div>

              {!checks.every(Boolean) && (
                <div className="flex items-center gap-2 mt-4 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                  <AlertCircle size={16} className="text-yellow-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-yellow-800">
                    Confirma todos los puntos para continuar
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ===== Paso 5 — Enviar ===== */}
      {step === 5 && (
        <section className="scale-in text-center py-6">
          <div className="w-20 h-20 mx-auto bg-[color:var(--ar-primary-light)] rounded-full flex items-center justify-center mb-5">
            <Send size={36} className="text-[color:var(--ar-primary)]" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mb-2">
            {isTeacher ? '¡Listo para publicar!' : '¡Listo para enviar!'}
          </h2>
          <p className="text-sm text-[color:var(--ar-muted)] max-w-xs mx-auto leading-relaxed mb-6">
            {isTeacher
              ? <>Tu publicación <strong>"{titulo}"</strong> se publicará de inmediato y será visible para tu grupo.</>
              : <>Tu publicación <strong>"{titulo}"</strong> será enviada al docente para su revisión. Todavía no será visible para tus compañeros.</>}
          </p>
          <div className="ar-card p-4 mb-6 text-left space-y-2 max-w-xs mx-auto">
            <div className="flex justify-between text-sm">
              <span className="text-[color:var(--ar-muted)] font-semibold">Tipo</span>
              <span className="font-bold capitalize">{propositoObj?.emoji} {proposito}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[color:var(--ar-muted)] font-semibold">Tema</span>
              <span className="font-bold">{temaObj?.emoji} {temaObj?.label}</span>
            </div>
            {imageFile && (
              <div className="flex justify-between text-sm">
                <span className="text-[color:var(--ar-muted)] font-semibold">Imagen</span>
                <span className="font-bold text-green-600">Included ✓</span>
              </div>
            )}
          </div>
          <button
            onClick={handleEnviar}
            disabled={submitting}
            className="btn-primary px-10 py-4 text-lg disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {submitting ? <Loader size={20} className="animate-spin" /> : <Send size={20} />}
            {submitting ? 'Enviando...' : isTeacher ? 'Publicar ahora' : 'Enviar a mi docente'}
          </button>
          <p className="text-xs text-[color:var(--ar-subtle)] mt-3">
            {isTeacher
              ? 'Podrás editarla o archivarla después desde tus lecturas'
              : 'El docente la revisará y podrá aprobarla o enviarte recomendaciones'}
          </p>
        </section>
      )}

      {/* ===== Botones de navegación ===== */}
      {step < TOTAL_STEPS && (
        <div className="sticky bottom-2 left-0 right-0 px-1 md:relative md:bottom-auto md:mt-8 z-20">
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext()}
            className="btn-primary w-full py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shadow-lg md:shadow-none"
          >
            {step === TOTAL_STEPS - 1 ? 'Revisar publicación' : 'Continuar'}
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {showLibrary && (
        <ResourceLibraryPicker
          onClose={() => setShowLibrary(false)}
          onSelect={(elegido) => {
            if (!recursosAdjuntos.some(r => r.id === elegido.id)) setRecursosAdjuntos([...recursosAdjuntos, elegido])
            setShowLibrary(false)
          }}
        />
      )}
    </div>
  )
}
