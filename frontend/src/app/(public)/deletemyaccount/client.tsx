'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Trash2, ShieldAlert, AlertTriangle, Lock, LogOut, CheckCircle2 } from 'lucide-react'

type Step = 0 | 1 | 2 | 3

export default function DeleteAccountClient() {
  const { user, store, logout } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ message: string; storeDeactivated: boolean } | null>(null)

  const isLoggedIn = !!user
  const isOwner = user?.role === 'owner'

  async function handleFinalDelete() {
    if (!password) { setError('Şifrenizi girin.'); return }
    if (confirmText.trim().toLocaleUpperCase('tr-TR') !== 'SİL') { setError('Lütfen onay kutusuna SİL yazın.'); return }
    setBusy(true)
    setError('')
    try {
      const res = await api.deleteMyAccount(password, confirmText.trim())
      setDone({ message: res.message, storeDeactivated: res.storeDeactivated })
      // clear local auth after 1.5s then redirect
      setTimeout(async () => {
        try { await logout() } catch {}
        router.push('/login')
      }, 2500)
    } catch (e: any) {
      setError(e?.message || 'Hesap silinemedi. Şifrenizi kontrol edin.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Hesabınız pasife alındı</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">{done.message}</p>
        {done.storeDeactivated && (
          <p className="mt-2 text-sm font-medium text-amber-700">Mağazanız da yayından kaldırıldı.</p>
        )}
        <p className="mt-6 text-xs text-zinc-400">Girişiniz kapatıldı. Ana sayfaya yönlendiriliyorsunuz… Eğer bu işlemi yanlışlıkla yaptıysanız lütfen hello@rahatio.com.tr ile iletişime geçin.</p>
        <Link href="/" className="mt-6 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800">Ana Sayfaya Dön</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><ShieldAlert className="h-4 w-4" /> Dikkat — Geri alınamaz işlem</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          Bu sayfa KVKK m.11 ve GDPR 17. madde kapsamındaki <strong>silme / hesap kapatma</strong> talebiniz içindir. Hesabınızı pasife almak 3 ayrı onayla gerçekleşir. Onay sonrası hesabınız derhâl kapatılır ve tekrar giriş yapamazsınız.
        </p>
      </div>

      <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900">Hesabımı Sil</h1>
      <p className="mt-2 text-sm text-zinc-600">rahatio.com.tr/deletemyaccount — Panel &gt; Ayarlar &gt; Hesabımı Sil üzerinden de ulaşabilirsiniz.</p>

      {!isLoggedIn ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-6">
          <p className="text-sm text-zinc-700">Bu işlemi yapmak için giriş yapmanız gerekiyor.</p>
          <Link href="/login?next=/deletemyaccount">
            <Button className="mt-3">Giriş Yap</Button>
          </Link>
          <p className="mt-3 text-xs text-zinc-500">Giriş yaptıktan sonra tekrar bu adrese dönüp talebinizi oluşturabilirsiniz. Destek: <a href="mailto:hello@rahatio.com.tr" className="text-indigo-600 hover:underline">hello@rahatio.com.tr</a></p>
        </div>
      ) : (
        <>
          <div className="mt-6 rounded-xl border border-zinc-200 p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Hesabınız</h2>
            <div className="mt-2 text-sm text-zinc-600">
              <p><span className="font-medium text-zinc-900">{user.name}</span> · {user.email} · <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">{user.role}</span></p>
              {store && <p className="mt-1">Mağaza: <strong>{store.name}</strong> ({store.site_code ?? (store as any).siteCode}) {store.is_active === false && <span className="text-red-600">— pasif</span>}</p>}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-red-200 bg-white p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-red-700"><AlertTriangle className="h-5 w-5" /> Bu işlem ne yapar?</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-zinc-700">
              <li><strong>Hesabınız pasife alınır</strong> — derhâl çıkış yapılır, aynı e-posta/şifre ile tekrar giriş yapamazsınız.</li>
              <li>API anahtarlarınız iptal edilir.</li>
              {isOwner && <li><strong>Sahip</strong> olarak tek yetkili sizseniz <strong>mağazanız da pasife alınır</strong> ve yayından kalkar (aksi halde yalnızca sizin hesabınız kapanır).</li>}
              <li>Aboneliğiniz iptal edilir; bir sonraki yenilemede tahsilat yapılmaz.</li>
              <li>Kişisel verileriniz KVKK m.7 ve VUK 10 yıl gibi mevzuat gereği zorunlu saklama süresi boyunca yalnızca hukuki yükümlülük için saklanır, süre sonunda silinir/anonimleştirilir.</li>
              <li>Pazaryeri bağlantılarınız ve mağaza verileriniz pasife alınırsa erişilemez.</li>
            </ul>
            <p className="mt-3 text-xs text-zinc-500">Detay: <Link href="/gizlilik-politikasi" className="text-indigo-600 hover:underline">Gizlilik</Link> · <Link href="/kvkk-aydinlatma-metni" className="text-indigo-600 hover:underline">KVKK Aydınlatma</Link> · <Link href="/kullanim-sartlari" className="text-indigo-600 hover:underline">Kullanım Şartları</Link></p>
            <p className="mt-2 text-xs text-zinc-500">Yanlışlıkla yaptıysanız 30 gün içinde hello@rahatio.com.tr üzerinden itiraz edebilirsiniz; mevzuat elverdiği ölçüde hesabınız yeniden aktif edilebilir.</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => router.push('/settings')} className="gap-2">
              <LogOut className="h-4 w-4" /> Vazgeç, panele dön
            </Button>
            <Button onClick={() => setStep(1)} className="bg-red-600 hover:bg-red-700 gap-2">
              <Trash2 className="h-4 w-4" /> Hesabımı Sil — 3 adımda onayla
            </Button>
          </div>
          <p className="mt-2 text-xs text-zinc-400">Panele giriş yaparak bu sayfaya geldiniz — talep doğrudan bu hesaba uygulanır.</p>
        </>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setStep(0)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-semibold">1/3 — Emin misiniz?</h3>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Hesabınız <strong>hemen pasife alınacak</strong> ve oturumunuz kapatılacak. Tekrar giriş yapamayacaksınız. Bu işlem tek tıkla geri alınamaz.
            </p>
            <p className="mt-2 text-xs text-zinc-500">Devam ederseniz 2. onay ekranına geçeceksiniz.</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>Vazgeç</Button>
              <Button onClick={() => setStep(2)} className="bg-amber-600 hover:bg-amber-700">Evet, eminim — devam et</Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setStep(0)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" />
              <h3 className="text-base font-semibold">2/3 — Verileriniz ve mağazanız</h3>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
              <li>API anahtarlarınız iptal edilir.</li>
              <li>{isOwner ? 'Tek sahip sizseniz mağazanız yayından kalkar; değilse sadece hesabınız kapanır.' : 'Yalnızca sizin hesabınız kapanır, mağaza açık kalır.'}</li>
              <li>Verileriniz yasal saklama süresi sonunda silinir; bu süre boyunca yalnızca hukuki yükümlülük için tutulur.</li>
            </ul>
            <p className="mt-3 text-xs text-zinc-500">KVKK m.11 kapsamındaki silme hakkınızı kullanıyorsunuz. Son adımda şifreniz ve “SİL” onayı istenecek.</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>Vazgeç</Button>
              <Button onClick={() => setStep(3)} className="bg-red-600 hover:bg-red-700">Anladım, son adıma geç</Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !busy && setStep(0)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-red-700">
              <Lock className="h-5 w-5" />
              <h3 className="text-base font-semibold">3/3 — Son onay</h3>
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              Lütfen şifrenizi girin ve onay kutusuna büyük harfle <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">SİL</code> yazın. Ardından hesabınız pasife alınacak.
            </p>

            {user && <p className="mt-2 text-xs text-zinc-500">Hesap: <strong>{user.email}</strong></p>}

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Şifreniz</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mevcut şifreniz"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700">Onay için SİL yazın</label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="SİL"
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(0)} disabled={busy}>Vazgeç</Button>
              <Button
                onClick={handleFinalDelete}
                disabled={busy || !password || confirmText.trim().toLocaleUpperCase('tr-TR') !== 'SİL'}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'İşleniyor...' : 'Hesabımı Kalıcı Olarak Pasife Al'}
              </Button>
            </div>
            <p className="mt-3 text-center text-[11px] text-zinc-400">Bu butona basarak hesabınızın pasife alınmasını ve yukarıdaki sonuçları kabul ediyorsunuz.</p>
          </div>
        </div>
      )}
    </div>
  )
}
