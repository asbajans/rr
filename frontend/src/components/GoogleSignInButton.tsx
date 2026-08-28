'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'

declare global {
  interface Window {
    google?: any
  }
}

export function GoogleSignInButton({ mode = 'login' }: { mode?: 'login' | 'register' }) {
  const { googleLogin } = useAuth()
  const router = useRouter()
  const [clientId, setClientId] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const btnRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  // Fetch Google config from backend
  useEffect(() => {
    let mounted = true
    api.getGoogleConfig()
      .then((cfg) => {
        if (!mounted) return
        setEnabled(cfg.enabled)
        setClientId(cfg.clientId)
      })
      .catch(() => {
        if (!mounted) return
        setEnabled(false)
      })
    return () => { mounted = false }
  }, [])

  // Load GIS script when enabled and clientId present
  useEffect(() => {
    if (!enabled || !clientId) return
    if (window.google?.accounts?.id) {
      initGoogle()
      return
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    if (existing) {
      existing.addEventListener('load', initGoogle)
      return () => existing.removeEventListener('load', initGoogle)
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initGoogle
    document.head.appendChild(script)

    function initGoogle() {
      if (initializedRef.current) return
      if (!window.google?.accounts?.id || !clientId) return
      initializedRef.current = true
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential as any,
          auto_select: false,
        })
        if (btnRef.current) {
          window.google.accounts.id.renderButton(btnRef.current, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: mode === 'register' ? 'signup_with' : 'signin_with',
            locale: 'tr',
          })
        }
      } catch (e) {
        console.warn('Google init failed', e)
      }
    }

    async function handleCredential(response: { credential: string }) {
      setError('')
      setLoading(true)
      try {
        const user = await googleLogin(response.credential)
        router.push(user.is_admin ? '/stores' : '/dashboard')
      } catch (err: any) {
        setError(err?.message || 'Google ile giriş başarısız')
      } finally {
        setLoading(false)
      }
    }

    // Cleanup not needed
  }, [enabled, clientId, googleLogin, router, mode])

  // Fallback: custom popup via oauth2 token client (if GIS button not rendered, allow click fallback)
  const handleFallbackClick = async () => {
    if (!clientId || !window.google?.accounts?.oauth2) {
      setError('Google Girişi şu anda yapılandırılmadı. Lütfen yöneticiyle iletişime geçin.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (resp: any) => {
          if (resp.error) {
            setError(resp.error)
            setLoading(false)
            return
          }
          const accessToken = resp.access_token as string
          try {
            const user = await googleLogin('', accessToken)
            router.push(user.is_admin ? '/stores' : '/dashboard')
          } catch (e: any) {
            setError(e?.message || 'Google ile giriş başarısız')
          } finally {
            setLoading(false)
          }
        },
      })
      tokenClient.requestAccessToken()
    } catch (e: any) {
      setError(e?.message || 'Google penceresi açılamadı')
      setLoading(false)
    }
  }

  if (enabled === false) {
    return null // silently hide when not configured (no clientId)
  }

  if (enabled === null) {
    return (
      <div className="flex justify-center py-2">
        <div className="h-9 w-full max-w-[320px] animate-pulse rounded-lg bg-zinc-100" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="relative flex items-center gap-3 py-2">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs text-zinc-500">veya</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>
      {/* GIS rendered button */}
      <div ref={btnRef} className="flex justify-center" />
      {/* Fallback/custom branded button - visible if GIS didn't render quickly */}
      <button
        type="button"
        onClick={handleFallbackClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {loading ? 'Giriş yapılıyor...' : mode === 'register' ? 'Google ile Kaydol' : 'Google ile Giriş Yap'}
      </button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  )
}
