'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Product, B2bSetting } from '@/lib/types'

type ProductForm = {
  code: string
  label: string
  price: string
  stock: string
  status: number
  image: File | null
  b2b_enabled: boolean
  b2b_discount: string
  b2b_price: string
}

const emptyForm: ProductForm = { code: '', label: '', price: '', stock: '', status: 1, image: null, b2b_enabled: false, b2b_discount: '', b2b_price: '' }

export default function ProductsPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadProducts = useCallback(() => {
    setLoading(true)
    api.getAdminProducts()
      .then((res) => setProducts(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadProducts() }, [loadProducts])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setPreview(null)
    setShowModal(true)
  }

  function openEdit(p: Product) {
    setEditingId(p.id)
    setForm({
      code: p.code,
      label: p.label,
      price: p.price?.toString() ?? '',
      stock: p.stock?.toString() ?? '',
      status: p.status,
      image: null,
      b2b_enabled: false,
      b2b_discount: '',
      b2b_price: '',
    })
    setPreview((p as unknown as Record<string, string>).image ?? null)
    setShowModal(true)

    api.getB2bSettings(p.id).then((res) => {
      const s = res as B2bSetting
      if (s.is_b2b_enabled) {
        setForm((prev) => ({ ...prev, b2b_enabled: true, b2b_discount: s.b2b_discount?.toString() ?? '', b2b_price: s.b2b_price?.toString() ?? '' }))
      }
    }).catch(() => {})
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setForm({ ...form, image: file })
    setPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!form.code.trim() || !form.label.trim()) return
    setSaving(true)

    try {
      let mediaUrl: string | null = null
      let productId: string | null = editingId

      if (form.image) {
        const uploadRes = await api.uploadImage(form.image)
        mediaUrl = uploadRes.url
      }

      const payload: Record<string, unknown> = {
        code: form.code,
        label: form.label,
        price: form.price ? parseFloat(form.price) : null,
        stock: form.stock ? parseInt(form.stock) : null,
        status: form.status,
        media_url: mediaUrl,
      }

      if (editingId) {
        delete payload.code
        if (!mediaUrl) delete payload.media_url
        await api.updateAdminProduct(editingId, payload as Parameters<typeof api.updateAdminProduct>[1])
      } else {
        const created = await api.createAdminProduct(payload as unknown as Parameters<typeof api.createAdminProduct>[0])
        productId = (created as unknown as Record<string, string>).id
      }

      if (productId) {
        await api.updateB2bSettings({
          product_id: productId,
          is_b2b_enabled: form.b2b_enabled,
          b2b_discount: form.b2b_discount ? parseFloat(form.b2b_discount) : null,
          b2b_price: form.b2b_price ? parseFloat(form.b2b_price) : null,
        })
      }

      setShowModal(false)
      loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return
    setDeleting(id)
    try {
      await api.deleteAdminProduct(id)
      loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product')
    } finally {
      setDeleting(null)
    }
  }

  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Ürünler</h1>
          <p className="mt-1 text-sm text-zinc-600">Ürünlerini yönet, AI ile görsel düzenle.</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Ürün Ekle
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}

      {!loading && !error && (
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Görsel</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Kod</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Ürün</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Fiyat</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Durum</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {products.map((p) => {
                const image = (p as unknown as Record<string, string>).image
                return (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="h-10 w-10 overflow-hidden rounded-lg bg-zinc-100">
                        {image ? (
                          <img src={image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-zinc-300">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">{p.code}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900">{p.label}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-500">
                      {p.price !== null && p.price !== undefined
                        ? `${p.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`
                        : '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${p.status === 1 ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                        {p.status === 1 ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      <button
                        onClick={() => openEdit(p)}
                        className="mr-2 text-zinc-500 hover:text-zinc-900"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {deleting === p.id ? 'Siliniyor...' : 'Sil'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {products.length === 0 && (
            <div className="p-12 text-center text-sm text-zinc-500">Henüz ürün eklenmemiş.</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-900">
              {editingId ? 'Ürünü Düzenle' : 'Yeni Ürün'}
            </h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700">Kod</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  disabled={!!editingId}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
                  placeholder="URUN-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">Ürün Adı</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Ürün adı"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Fiyat (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Stok</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">Görsel</label>
                <div className="mt-1">
                  {preview && (
                    <div className="mb-2 h-32 w-32 overflow-hidden rounded-lg bg-zinc-100">
                      <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="block w-full text-sm text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-zinc-700">Aktif</label>
                <input
                  type="checkbox"
                  checked={form.status === 1}
                  onChange={(e) => setForm({ ...form, status: e.target.checked ? 1 : 0 })}
                  className="h-4 w-4 rounded border-zinc-300"
                />
              </div>

              <div className="border-t border-zinc-200 pt-4">
                <h3 className="text-sm font-semibold text-zinc-900">B2B Ayarları</h3>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.b2b_enabled}
                    onChange={(e) => setForm({ ...form, b2b_enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <label className="text-sm font-medium text-zinc-700">B2B'ye Aç</label>
                </div>
                {form.b2b_enabled && (
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">B2B İndirim (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={form.b2b_discount}
                        onChange={(e) => setForm({ ...form, b2b_discount: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">B2B Fiyat (₺)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.b2b_price}
                        onChange={(e) => setForm({ ...form, b2b_price: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.code.trim() || !form.label.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
