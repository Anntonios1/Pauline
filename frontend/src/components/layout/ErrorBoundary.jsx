import { Component } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary capturó:', error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) this.props.onReset()
  }

  handleHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = this.props.fallbackPath || '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center fade-in">
          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-orange-500" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 mb-1">Algo salió mal</h2>
          <p className="text-sm text-slate-500 max-w-xs mb-5">
            No se pudo cargar esta sección. Puedes reintentar o volver al inicio.
          </p>
          <div className="flex gap-2">
            <button
              onClick={this.handleRetry}
              className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2"
            >
              <RefreshCw size={16} /> Reintentar
            </button>
            <button
              onClick={this.handleHome}
              className="btn-outline px-5 py-2.5 text-sm inline-flex items-center gap-2"
            >
              <Home size={16} /> Inicio
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}