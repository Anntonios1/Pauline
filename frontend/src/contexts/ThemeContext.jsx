import { createContext, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Tema y color de acento.
 *
 * Solo escribe `data-theme` / `data-accent` en <html>; todo el aspecto
 * visual se resuelve en styles/index.css (secciones 02 y 03). Así el
 * monolito sigue siendo el único sitio donde se editan los colores.
 */

const ThemeContext = createContext(null)

const STORAGE_THEME = 'ar-tema'
const STORAGE_ACCENT = 'ar-acento'

export const TEMAS = [
  { value: 'sistema', label: 'Automático', descripcion: 'Sigue la preferencia del dispositivo', emoji: '🌗' },
  { value: 'claro',   label: 'Claro',      descripcion: 'Fondo blanco, alto contraste',        emoji: '☀️' },
  { value: 'oscuro',  label: 'Oscuro',     descripcion: 'Descansa la vista de noche',          emoji: '🌙' },
]

export const ACENTOS = [
  { value: 'turquesa',  label: 'Turquesa',  color: '#0ea5a5' },
  { value: 'violeta',   label: 'Violeta',   color: '#7c3aed' },
  { value: 'azul',      label: 'Azul',      color: '#2563eb' },
  { value: 'coral',     label: 'Coral',     color: '#f43f5e' },
  { value: 'ambar',     label: 'Ámbar',     color: '#f59e0b' },
  { value: 'esmeralda', label: 'Esmeralda', color: '#10b981' },
]

const THEME_VALUES = TEMAS.map(t => t.value)
const ACCENT_VALUES = ACENTOS.map(a => a.value)

function leerAlmacenado(clave, permitidos, porDefecto) {
  try {
    const valor = localStorage.getItem(clave)
    return permitidos.includes(valor) ? valor : porDefecto
  } catch {
    return porDefecto
  }
}

function prefiereOscuro() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }) {
  const [tema, setTemaState] = useState(() => leerAlmacenado(STORAGE_THEME, THEME_VALUES, 'sistema'))
  const [acento, setAcentoState] = useState(() => leerAlmacenado(STORAGE_ACCENT, ACCENT_VALUES, 'turquesa'))
  // Lo que realmente se pinta: 'sistema' se resuelve a claro u oscuro.
  const [temaEfectivo, setTemaEfectivo] = useState(() => {
    const inicial = leerAlmacenado(STORAGE_THEME, THEME_VALUES, 'sistema')
    return inicial === 'sistema' ? (prefiereOscuro() ? 'oscuro' : 'claro') : inicial
  })

  // Con 'sistema' seguimos los cambios del SO en vivo (p. ej. modo nocturno automático).
  useEffect(() => {
    if (tema !== 'sistema') {
      setTemaEfectivo(tema)
      return
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const sincronizar = () => setTemaEfectivo(media.matches ? 'oscuro' : 'claro')
    sincronizar()
    media.addEventListener('change', sincronizar)
    return () => media.removeEventListener('change', sincronizar)
  }, [tema])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', temaEfectivo)
  }, [temaEfectivo])

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', acento)
  }, [acento])

  const setTema = (valor) => {
    if (!THEME_VALUES.includes(valor)) return
    setTemaState(valor)
    try { localStorage.setItem(STORAGE_THEME, valor) } catch { /* modo privado */ }
  }

  const setAcento = (valor) => {
    if (!ACCENT_VALUES.includes(valor)) return
    setAcentoState(valor)
    try { localStorage.setItem(STORAGE_ACCENT, valor) } catch { /* modo privado */ }
  }

  const alternarTema = () => setTema(temaEfectivo === 'oscuro' ? 'claro' : 'oscuro')

  const value = useMemo(
    () => ({ tema, temaEfectivo, acento, setTema, setAcento, alternarTema, esOscuro: temaEfectivo === 'oscuro' }),
    [tema, temaEfectivo, acento]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider')
  }
  return context
}
