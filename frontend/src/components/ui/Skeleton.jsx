/**
 * Skeletons con la MISMA forma que el contenido real.
 *
 * La idea no es "poner grises": es que la caja que carga ocupe el mismo
 * alto y ritmo que lo que va a aparecer, para que el layout no salte
 * cuando llegan los datos. Las clases (.sk, .sk-line…) viven en
 * styles/index.css, sección 06.
 */

/* Ancho variable para que las líneas no queden como un bloque uniforme */
const ANCHOS = ['92%', '78%', '85%', '64%', '88%', '72%']

export function Skeleton({ className = '', style }) {
  return <div className={`sk ${className}`} style={style} />
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="sk-line" style={{ width: ANCHOS[i % ANCHOS.length] }} />
      ))}
    </div>
  )
}

/** Copia la estructura de PostCard: avatar + meta, título, cuerpo, reacciones. */
export function PostCardSkeleton() {
  return (
    <div className="sk-card mb-3" aria-hidden="true">
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="sk-circle h-11 w-11 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="sk-line w-32" />
          <div className="sk-line h-2.5 w-24" />
        </div>
        <div className="sk h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-2 px-4 pb-3">
        <div className="sk-title w-3/4" />
        <SkeletonText lines={2} />
      </div>
      <div className="flex gap-2 border-t border-[color:var(--ar-border)] px-4 py-3">
        {[0, 1, 2].map(i => <div key={i} className="sk h-7 w-24 rounded-full" />)}
      </div>
    </div>
  )
}

/** Copia la tarjeta de reto rápido (128×168 con scroll horizontal). */
export function ChallengeCardSkeleton() {
  return <div className="sk shrink-0" style={{ width: 128, height: 168, borderRadius: 'var(--ar-radius-md)' }} aria-hidden="true" />
}

/** Copia las tarjetas de Lecturas / Actividades: portada + texto + pie. */
export function GridCardSkeleton({ conPortada = false }) {
  return (
    <div className="sk-card h-full" aria-hidden="true">
      {conPortada && <div className="sk h-32 rounded-none" />}
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          <div className="sk h-10 w-10 rounded-lg shrink-0" />
          <div className="sk h-5 w-24 rounded-full" />
        </div>
        <div className="sk-title w-4/5" />
        <SkeletonText lines={2} />
        <div className="flex items-center justify-between pt-1">
          <div className="sk-line h-2.5 w-20" />
          <div className="sk-line h-2.5 w-16" />
        </div>
      </div>
    </div>
  )
}

/** Fila de lista (rankings, progreso, estudiantes). */
export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3" aria-hidden="true">
      <div className="sk-circle h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="sk-line w-2/5" />
        <div className="sk-line h-2.5 w-1/4" />
      </div>
    </div>
  )
}

/**
 * Envuelve cualquier skeleton para anunciarlo a lectores de pantalla y
 * repetirlo n veces. `label` describe qué se está cargando.
 */
export function SkeletonGroup({ count = 3, label = 'Cargando contenido', children, className = '' }) {
  return (
    <div className={className} role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>{children}</div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  )
}
