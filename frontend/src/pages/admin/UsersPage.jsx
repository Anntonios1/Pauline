import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { PageHeader, Card, SectionTitle, EmptyState } from '../../components/ui'
import * as api from '../../services/api'
import { Users, UserPlus, KeyRound, Copy, Check, X, ShieldAlert } from 'lucide-react'

const ROLE_LABELS = { estudiante: 'Estudiante', docente: 'Docente', administrador: 'Administrador' }
const ROLE_BADGE = {
  estudiante: 'bg-teal-100 text-teal-700',
  docente: 'bg-purple-100 text-purple-700',
  administrador: 'bg-blue-900 text-white',
}

function CreateUserForm({ onCreated }) {
  const [form, setForm] = useState({ codigo: '', nombre_visible: '', password: '', rol: 'estudiante' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true); setError('')
    try {
      await api.createUserAccount(form)
      setForm({ codigo: '', nombre_visible: '', password: '', rol: 'estudiante' })
      onCreated()
    } catch (err) {
      setError(err.message || 'No se pudo crear la cuenta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Código</label>
        <input required value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="Ej. EST009" className="ar-input" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Nombre visible</label>
        <input required value={form.nombre_visible} onChange={e => setForm({ ...form, nombre_visible: e.target.value })} className="ar-input" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Contraseña inicial</label>
        <input required type="text" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" className="ar-input" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500">Rol</label>
        <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} className="ar-input">
          <option value="estudiante">Estudiante</option>
          <option value="docente">Docente</option>
          <option value="administrador">Administrador</option>
        </select>
      </div>
      {error && <p role="alert" className="sm:col-span-2 text-sm font-semibold text-red-600">{error}</p>}
      <button disabled={saving} className="btn-primary sm:col-span-2 justify-center">
        <UserPlus size={16} /> {saving ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  )
}

function ResetPasswordResult({ result, onClose }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(result.password_temporal).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 a-fade" role="dialog" aria-modal="true">
      <div className="a-scale w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><KeyRound size={20} /></span>
          <div>
            <h3 className="font-extrabold text-slate-900">Contraseña restablecida</h3>
            <p className="text-xs text-slate-500">Para {result.codigo}. Apúntala ahora: no se volverá a mostrar.</p>
          </div>
        </div>
        <div className="mb-4 flex items-center gap-2 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-3">
          <code className="flex-1 select-all text-lg font-black tracking-wide text-amber-900">{result.password_temporal}</code>
          <button type="button" onClick={copy} className="press rounded-lg p-2 text-amber-700 hover:bg-amber-100" aria-label="Copiar contraseña">
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
        <button type="button" onClick={onClose} className="btn-primary w-full justify-center">Entendido, ya la anoté</button>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const isAdmin = me?.rol === 'administrador'
  const [users, setUsers] = useState([])
  const [roleFilter, setRoleFilter] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [resetResult, setResetResult] = useState(null)
  const [resettingId, setResettingId] = useState(null)

  const load = () => {
    setLoading(true)
    api.getUsers().then(setUsers).catch(err => setError(err.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = users.filter(u => roleFilter === 'todos' || u.rol === roleFilter)

  // Un docente solo puede resetear cuentas de estudiantes; el admin, cualquiera.
  const puedeResetear = (u) => isAdmin || u.rol === 'estudiante'

  const handleReset = async (u) => {
    if (!window.confirm(`¿Restablecer la contraseña de ${u.nombre_visible} (${u.codigo})? Su contraseña actual dejará de funcionar.`)) return
    setResettingId(u.id)
    try {
      const result = await api.resetUserPassword(u.id)
      setResetResult(result)
    } catch (err) {
      setError(err.message || 'No se pudo restablecer la contraseña.')
    } finally {
      setResettingId(null)
    }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title="Usuarios" subtitle="Cuentas de la clase: crea estudiantes y docentes, o restablece una contraseña olvidada." />

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      {isAdmin && (
        <Card className="p-5">
          <button type="button" onClick={() => setShowCreate(v => !v)} className="flex w-full items-center justify-between text-left">
            <SectionTitle title="Crear cuenta nueva" subtitle="Solo un administrador puede crear cuentas." />
            <span className="text-sm font-bold text-[color:var(--ar-primary)]">{showCreate ? 'Cerrar' : 'Abrir'}</span>
          </button>
          {showCreate && <div className="mt-3"><CreateUserForm onCreated={() => { setShowCreate(false); load() }} /></div>}
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['todos', 'estudiante', 'docente', 'administrador'].map(r => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`ar-chip press ${roleFilter === r ? 'active' : ''}`}
          >
            {r === 'todos' ? 'Todos' : ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando usuarios…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No hay usuarios en este filtro" icon={Users} />
      ) : (
        <div className="ar-card divide-y divide-slate-50">
          {filtered.map(u => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="avatar-sm flex-shrink-0 bg-slate-200 text-slate-600">
                {u.imagen_perfil ? <img src={u.imagen_perfil} alt="" className="h-full w-full object-cover" /> : u.nombre_visible?.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{u.nombre_visible}</p>
                <p className="text-xs text-slate-500">{u.codigo}{!u.activo && ' · inactivo'}</p>
              </div>
              <span className={`ar-badge ${ROLE_BADGE[u.rol]}`}>{ROLE_LABELS[u.rol]}</span>
              {puedeResetear(u) ? (
                <button
                  type="button"
                  onClick={() => handleReset(u)}
                  disabled={resettingId === u.id}
                  className="press inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 sm:py-1.5 text-xs font-bold text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                >
                  <KeyRound size={13} /> {resettingId === u.id ? 'Generando…' : 'Restablecer'}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-slate-300" title="Solo un administrador puede restablecer esta cuenta">
                  <ShieldAlert size={13} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {resetResult && <ResetPasswordResult result={resetResult} onClose={() => setResetResult(null)} />}
    </div>
  )
}
