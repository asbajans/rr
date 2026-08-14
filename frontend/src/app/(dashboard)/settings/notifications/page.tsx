'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api-client'
import { Mail, MessageSquare, Save, TestTube, CheckCircle, XCircle } from 'lucide-react'

export default function NotificationSettingsPage() {
  const [activeTab, setActiveTab] = useState<'email' | 'sms'>('email')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const [smtp, setSmtp] = useState({ host: '', port: 587, secure: false, user: '', pass: '', from: '' })
  const [sms, setSms] = useState({ accountSid: '', authToken: '', phoneNumber: '' })

  useEffect(() => {
    Promise.all([api.getSmtpSettings(), api.getSmsSettings()]).then(([s, m]) => {
      setSmtp(s)
      setSms(m)
    }).finally(() => setLoading(false))
  }, [])

  const handleSaveSmtp = async () => {
    setSaving(true)
    try {
      await api.updateSmtpSettings(smtp)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSms = async () => {
    setSaving(true)
    try {
      await api.updateSmsSettings(sms)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"><p className="text-zinc-400">Yükleniyor...</p></div>

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Mail className="h-6 w-6" /> Bildirim Ayarları</h1>
          <p className="mt-1 text-sm text-zinc-400">Email (SMTP) ve SMS (Twilio) ayarlarını yapılandırın</p>
        </div>
      </div>

      <div className="mt-4 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1 w-fit">
        <button onClick={() => setActiveTab('email')}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${activeTab === 'email' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>
          <Mail className="h-4 w-4" /> Email (SMTP)
        </button>
        <button onClick={() => setActiveTab('sms')}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${activeTab === 'sms' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}>
          <MessageSquare className="h-4 w-4" /> SMS (Twilio)
        </button>
      </div>

      {testResult && (
        <div className={`mt-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${testResult.ok ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
          {testResult.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {testResult.msg}
        </div>
      )}

      {activeTab === 'email' ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold text-white">SMTP Sunucu Ayarları</h3>
            <p className="mt-1 text-xs text-zinc-500">Email gönderimi için SMTP sunucu bilgilerinizi girin</p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-zinc-500">SMTP Host *</label>
                <input value={smtp.host} onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Port</label>
                <input type="number" value={smtp.port} onChange={e => setSmtp(s => ({ ...s, port: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Kullanıcı Adı / Email *</label>
                <input value={smtp.user} onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))}
                  placeholder="ornek@gmail.com"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Şifre / Uygulama Şifresi</label>
                <input type="password" value={smtp.pass} onChange={e => setSmtp(s => ({ ...s, pass: e.target.value }))}
                  placeholder="••••••"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500" />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Gönderen Adı / Email</label>
                <input value={smtp.from} onChange={e => setSmtp(s => ({ ...s, from: e.target.value }))}
                  placeholder="Mağazam <info@magazam.com>"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <input type="checkbox" checked={smtp.secure} onChange={e => setSmtp(s => ({ ...s, secure: e.target.checked }))}
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-800" />
                  SSL / TLS
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={handleSaveSmtp} disabled={saving || !smtp.host || !smtp.user}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold text-white">Yayın Ayarları</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Bildirimler mağaza ayarlarındaki SMTP yapılandırmasını kullanır. Ayarlanmazsa e-posta gönderimi atlanır.
            </p>
            <div className="mt-3 rounded-lg bg-zinc-800/50 px-4 py-3 text-xs text-zinc-400">
              <p><strong>Gmail için:</strong> Google Hesapları → Güvenlik → İki Aşamalı Doğrulama → Uygulama Şifreleri</p>
              <p className="mt-1"><strong>Outlook için:</strong> Outlook.com → Ayarlar → E-posta → E-posta hesabını yönet → SMTP ayarları</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold text-white">Twilio SMS Ayarları</h3>
            <p className="mt-1 text-xs text-zinc-500">SMS gönderimi için Twilio hesap bilgilerinizi girin</p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-zinc-500">Account SID</label>
                <input value={sms.accountSid} onChange={e => setSms(s => ({ ...s, accountSid: e.target.value }))}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 font-mono" />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Auth Token</label>
                <input type="password" value={sms.authToken} onChange={e => setSms(s => ({ ...s, authToken: e.target.value }))}
                  placeholder="••••••"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 font-mono" />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Telefon Numarası</label>
                <input value={sms.phoneNumber} onChange={e => setSms(s => ({ ...s, phoneNumber: e.target.value }))}
                  placeholder="+905XXXXXXXXX"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500" />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button onClick={handleSaveSms} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                <Save className="h-4 w-4" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h3 className="text-sm font-semibold text-white">Twilio Hakkında</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Twilio hesabı oluşturmak için <a href="https://www.twilio.com/try-twilio" target="_blank" className="text-indigo-400 hover:underline">twilio.com/try-twilio</a> adresini ziyaret edin.
              Ücretsiz deneme ile ayda $15 kredi hediye edilir.
            </p>
            <div className="mt-3 rounded-lg bg-zinc-800/50 px-4 py-3 text-xs text-zinc-400">
              <p>SMS maliyeti: ABD içi ~$0.0079/msg, uluslararası ~$0.04/msg</p>
              <p className="mt-1">Türkiye numarası almak için Twilio Console → Phone Numbers → Buy a Number</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
