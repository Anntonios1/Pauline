import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { GraduationCap, Lock, User, Shield } from 'lucide-react'

function getDestinationForRole(rol, fromPath) {
  if (fromPath && fromPath !== '/login') {
    if (rol === 'estudiante' && fromPath.startsWith('/admin')) return '/'
    return fromPath
  }
  return rol === 'administrador' || rol === 'docente' ? '/admin' : '/'
}

export default function LoginPage() {
  const [codigo, setCodigo]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { login, isAuthenticated, user } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  useEffect(() => {
    if (!isAuthenticated || !user) return
    navigate(getDestinationForRole(user.rol, location.state?.from?.pathname), { replace: true })
  }, [isAuthenticated, user, location.state, navigate])

  if (isAuthenticated && user) return null

  /* Login real por API */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Credenciales inválidas')

      login(data.token, data.usuario)
      navigate(getDestinationForRole(data.usuario.rol, location.state?.from?.pathname), { replace: true })
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-[color:var(--ar-primary)] to-teal-700 flex items-center justify-center text-white mb-4 shadow-xl"
            style={{ boxShadow: '0 8px 32px rgba(14,165,165,0.35)' }}>
            <GraduationCap size={38} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">AulaRed 5</h1>
          <p className="text-[color:var(--ar-muted)] mt-1 font-semibold">Aprende, crea y comparte con tu clase</p>
        </div>

        {/* Formulario */}
        <div className="ar-card p-6">
          <h2 className="text-lg font-extrabold text-slate-900 mb-5">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Código de usuario</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--ar-muted)]" size={18} />
                <input
                  type="text"
                  id="login-codigo"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  placeholder="Ej: EST001"
                  className="ar-input pl-11"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-extrabold text-slate-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--ar-muted)]" size={18} />
                <input
                  type="password"
                  id="login-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="ar-input pl-11"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">
                <Shield size={15} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-4 text-base">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Ingresando…</>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>
        </div>

        {/* Info adicional */}
        <div className="mt-6 text-center text-xs text-[color:var(--ar-muted)] font-semibold">
          Conexión segura con el servidor de la institución
        </div>
      </div>
    </div>
  )
}
