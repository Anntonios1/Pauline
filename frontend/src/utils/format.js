import { areaLabels, areaColors, difficultyLabels, difficultyColors } from '../data/labels'

export function getAreaLabel(area) {
  return areaLabels[area] || area
}

export function getAreaBadgeClass(area) {
  return areaColors[area] || 'badge-slate'
}

export function getDifficultyLabel(difficulty) {
  return difficultyLabels[difficulty] || difficulty
}

export function getDifficultyBadgeClass(difficulty) {
  return difficultyColors[difficulty] || 'badge-slate'
}

export function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function parseHtml(content) {
  if (!content) return ''
  return content
    .replace(/<h3>/g, '<h3 class="text-lg font-semibold text-slate-900 mt-6 mb-3">')
    .replace(/<p>/g, '<p class="text-slate-700 mb-4 leading-relaxed">')
    .replace(/<ul>/g, '<ul class="list-disc list-inside space-y-2 text-slate-700 mb-4 ml-4">')
    .replace(/<ol>/g, '<ol class="list-decimal list-inside space-y-2 text-slate-700 mb-4 ml-4">')
    .replace(/<li>/g, '<li class="leading-relaxed">')
    .replace(/<strong>/g, '<strong class="text-slate-900">')
}

export function getInitials(name) {
  if (!name) return 'U'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function calculateOverallProgress(progress) {
  if (!progress || progress.length === 0) return 0
  const completed = progress.filter(p => p.mejor_porcentaje === 100).length
  return Math.round((completed / progress.length) * 100)
}
