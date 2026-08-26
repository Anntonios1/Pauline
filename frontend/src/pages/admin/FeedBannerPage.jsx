import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, Loader, Trash2 } from 'lucide-react'
import { PageHeader, Card, SectionTitle } from '../../components/ui'
import * as api from '../../services/api'

const MAX_TAMANO = 5 * 1024 * 1024
const FORMATOS = ['image/jpeg', 'image/png', 'image/webp']

export default function FeedBannerPage() {
  const [banner, setBanner] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    api.getFeedBanner().then(setBanner).catch(err => setError(err.message))
  }, [])

  async function subirImagen(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(''); setMessage('')
    if (!FORMATOS.includes(file.type)) {
      setError('Formato no permitido. Usa JPG, PNG o WEBP.')
      return
    }
    if (file.size > MAX_TAMANO) {
      setError('La imagen es demasiado grande (máx 5 MB).')
      return
    }
    setBusy(true)
    try {
      const actualizado = await api.uploadFeedBanner(file)
      setBanner(actualizado)
      setMessage('Banner actualizado. Actívalo para que se vea en el feed.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function alternarActivo() {
    setBusy(true); setError(''); setMessage('')
    try {
      const actualizado = await api.updateFeedBanner({ active: !banner?.active })
      setBanner(actualizado)
      setMessage(actualizado.active ? 'Banner visible en el feed.' : 'Banner oculto.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function quitarImagen() {
    if (!window.confirm('¿Quitar la imagen del banner?')) return
    setBusy(true); setError(''); setMessage('')
    try {
      const actualizado = await api.updateFeedBanner({ image_url: null, active: false })
      setBanner(actualizado)
      setMessage('Imagen eliminada.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Banner del feed"
        subtitle="Imagen de cabecera que ven todos al abrir el feed. Se adapta al alto de la pantalla: compacta en móvil, amplia en escritorio."
      />

      {error && <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p>}

      <section>
        <SectionTitle title="Vista previa" />
        <Card className="overflow-hidden p-0">
          {banner?.image_url ? (
            <img src={banner.image_url} alt="Banner del feed" className="h-32 w-full object-cover sm:h-48 lg:h-[32vh]" />
          ) : (
            <div className="flex h-32 items-center justify-center bg-slate-100 text-sm font-semibold text-slate-400 sm:h-48">
              Todavía no hay imagen de banner
            </div>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle title="Acciones" />
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={subirImagen}
            className="hidden"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {busy ? <Loader size={15} className="animate-spin" /> : <ImageIcon size={15} />}
            {banner?.image_url ? 'Reemplazar imagen' : 'Subir imagen'}
          </button>

          <button
            type="button"
            disabled={busy || !banner?.image_url}
            onClick={alternarActivo}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
          >
            {banner?.active ? 'Desactivar' : 'Activar'}
          </button>

          {banner?.image_url && (
            <button
              type="button"
              disabled={busy}
              onClick={quitarImagen}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              <Trash2 size={15} /> Quitar
            </button>
          )}
        </Card>
      </section>
    </div>
  )
}
