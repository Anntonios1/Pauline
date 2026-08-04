import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import * as api from '../services/api'

const DataContext = createContext(null)

const PENDING_STATES = ['enviada', 'en_revision', 'requiere_cambios']

export function DataProvider({ children }) {
  const { isAuthenticated, user } = useAuth()
  // La cola de moderación solo existe para docente/admin; el backend la protege (403).
  const isStaff = user?.rol === 'docente' || user?.rol === 'administrador'
  const [categories, setCategories] = useState([])
  const [publications, setPublications] = useState([])
  const [activities, setActivities] = useState([])
  const [resources, setResources] = useState([])
  const [progress, setProgress] = useState([])
  const [pendingPublications, setPendingPublications] = useState([])
  const [logros, setLogros] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [cats, pubs, acts, res] = await Promise.all([
        api.getCategories(),
        api.getPublications(),
        api.getActivities(),
        api.getResources(),
      ])
      setCategories(cats)
      setPublications(pubs)
      setActivities(acts)
      setResources(res)
      if (isAuthenticated) {
        const [prog, pend, misLogros] = await Promise.all([
          api.getProgress(),
          isStaff
            ? Promise.all(PENDING_STATES.map(s => api.getPublications({ estado: s }))).then(
                lists => lists.flat()
              )
            : Promise.resolve([]),
          api.getMisLogros(),
        ])
        setProgress(prog)
        setPendingPublications(pend)
        setLogros(misLogros)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, isStaff])

  useEffect(() => {
    loadData()
  }, [loadData])

  /** Recarga solo las publicaciones aprobadas: es lo que cambia cuando alguien
   *  reacciona, comenta o el docente aprueba algo. Barato comparado con loadData. */
  const refreshPublications = useCallback(async () => {
    try {
      setPublications(await api.getPublications())
    } catch (err) {
      setError(err.message)
    }
  }, [])

  const refreshProgress = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      // Las publicaciones entran aquí a propósito: al aprobar desde moderación
      // se llamaba a esta función y el feed no se enteraba, porque solo se
      // recargaba la cola de pendientes. La aprobada no aparecía hasta recargar.
      const [prog, pend, misLogros, pubs] = await Promise.all([
        api.getProgress(),
        isStaff
          ? Promise.all(PENDING_STATES.map(s => api.getPublications({ estado: s }))).then(
              lists => lists.flat()
            )
          : Promise.resolve([]),
        api.getMisLogros(),
        api.getPublications(),
      ])
      setProgress(prog)
      setPendingPublications(pend)
      setLogros(misLogros)
      setPublications(pubs)
    } catch (err) {
      setError(err.message)
    }
  }, [isAuthenticated, isStaff])

  const getCategoryBySlug = (slug) => categories.find(c => c.slug === slug)
  const getCategoryById = (id) => categories.find(c => c.id === Number(id))
  const getPublicationBySlug = (slug) => publications.find(p => p.slug === slug)
  const getActivityById = (id) => activities.find(a => a.id === Number(id))
  const getResourceById = (id) => resources.find(r => r.id === Number(id))

  const value = {
    categories,
    publications,
    activities,
    resources,
    progress,
    pendingPublications,
    logros,
    loading,
    error,
    refresh: loadData,
    refreshProgress,
    refreshPublications,
    getCategoryBySlug,
    getCategoryById,
    getPublicationBySlug,
    getActivityById,
    getResourceById,
  }

  if (error && categories.length === 0) {
    return (
      <DataContext.Provider value={value}>
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <span className="text-2xl">⚠️</span>
          </div>
          <p className="font-bold text-slate-800 mb-1">No se pudo cargar el contenido</p>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <button onClick={loadData} className="btn-primary px-5 py-2.5 text-sm">
            Reintentar
          </button>
        </div>
        {children}
      </DataContext.Provider>
    )
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData debe usarse dentro de DataProvider')
  }
  return context
}
