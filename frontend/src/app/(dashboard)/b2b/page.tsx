'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { B2bProductItem } from '@/lib/types'
import { Search, Package, Store, Tag, Percent, PlusCircle, Eye, CheckCircle, Clock, XCircle, X } from 'lucide-react'

type Tab = 'discover' | 'listed'

export default function B2bPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('discover')
  const [products, setProducts] = useState<B2bProductItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [requestProductId, setRequestProductId] = useState<string | null>(null)
  const [requestStoreId, setRequestStoreId] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')

  const [listedProducts, setListedProducts] = useState<any[]>([])
  const [listedLoading, setListedLoading] = useState(false)

  const [detailProduct, setDetailProduct] = useState<B2bProductItem | null>(null)

  const loadProducts = useCallback((p: number, q?: string) => {
    setLoading(true)
    api.getB2bDiscover({ page: p, search: q })
      .then((res) => {
        setProducts(res.data)
        setTotal(res.total)
        setPage(res.current_page)
        setLastPage(res.last_page)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (tab === 'discover') loadProducts(1)
    else loadListed()
  }, [tab, loadProducts])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput)
      loadProducts(1, searchInput || undefined)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput, loadProducts])

  function loadListed() {
    setListedLoading(true)
    api.getB2bListed()
      .then((res) => setListedProducts(res.data))
      .catch(() => {})
      .finally(() => setListedLoading(false))
  }

  function handleRequestClick(productId: string, storeId: number) {
    setRequestProductId(productId)
    setRequestStoreId(storeId)
    setNoteText('')
    setShowNoteModal(true)
  }

  async function handleConfirmRequest() {
    if (!requestProductId || !requestStoreId) return
    setRequestingId(requestProductId)
    setShowNoteModal(false)
    try {
      await api.createB2bRequest({
        productId: Number(requestProductId),
        requestNote: noteText || undefined,
      })
      loadProducts(page)
    } catch (err: any) {
      alert(err.message || 'Talep gönderilemedi')
    } finally {
      setRequestingId(null)
      setRequestProductId(null)
      setRequestStoreId(null)
    }
  }

  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pending: { color: 'text-amber-600 bg-amber-50', icon: <Clock className="h-3 w-3" />, label: 'Beklemede' },
    approved: { color: 'text-green-600 bg-green-50', icon: <CheckCircle className="h-3 w-3" />, label: 'Onaylandı' },
    rejected: { color: 'text-red-600 bg-red-50', icon: <XCircle className="h-3 w-3" />, label: 'Reddedildi' },
  }

  if (!user) return null

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">B2B Ürün Keşfet</h1>
          <p className="mt-1 text-sm text-zinc-600">Diğer satıcıların B2B'ye açık ürünlerini keşfet ve mağazana ekle.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">{total} ürün</span>
        </div>
      </div>

      <div className="mt-6 flex gap-4 border-b border-zinc-200">
        <button
          onClick={() => setTab('discover')}
          className={`pb-3 text-sm font-medium ${tab === 'discover' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          Keşfet
        </button>
        <button
          onClick={() => setTab('listed')}
          className={`pb-3 text-sm font-medium ${tab === 'listed' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          Mağazamdakiler
        </button>
      </div>

      {tab === 'discover' && (
        <>
          <div className="relative mt-6 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Ürün ara..."
              className="w-full rounded-lg border border-zinc-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {loading && <p className="mt-8 text-sm text-zinc-500">Yükleniyor...</p>}

          {!loading && products.length === 0 && (
            <div className="mt-16 text-center text-sm text-zinc-500">B2B'ye açık ürün bulunamadı.</div>
          )}

          {!loading && products.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setDetailProduct(item)}
                  className="group cursor-pointer overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="relative h-52 bg-zinc-100">
                    {item.product.image ? (
                      <img src={item.product.image} alt={item.product.label} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-300">
                        <Package className="h-12 w-12" />
                      </div>
                    )}
                    {item.b2b_discount && (
                      <div className="absolute left-3 top-3 rounded-md bg-green-500 px-2 py-1 text-xs font-bold text-white">
                        %{item.b2b_discount} indirim
                      </div>
                    )}
                    <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-1 text-xs text-white">
                      <Eye className="mr-1 inline h-3 w-3" /> Detay
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Store className="h-3 w-3 text-amber-600" />
                      <span className="text-xs text-zinc-500">{item.store.name}</span>
                    </div>
                    <h3 className="truncate text-sm font-semibold text-zinc-900">{item.product.label}</h3>
                    {item.b2b_discount && (
                      <div className="mt-2 rounded-lg bg-green-50 p-2">
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>Liste Fiyatı:</span>
                          <span className="text-zinc-400 line-through">
                            {item.product.price?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold text-green-700">B2B Fiyatı:</span>
                          <span className="font-bold text-green-700">
                            {item.b2b_price?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-zinc-500">
                        Stok: <strong>{item.product.stock ?? '-'}</strong>
                      </span>
                      {item.my_request_status && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig[item.my_request_status]?.color || 'text-zinc-600 bg-zinc-100'}`}>
                          {statusConfig[item.my_request_status]?.icon}
                          {statusConfig[item.my_request_status]?.label}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRequestClick(item.id, item.store.id) }}
                      disabled={!!item.my_request_status || requestingId === item.id}
                      className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
                        item.my_request_status
                          ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                          : 'bg-amber-600 text-white hover:bg-amber-700'
                      }`}
                    >
                      {requestingId === item.id ? (
                        'Gönderiliyor...'
                      ) : item.my_request_status ? (
                        'Talep Gönderildi'
                      ) : (
                        <>
                          <PlusCircle className="h-4 w-4" /> Mağazama Ekle
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {lastPage > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: lastPage }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => loadProducts(p, search || undefined)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    page === p ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {detailProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailProduct(null)}>
              <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Store className="h-5 w-5 text-amber-600" />
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900">{detailProduct.product.label}</h2>
                      <p className="text-xs text-zinc-500">{detailProduct.store.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setDetailProduct(null)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6">
                  <div className="mb-4 h-64 overflow-hidden rounded-lg bg-zinc-100">
                    {detailProduct.product.image ? (
                      <img src={detailProduct.product.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-300">
                        <Package className="h-16 w-16" />
                      </div>
                    )}
                  </div>
                  {detailProduct.b2b_discount && (
                    <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
                      <h3 className="mb-3 text-sm font-semibold text-green-700">Fiyat Bilgileri</h3>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Liste Fiyatı:</span>
                        <span className="text-zinc-400 line-through">
                          {detailProduct.product.price?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between text-lg">
                        <span className="font-semibold text-green-700">B2B Fiyatı:</span>
                        <span className="font-bold text-green-700">
                          {detailProduct.b2b_price?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Percent className="h-4 w-4 text-green-600" />
                        <span className="text-sm">İskonto: <strong>%{detailProduct.b2b_discount}</strong></span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3">
                    <Store className="h-8 w-8 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{detailProduct.store.name}</p>
                      <p className="text-xs text-zinc-500">Mağaza Kodu: {detailProduct.store.site_code}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    {detailProduct.my_request_status ? (
                      <span className={`inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium ${statusConfig[detailProduct.my_request_status]?.color}`}>
                        {statusConfig[detailProduct.my_request_status]?.icon}
                        Talep Durumu: {statusConfig[detailProduct.my_request_status]?.label}
                      </span>
                    ) : (
                      <button
                        onClick={() => { setDetailProduct(null); handleRequestClick(detailProduct.id, detailProduct.store.id) }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
                      >
                        <PlusCircle className="h-4 w-4" /> Mağazama Ekle
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {showNoteModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-zinc-900">Mağazama Ekle</h2>
                <p className="mt-1 text-sm text-zinc-500">Ürün sahibine not eklemek ister misin? (isteğe bağlı)</p>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={3}
                  className="mt-4 w-full rounded-lg border border-zinc-300 p-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Örn: Bu ürünü mağazamda satmak istiyorum..."
                />
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setShowNoteModal(false)}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleConfirmRequest}
                    disabled={requestingId !== null}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                  >
                    Talebi Gönder
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'listed' && (
        <div className="mt-6">
          {listedLoading && <p className="text-sm text-zinc-500">Yükleniyor...</p>}
          {!listedLoading && listedProducts.length === 0 && (
            <div className="mt-8 text-center text-sm text-zinc-500">Henüz B2B ürün eklenmemiş.</div>
          )}
          {!listedLoading && listedProducts.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-200">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Ürün</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Kaynak Mağaza</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">Eklenme</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {listedProducts.map((lp: any) => (
                    <tr key={lp.id} className="hover:bg-zinc-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-lg bg-zinc-100">
                            {lp.product?.image ? (
                              <img src={lp.product.image} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-zinc-300">
                                <Package className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-900">{lp.product?.label || 'Bilinmeyen Ürün'}</p>
                            <p className="text-xs text-zinc-500">{lp.product?.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-500">{lp.original_store?.name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-zinc-500">
                        {lp.created_at ? new Date(lp.created_at).toLocaleDateString('tr-TR') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
