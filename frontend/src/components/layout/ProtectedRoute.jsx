import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

/**
 * Protege rutas que requieren autenticación.
 * Si el usuario no está autenticado, lo redirige a /login.
 * 
 * Props opcionales:
 *   allowedRoles: Array de roles permitidos (ej. ['docente','administrador'])
 *   redirectTo: Ruta a la que redirigir si no cumple el rol (default: '/')
 */
export default function ProtectedRoute({ children, allowedRoles, redirectTo = '/' }) {
  const { isAuthenticated, user, loading } = useAuth()
  const location = useLocation()

  // Mientras se verifica el token guardado, mostrar un loader
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  // Si no está autenticado → redirigir a login guardando la URL original
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Si se requieren roles específicos y el usuario no los cumple
  if (allowedRoles && !allowedRoles.includes(user?.rol)) {
    return <Navigate to={redirectTo} replace />
  }

  return children
}
