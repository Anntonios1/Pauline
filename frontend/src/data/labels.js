/* Tablas de presentación por área y dificultad.
   Las clases de Tailwind deben aparecer literalmente aquí para que el JIT
   no las purgue: no se pueden construir concatenando strings. */

export const areaLabels = {
  cuerpo_humano: 'Mi cuerpo',
  pubertad: 'La pubertad',
  sistema_reproductor_femenino: 'Sist. femenino',
  sistema_reproductor_masculino: 'Sist. masculino',
  celulas_reproductoras: 'Células reproductoras',
  fecundacion: 'Fecundación',
  embarazo: 'Embarazo',
  nacimiento: 'Nacimiento',
  autocuidado: 'Autocuidado',
  preguntas_frecuentes: 'Preguntas frecuentes',
}

export const areaColors = {
  cuerpo_humano: 'bg-blue-100 text-blue-700',
  pubertad: 'bg-purple-100 text-purple-700',
  sistema_reproductor_femenino: 'bg-pink-100 text-pink-700',
  sistema_reproductor_masculino: 'bg-sky-100 text-sky-700',
  celulas_reproductoras: 'bg-emerald-100 text-emerald-700',
  fecundacion: 'bg-teal-100 text-teal-700',
  embarazo: 'bg-green-100 text-green-700',
  nacimiento: 'bg-yellow-100 text-yellow-800',
  autocuidado: 'bg-orange-100 text-orange-700',
  preguntas_frecuentes: 'bg-slate-100 text-slate-600',
}

export const areaGradients = {
  cuerpo_humano: 'from-blue-400 to-blue-600',
  pubertad: 'from-purple-400 to-purple-600',
  sistema_reproductor_femenino: 'from-pink-400 to-pink-600',
  sistema_reproductor_masculino: 'from-sky-400 to-sky-600',
  celulas_reproductoras: 'from-emerald-400 to-emerald-600',
  fecundacion: 'from-teal-400 to-teal-600',
  embarazo: 'from-green-400 to-green-600',
  nacimiento: 'from-yellow-400 to-yellow-600',
  autocuidado: 'from-orange-400 to-orange-600',
  preguntas_frecuentes: 'from-slate-400 to-slate-600',
}

export const difficultyLabels = {
  basica: 'Básica',
  media: 'Media',
  avanzada: 'Avanzada',
}

export const difficultyColors = {
  basica: 'bg-green-100 text-green-700',
  media: 'bg-yellow-100 text-yellow-800',
  avanzada: 'bg-orange-100 text-orange-700',
}
