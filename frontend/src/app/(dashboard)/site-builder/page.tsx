'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import type { Store, StoreTheme } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Palette, Type, Code, Upload, Image } from 'lucide-react'

const FONT_OPTIONS = ['Inter', 'Playfair Display', 'Roboto', 'Open Sans']

export default function SiteBuilderPage() {
  const { user } = useAuth()
  const [store, setStore] = useState<Store | null>(null)
  const [theme, setTheme] = useState<StoreTheme>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    api.getSettings()
      .then((s) => { setStore(s); setTheme(s.theme ?? {}) })
      .catch(() => {})
  }, [])

  if (!user) return null

  function updateTheme(partial: Partial<StoreTheme>) {
    setTheme((prev) => ({ ...prev, ...partial }))
  }

  async function handleUpload(field: 'logo_url' | 'favicon_url') {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploading(field === 'logo_url' ? 'logo' : 'favicon')
      try {
        const { url } = await api.uploadImage(file)
        updateTheme({ [field]: url })
        setMessage(`${field === 'logo_url' ? 'Logo' : 'Favicon'} yüklendi.`)
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Yükleme hatası')
      } finally {
        setUploading(null)
      }
    }
    input.click()
  }

  async function handleSave() {
    setSaving(true)
    setMessage('')
    try {
      await api.updateSettings({ theme })
      setMessage('Tema ayarları kaydedildi.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Site Builder</h1>
      <p className="mt-1 text-sm text-zinc-600">Mağaza temasını ve görünümünü özelleştir.</p>

      <div className="mt-8 space-y-8">
        {/* Logo & Favicon */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Image className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Logo & Favicon</h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-900">Logo</label>
              {theme.logo_url && (
                <img src={theme.logo_url} alt="Logo" className="mt-2 mb-2 max-h-16 rounded border border-zinc-200" />
              )}
              <Button size="sm" variant="outline" onClick={() => handleUpload('logo_url')} disabled={uploading === 'logo'}>
                <Upload className="mr-1 h-3 w-3" />{uploading === 'logo' ? 'Yükleniyor...' : 'Logo Yükle'}
              </Button>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900">Favicon</label>
              {theme.favicon_url && (
                <img src={theme.favicon_url} alt="Favicon" className="mt-2 mb-2 max-h-10 rounded border border-zinc-200" />
              )}
              <Button size="sm" variant="outline" onClick={() => handleUpload('favicon_url')} disabled={uploading === 'favicon'}>
                <Upload className="mr-1 h-3 w-3" />{uploading === 'favicon' ? 'Yükleniyor...' : 'Favicon Yükle'}
              </Button>
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Renkler</h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-zinc-900">Birincil Renk</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={theme.primary_color || '#4f46e5'}
                  onChange={(e) => updateTheme({ primary_color: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded border border-zinc-300" />
                <input type="text" value={theme.primary_color || ''}
                  onChange={(e) => updateTheme({ primary_color: e.target.value })}
                  placeholder="#4f46e5"
                  className="block flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900">İkincil Renk</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={theme.secondary_color || '#18181b'}
                  onChange={(e) => updateTheme({ secondary_color: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded border border-zinc-300" />
                <input type="text" value={theme.secondary_color || ''}
                  onChange={(e) => updateTheme({ secondary_color: e.target.value })}
                  placeholder="#18181b"
                  className="block flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-900">Vurgu Rengi</label>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={theme.accent_color || '#f59e0b'}
                  onChange={(e) => updateTheme({ accent_color: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded border border-zinc-300" />
                <input type="text" value={theme.accent_color || ''}
                  onChange={(e) => updateTheme({ accent_color: e.target.value })}
                  placeholder="#f59e0b"
                  className="block flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Font */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Type className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Yazı Tipi</h2>
          </div>
          <div className="mt-4 max-w-xs">
            <label className="block text-sm font-medium text-zinc-900">Font Ailesi</label>
            <select value={theme.font_family || 'Inter'}
              onChange={(e) => updateTheme({ font_family: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom CSS */}
        <div className="rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900">Özel CSS</h2>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-zinc-900">CSS Kodları</label>
            <textarea value={theme.custom_css || ''}
              onChange={(e) => updateTheme({ custom_css: e.target.value })}
              rows={10}
              placeholder="/* Özel stillerinizi buraya ekleyin */"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.includes('kaydedildi') || message.includes('yüklendi') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor...' : 'Temayı Kaydet'}
        </Button>
      </div>
    </div>
  )
}
