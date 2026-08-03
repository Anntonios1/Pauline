import { createContext, useContext, useState, useEffect } from 'react'
import * as api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    if (storedToken && storedUser) {
      setToken(storedToken)
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = (token, userData) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setToken(token)
    setUser(userData)
  }

  const logout = () => {
    // Cierra la sesión también en el servidor; si la red falla, se limpia igual.
    if (localStorage.getItem('token')) {
      api.logout().catch(() => {})
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const updateUser = (changes) => {
    setUser(current => {
      const next = { ...current, ...changes }
      localStorage.setItem('user', JSON.stringify(next))
      return next
    })
  }

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    login,
    logout,
    updateUser,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
