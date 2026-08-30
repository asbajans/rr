'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { storeBase } from '@/lib/store-path'
import type { StoreMenu, StoreMenuItem } from '@/lib/types'

function itemUrl(item: StoreMenuItem, siteCode: string, pageSlugs: Map<number, string>): string {
  if ((item as any).categoryId) {
    return `${storeBase(siteCode)}?categoryId=${(item as any).categoryId}`
  }
  if (item.page_id && pageSlugs.has(item.page_id)) {
    return `${storeBase(siteCode)}/pages/${pageSlugs.get(item.page_id)}`
  }
  if (item.url) return item.url
  return '#'
}

export function StoreMenuBar({ siteCode, location = 'header' }: { siteCode: string; location?: 'header' | 'footer' | 'sidebar' }) {
  const [menus, setMenus] = useState<StoreMenu[]>([])
  const [pageSlugs, setPageSlugs] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    let active = true
    if (!siteCode) return
    api.getStoreMenus(siteCode).then(ms => {
      if (!active) return
      setMenus(ms.filter(m => m.location === location))
      return api.getStorePages(siteCode).then((pages: any[]) => {
        if (!active) return
        const map = new Map<number, string>()
        pages.forEach((p: any) => { if (p?.id && p?.slug) map.set(p.id, p.slug) })
        setPageSlugs(map)
      })
    }).catch(() => {})
    return () => { active = false }
  }, [siteCode, location])

  const items = menus.flatMap(m => Array.isArray(m.items) ? (m.items as StoreMenuItem[]) : [])

  if (!items.length) return null

  return (
    <nav className="flex items-center gap-1">
      {items.map(item => {
        const hasChildren = (item.children?.length ?? 0) > 0
        return (
          <div key={item.id} className="relative group">
            <Link
              href={itemUrl(item, siteCode, pageSlugs)}
              target={item.target ?? '_self'}
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            >
              {item.label}
              {hasChildren && <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>}
            </Link>
            {hasChildren && (
              <div className="invisible absolute left-0 top-full z-50 min-w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                {(item.children ?? []).map(child => (
                  <Link
                    key={child.id}
                    href={itemUrl(child, siteCode, pageSlugs)}
                    target={child.target ?? '_self'}
                    className="block px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export function StoreFooterMenus({ siteCode }: { siteCode: string }) {
  const [menus, setMenus] = useState<StoreMenu[]>([])
  const [pageSlugs, setPageSlugs] = useState<Map<number, string>>(new Map())
  const [pages, setPages] = useState<any[]>([])

  useEffect(() => {
    let active = true
    if (!siteCode) return
    api.getStoreMenus(siteCode).then(ms => {
      if (!active) return
      setMenus(ms.filter(m => m.location === 'footer'))
      return api.getStorePages(siteCode).then((pgs: any[]) => {
        if (!active) return
        const map = new Map<number, string>()
        pgs.forEach((p: any) => { if (p?.id && p?.slug) map.set(p.id, p.slug) })
        setPageSlugs(map)
        setPages(pgs)
      })
    }).catch(() => {})
    return () => { active = false }
  }, [siteCode])

  // Fallback: mağaza henüz footer menüsü oluşturmamışsa ama yasal sayfaları varsa, sayfaları doğrudan göster
  if (!menus.length) {
    if (!pages.length) return null
    const legalOrder = ['gizlilik-politikasi','kvkk-aydinlatma-metni','cerez-politikasi','kullanim-sartlari','mesafeli-satis-sozlesmesi','on-bilgilendirme-formu','teslimat-ve-kargo','iade-ve-degisim']
    const sorted = [...pages].sort((a, b) => {
      const ia = legalOrder.indexOf(a.slug)
      const ib = legalOrder.indexOf(b.slug)
      if (ia === -1 && ib === -1) return a.slug.localeCompare(b.slug)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    const pageTitle = (p: any) => {
      const t = p?.title
      if (!t) return p.slug
      if (typeof t === 'string') return t
      if (typeof t === 'object') return (t as any).tr ?? (t as any).en ?? p.slug
      return String(t)
    }
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Kurumsal</h3>
          <ul className="space-y-2">
            {sorted.slice(0, 4).map((p) => (
              <li key={p.id}>
                <Link href={`${storeBase(siteCode)}/pages/${p.slug}`} className="text-sm text-zinc-500 hover:text-zinc-900">
                  {pageTitle(p)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Sözleşmeler &amp; Kargo</h3>
          <ul className="space-y-2">
            {sorted.slice(4).map((p) => (
              <li key={p.id}>
                <Link href={`${storeBase(siteCode)}/pages/${p.slug}`} className="text-sm text-zinc-500 hover:text-zinc-900">
                  {pageTitle(p)}
                </Link>
              </li>
            ))}
            {sorted.length <= 4 && <li className="text-xs text-zinc-400">Menüler &gt; Footer bölümünden sözleşmeleri düzenleyin.</li>}
          </ul>
        </div>
        <div className="sm:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">Mağaza Bilgisi</h3>
          <p className="text-xs leading-relaxed text-zinc-500">
            Mesafeli satış, kargo ve iade koşullarının tümü yukarıdaki sözleşmelerde yer alır. Sipariş öncesi lütfen <em>Mesafeli Satış Sözleşmesi</em> ve <em>Ön Bilgilendirme Formu</em>nu okuyun. Sorularınız için hesabım &gt; destek veya mağaza e-postası üzerinden ulaşabilirsiniz.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {menus.map(menu => (
        <div key={menu.id}>
          <h3 className="mb-3 text-sm font-semibold text-zinc-900">{menu.name}</h3>
          <ul className="space-y-2">
            {(Array.isArray(menu.items) ? (menu.items as StoreMenuItem[]) : []).map(item => (
              <li key={item.id}>
                <Link
                  href={itemUrl(item, siteCode, pageSlugs)}
                  target={item.target ?? '_self'}
                  className="text-sm text-zinc-500 hover:text-zinc-900"
                >
                  {item.label}
                </Link>
                {(item.children?.length ?? 0) > 0 && (
                  <ul className="mt-1 space-y-1 pl-3">
                    {(item.children ?? []).map(child => (
                      <li key={child.id}>
                        <Link
                          href={itemUrl(child, siteCode, pageSlugs)}
                          target={child.target ?? '_self'}
                          className="text-sm text-zinc-400 hover:text-zinc-900"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
