/* Motor de medios del quiz: un solo lugar que sabe pintar cada tipo de archivo.
 *
 * Lo usan tanto el reproductor (UnifiedQuiz) como la vista previa del creador,
 * para que el docente vea exactamente lo mismo que verá el estudiante.
 *
 * La idea de fondo es no sacar al estudiante de la actividad: un PDF se lee
 * dentro, un video se reproduce dentro. Antes todo lo que no fuera imagen o
 * audio era un enlace "Abrir" que mandaba a otra pestaña.
 */
import { useRef, useState } from 'react'
import {
  Download, ExternalLink, FileText, Gamepad2, Headphones, Maximize2,
  Pause, Play, Volume2, VolumeX,
} from 'lucide-react'
import ImageViewer from './ImageViewer'

const VELOCIDADES = [0.75, 1, 1.25, 1.5]

/** Extensiones que el navegador reproduce como video sin ayuda de nadie. */
const EXT_VIDEO = /\.(mp4|webm|ogv|m4v|mov)(\?|$)/i

const HOSTS_CONFIABLES = [
  'wordwall.net', 'youtube.com', 'youtube-nocookie.com', 'youtu.be',
  'vimeo.com', 'drive.google.com',
]

/** Espejo de `_embed_kind` (api/services/quizzes.py) para avisar al docente en
 *  el creador cómo se va a incrustar su enlace ANTES de guardar. La palabra
 *  final la tiene el backend: esto es solo la vista previa. */
export function clasificarEmbed(url) {
  try {
    const u = new URL(url)
    if (EXT_VIDEO.test(u.pathname)) return 'video'
    const host = u.hostname.toLowerCase()
    const confiable = HOSTS_CONFIABLES.some(h => host === h || host.endsWith(`.${h}`))
    return confiable ? 'trusted' : 'external'
  } catch {
    return 'external'
  }
}

/* Las plataformas conocidas necesitan su URL de incrustación, que no es la
   misma que la de la barra de direcciones. El backend ya clasificó el enlace
   (config.embed_kind); aquí solo se traduce la URL a su forma incrustable. */
export function urlDeIncrustacion(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')

    if (host === 'youtu.be') {
      return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.pathname.startsWith('/embed/')) return url
      const id = u.searchParams.get('v')
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`
    }
    if (host.endsWith('vimeo.com') && !host.startsWith('player.')) {
      const id = u.pathname.split('/').filter(Boolean)[0]
      if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`
    }
    if (host === 'drive.google.com' && u.pathname.includes('/file/')) {
      return url.replace(/\/view.*$/, '/preview')
    }
    return url
  } catch {
    return url
  }
}

function nombreDeArchivo(entry) {
  if (entry.title) return entry.title
  try {
    const ruta = new URL(entry.url, 'http://local').pathname
    return decodeURIComponent(ruta.split('/').filter(Boolean).pop() || 'Archivo adjunto')
  } catch {
    return 'Archivo adjunto'
  }
}

function formatoTiempo(segundos) {
  if (!Number.isFinite(segundos)) return '0:00'
  const m = Math.floor(segundos / 60)
  const s = Math.floor(segundos % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/* ── Imagen ──────────────────────────────────────────────────────────────── */

function VisorImagen({ entry, compact }) {
  const [ampliada, setAmpliada] = useState(false)

  return (
    <>
      <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <button
          type="button"
          onClick={() => setAmpliada(true)}
          className="block w-full cursor-zoom-in"
          aria-label={`Ampliar ${entry.alt || entry.title || 'imagen'}`}
        >
          <img
            src={entry.url}
            alt={entry.alt || entry.title || 'Imagen del bloque'}
            className={`${compact ? 'max-h-36' : 'max-h-80'} w-full object-contain`}
            loading="lazy"
          />
        </button>
        {entry.title && (
          <figcaption className="border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
            {entry.title}
          </figcaption>
        )}
      </figure>

      {ampliada && (
        <ImageViewer
          url={entry.url}
          alt={entry.alt || entry.title || ''}
          onClose={() => setAmpliada(false)}
        />
      )}
    </>
  )
}

/* ── Audio ───────────────────────────────────────────────────────────────── */

function VisorAudio({ entry }) {
  const audioRef = useRef(null)
  const [velocidad, setVelocidad] = useState(1)

  const cambiarVelocidad = () => {
    const siguiente = VELOCIDADES[(VELOCIDADES.indexOf(velocidad) + 1) % VELOCIDADES.length]
    setVelocidad(siguiente)
    if (audioRef.current) audioRef.current.playbackRate = siguiente
  }

  return (
    <div
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
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold" style={{ color: 'var(--ar-primary-dark)' }}>
            {entry.title || 'Escucha este audio'}
          </p>
          <p className="text-xs text-[color:var(--ar-muted)]">
            Puedes reproducirlo las veces que necesites.
          </p>
        </div>
        {/* Bajar la velocidad ayuda a seguir una consigna hablada larga. */}
        <button
          type="button"
          onClick={cambiarVelocidad}
          className="shrink-0 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-black text-[color:var(--ar-primary-dark)] hover:bg-white"
          aria-label={`Velocidad de reproducción: ${velocidad}x`}
        >
          {velocidad}x
        </button>
      </div>
      <audio ref={audioRef} controls preload="metadata" className="w-full" src={entry.url}>
        Tu navegador no puede reproducir este audio.
      </audio>
    </div>
  )
}

/* ── Video ───────────────────────────────────────────────────────────────── */

function VisorVideo({ entry }) {
  const videoRef = useRef(null)
  const [reproduciendo, setReproduciendo] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [duracion, setDuracion] = useState(0)
  const [silenciado, setSilenciado] = useState(false)
  const [velocidad, setVelocidad] = useState(1)

  const alternarPlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play()
    else video.pause()
  }

  const buscar = (event) => {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration)) return
    video.currentTime = (Number(event.target.value) / 100) * video.duration
  }

  const cambiarVelocidad = () => {
    const siguiente = VELOCIDADES[(VELOCIDADES.indexOf(velocidad) + 1) % VELOCIDADES.length]
    setVelocidad(siguiente)
    if (videoRef.current) videoRef.current.playbackRate = siguiente
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 sm:col-span-2">
      {entry.title && (
        <p className="border-b border-slate-800 px-3 py-2 text-sm font-bold text-slate-200">
          {entry.title}
        </p>
      )}
      <video
        ref={videoRef}
        src={entry.url}
        className="w-full bg-black"
        preload="metadata"
        playsInline
        onClick={alternarPlay}
        onPlay={() => setReproduciendo(true)}
        onPause={() => setReproduciendo(false)}
        onLoadedMetadata={(event) => setDuracion(event.currentTarget.duration)}
        onTimeUpdate={(event) => {
          const video = event.currentTarget
          setProgreso(video.duration ? (video.currentTime / video.duration) * 100 : 0)
        }}
      >
        Tu navegador no puede reproducir este video.
      </video>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={alternarPlay}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-slate-900 hover:bg-slate-200"
          aria-label={reproduciendo ? 'Pausar' : 'Reproducir'}
        >
          {reproduciendo ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
        </button>

        {/* El seek solo funciona porque /uploads responde a peticiones Range. */}
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progreso}
          onChange={buscar}
          className="h-1.5 min-w-24 flex-1 cursor-pointer accent-teal-400"
          aria-label="Avanzar o retroceder el video"
        />

        <span className="shrink-0 font-mono text-xs text-slate-300">
          {formatoTiempo((progreso / 100) * duracion)} / {formatoTiempo(duracion)}
        </span>

        <button
          type="button"
          onClick={() => {
            const video = videoRef.current
            if (!video) return
            video.muted = !video.muted
            setSilenciado(video.muted)
          }}
          className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-white/10"
          aria-label={silenciado ? 'Activar sonido' : 'Silenciar'}
        >
          {silenciado ? <VolumeX size={17} /> : <Volume2 size={17} />}
        </button>

        <button
          type="button"
          onClick={cambiarVelocidad}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-black text-slate-300 hover:bg-white/10"
          aria-label={`Velocidad: ${velocidad}x`}
        >
          {velocidad}x
        </button>

        <button
          type="button"
          onClick={() => videoRef.current?.requestFullscreen?.()}
          className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-white/10"
          aria-label="Pantalla completa"
        >
          <Maximize2 size={17} />
        </button>
      </div>
    </div>
  )
}

/* ── PDF ─────────────────────────────────────────────────────────────────── */

function VisorPdf({ entry }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 sm:col-span-2">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <FileText size={17} className="shrink-0 text-indigo-600" />
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
          {nombreDeArchivo(entry)}
        </p>
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200"
        >
          Pantalla completa <ExternalLink size={12} />
        </a>
        <a
          href={entry.url}
          download
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200"
        >
          <Download size={12} /> Descargar
        </a>
      </div>
      {/* Se lee aquí mismo: el visor nativo del navegador dentro de la app.
          Requiere X-Frame-Options: SAMEORIGIN en /uploads (ver api/app.py). */}
      <iframe
        src={`${entry.url}#view=FitH`}
        title={nombreDeArchivo(entry)}
        className="h-[65vh] max-h-[560px] w-full bg-slate-100"
        loading="lazy"
      />
    </div>
  )
}

/* ── Otros archivos ──────────────────────────────────────────────────────── */

function TarjetaArchivo({ entry }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
        <FileText size={21} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{nombreDeArchivo(entry)}</p>
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
      <a
        href={entry.url}
        download
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
      >
        Descargar
      </a>
    </div>
  )
}

/* ── Incrustaciones ──────────────────────────────────────────────────────── */

/**
 * Incrusta un enlace externo según la capa que decidió el backend (`kind`):
 *  - "video"    → archivo de video de cualquier dominio, con <video>. No hay
 *                 iframe, así que el tercero no ejecuta código en la página.
 *  - "trusted"  → plataforma conocida (Wordwall/YouTube/Vimeo/Drive).
 *  - "external" → cualquier otra página: iframe SIN allow-same-origin, para
 *                 que no pueda leer la sesión ni suplantar la app, y con el
 *                 dominio a la vista.
 */
export function EmbedExterno({ url, kind = 'trusted', titulo }) {
  if (!url) return null

  if (kind === 'video' || EXT_VIDEO.test(url)) {
    return <VisorVideo entry={{ url, title: titulo }} />
  }

  const esConfiable = kind === 'trusted'
  const src = urlDeIncrustacion(url)
  let dominio = ''
  try { dominio = new URL(url).hostname.replace(/^www\./, '') } catch { dominio = 'sitio externo' }

  return (
    <div
      className="a-fade-up my-5 overflow-hidden rounded-2xl border"
      style={{ borderColor: 'var(--ar-border)' }}
    >
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <iframe
          src={src}
          title={titulo || `Contenido incrustado de ${dominio}`}
          className="absolute inset-0 h-full w-full"
          sandbox={esConfiable
            ? 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation'
            : 'allow-scripts allow-popups'}
          loading="lazy"
          allowFullScreen
        />
      </div>
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs"
        style={{ borderColor: 'var(--ar-border)', background: 'var(--ar-surface-2)' }}
      >
        <span className="flex items-center gap-1.5 font-bold text-[color:var(--ar-muted)]">
          <Gamepad2 size={14} /> {dominio}
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

/* ── Galería ─────────────────────────────────────────────────────────────── */

/** Pinta una lista de medios ya normalizados ({ kind, url, alt, title }). */
export default function MediaEngine({ media, compact = false, className = '' }) {
  if (!media?.length) return null

  // Solo las imágenes se reparten en dos columnas; el resto ocupa el ancho.
  const variasImagenes = media.filter((entry) => entry.kind === 'image').length > 1

  return (
    <div className={`grid gap-3 ${compact ? 'mt-3' : 'my-5'} ${variasImagenes ? 'sm:grid-cols-2' : ''} ${className}`}>
      {media.map((entry, index) => {
        const key = `${entry.url}-${index}`
        if (entry.kind === 'audio') return <VisorAudio key={key} entry={entry} />
        if (entry.kind === 'video') return <VisorVideo key={key} entry={entry} />
        if (entry.kind === 'image') return <VisorImagen key={key} entry={entry} compact={compact} />
        // En compacto (dentro de una opción) un PDF a media pantalla estorba.
        const esPdf = /\.pdf(\?|$)/i.test(entry.url) || /pdf/i.test(entry.mime || '')
        if (esPdf && !compact) return <VisorPdf key={key} entry={entry} />
        return <TarjetaArchivo key={key} entry={entry} />
      })}
    </div>
  )
}
