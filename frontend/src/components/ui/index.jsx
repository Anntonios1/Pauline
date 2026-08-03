/* =====================================================
   AulaRed 5 — UI Components Index
   Exporta todos los componentes compartidos.
   Las páginas existentes (publications, activities,
   progress) siguen usándolos sin cambios.
   ===================================================== */

/* ---- Button ---- */
export function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary:   'btn-primary',
    secondary: 'btn-secondary',
    outline:   'btn-outline',
    ghost:     'btn-ghost',
  }
  return (
    <button className={`${variants[variant] || variants.primary} ${className}`} {...props}>
      {children}
    </button>
  )
}

/* ---- Card ---- */
export function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div className={`${hover ? 'ar-card-hover' : 'ar-card'} ${className}`} {...props}>
      {children}
    </div>
  )
}

/* ---- Badge ---- */
export function Badge({ children, variant, className = '' }) {
  // Acepta className directo (para areaColors) o variant predefinido
  const variants = {
    teal:   'bg-teal-100 text-teal-700',
    orange: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
    slate:  'bg-slate-100 text-slate-600',
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-700',
    blue:   'bg-blue-100 text-blue-700',
  }
  const base = 'ar-badge'
  const resolved = variant ? (variants[variant] || variants.slate) : ''
  return (
    <span className={`${base} ${resolved} ${className}`}>{children}</span>
  )
}

/* ---- ProgressBar ---- */
export function ProgressBar({ progress, className = '', size = 'md' }) {
  const heights = { sm: '6px', md: '10px', lg: '14px' }
  return (
    <div className={`ar-progress-track ${className}`} style={{ height: heights[size] }}>
      <div
        className="ar-progress-fill"
        style={{ width: `${Math.min(100, Math.max(0, progress || 0))}%` }}
      />
    </div>
  )
}

/* ---- EmptyState ---- */
export function EmptyState({ title, description, icon: Icon, emoji }) {
  return (
    <div className="text-center py-14 px-4 fade-in">
      {emoji && <p className="text-5xl mb-4">{emoji}</p>}
      {Icon && <Icon className="mx-auto h-12 w-12 text-slate-300 mb-4" />}
      <h3 className="text-lg font-extrabold text-slate-900 mb-1">{title}</h3>
      {description && <p className="text-[color:var(--ar-muted)] text-sm max-w-sm mx-auto">{description}</p>}
    </div>
  )
}

/* ---- LoadingState ---- */
export function LoadingState({ message = 'Cargando…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 fade-in">
      <div className="w-10 h-10 border-4 border-[color:var(--ar-primary-light)] border-t-[color:var(--ar-primary)] rounded-full animate-spin mb-4" />
      <p className="text-[color:var(--ar-muted)] font-semibold text-sm">{message}</p>
    </div>
  )
}

/* ---- SectionTitle ---- */
export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-[color:var(--ar-muted)] mt-0.5 font-semibold">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

/* ---- PageHeader ---- */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="ar-card p-6 mb-6 bg-gradient-to-br from-[color:var(--ar-primary)] to-teal-700 text-white">
      <h1 className="text-2xl font-extrabold mb-1">{title}</h1>
      {subtitle && <p className="text-teal-100 text-sm max-w-2xl leading-relaxed">{subtitle}</p>}
      {children}
    </div>
  )
}
