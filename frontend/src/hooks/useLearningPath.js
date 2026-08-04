import { useData } from '../contexts/DataContext'
import { useReadPublicationIds } from './useMyPublications'

export function calculateOverall(progress) {
  if (!progress?.length) return 0
  const done = progress.filter(p => p.mejor_porcentaje === 100).length
  return Math.round((done / progress.length) * 100)
}

/** Unidades de aprendizaje (una por categoria) con pasos y estado de avance del usuario actual. */
export function useLearningPath() {
  const { progress, categories, publications, activities } = useData()
  const readIds = useReadPublicationIds()
  const overall = calculateOverall(progress)

  const learningPath = categories.map((cat, ui) => {
    const lecturas = publications.filter(p => p.categoria_id === cat.id)
    const act = activities.filter(a => a.categoria_id === cat.id)
    const pasos = [
      ...lecturas.map(pub => ({
        id: `pub-${pub.id}`,
        titulo: pub.titulo,
        tipo: 'lectura',
        slug: pub.slug,
        estado: readIds.has(pub.id) ? 'completado' : 'activo',
      })),
      ...act.map(a => {
        const prog = progress.find(p => Number(p.id) === Number(a.id))
        return {
          id: `act-${a.id}`,
          titulo: a.titulo,
          tipo: 'actividad',
          actividad_id: a.id,
          estado: prog?.mejor_porcentaje === 100 ? 'completado' : 'activo',
        }
      }),
    ]
    const completados = pasos.filter(p => p.estado === 'completado').length
    const todosCompletados = pasos.length > 0 && completados === pasos.length
    return {
      id: cat.id,
      titulo: `${ui + 1}. ${cat.nombre}`,
      pasos,
      completados,
      todosCompletados,
      tieneActivo: !todosCompletados,
    }
  })

  return { learningPath, overall }
}
