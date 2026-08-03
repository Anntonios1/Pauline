import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'

export default function ProfileEditForm() {
  const { user, updateUser } = useAuth()
  const [form, setForm] = useState({
    nombre_visible: user?.nombre_visible || '',
    correo: user?.correo || '',
  })
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(''); setSuccess('')
    if (form.nombre_visible.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    if (password && password.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres.')
      return
    }
    setSaving(true)
    try {
      const payload = { nombre_visible: form.nombre_visible.trim(), correo: form.correo.trim() || null }
      if (password) payload.password = password
      const updated = await api.updateMyProfile(payload)
      updateUser({ nombre_visible: updated.nombre_visible, correo: updated.correo })
      setPassword('')
      setSuccess('Perfil actualizado correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el perfil.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Nombre visible</label>
        <input
          value={form.nombre_visible}
          onChange={e => setForm(f => ({ ...f, nombre_visible: e.target.value }))}
          className="ar-input"
          required
          minLength={2}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Correo (opcional)</label>
        <input
          type="email"
          value={form.correo}
          onChange={e => setForm(f => ({ ...f, correo: e.target.value }))}
          className="ar-input"
          placeholder="tu@correo.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Nueva contraseña (opcional)</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="ar-input"
          placeholder="Déjalo en blanco para no cambiarla"
        />
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
      {success && <p className="text-xs font-semibold text-green-600">{success}</p>}
      <button type="submit" disabled={saving} className={`btn-primary w-full justify-center ${saving ? 'opacity-60' : ''}`}>
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  )
}
