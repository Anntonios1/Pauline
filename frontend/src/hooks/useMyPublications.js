import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import * as api from '../services/api'

/** Publicaciones del usuario en cualquier estado (el feed global solo trae 'aprobada'). */
export function useMyPublications() {
  const { user } = useAuth()
  const [myPublications, setMyPublications] = useState([])

  useEffect(() => {
    if (!user?.id) return
    api.getPublications({ autor_id: user.id }).then(setMyPublications).catch(() => {})
  }, [user?.id])

  return myPublications
}

/** IDs de publicaciones que el estudiante ya abrió, según eventos_aprendizaje. */
export function useReadPublicationIds() {
  const { user } = useAuth()
  const [readIds, setReadIds] = useState(() => new Set())

  useEffect(() => {
    if (!user?.id) return
    api.getEvents({ objeto_tipo: 'publicacion' })
      .then(events => setReadIds(new Set(events.filter(e => e.verbo === 'leyo').map(e => e.objeto_id))))
      .catch(() => {})
  }, [user?.id])

  return readIds
}
