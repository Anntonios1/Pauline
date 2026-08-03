import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-teal-600 mb-4">404</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Página no encontrada</h1>
        <p className="text-slate-600 mb-6">
          Lo sentimos, la página que buscas no existe o ha sido movida.
        </p>
        <Link to="/" className="btn-primary inline-flex gap-2">
          <ArrowLeft size={20} />
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
