'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export interface CartItem {
  product_id: string
  sku: string
  name: string
  price: number
  quantity: number
  image?: string
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (sku: string) => void
  updateQuantity: (sku: string, quantity: number) => void
  clearCart: () => void
  totalItems: number
  totalPrice: number
}

const CartContext = createContext<CartContextType | null>(null)

const STORAGE_KEY = 'rahatio_cart'

export function CartProvider({ children, siteCode }: { children: ReactNode; siteCode?: string }) {
  const [items, setItems] = useState<CartItem[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${siteCode}`)
      if (stored) setItems(JSON.parse(stored))
    } catch {}
  }, [siteCode])

  useEffect(() => {
    if (siteCode) {
      localStorage.setItem(`${STORAGE_KEY}_${siteCode}`, JSON.stringify(items))
    }
  }, [items, siteCode])

  const addItem = useCallback((item: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.sku === item.sku)
      if (existing) {
        return prev.map((i) => i.sku === item.sku ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i)
      }
      return [...prev, { ...item, quantity: item.quantity || 1 }]
    })
  }, [])

  const removeItem = useCallback((sku: string) => {
    setItems((prev) => prev.filter((i) => i.sku !== sku))
  }, [])

  const updateQuantity = useCallback((sku: string, quantity: number) => {
    if (quantity < 1) return
    setItems((prev) => prev.map((i) => i.sku === sku ? { ...i, quantity } : i))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
