'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { AI_HUB_TABS, type AiHubTabKey } from '@/lib/ai-hub'
import { ProvidersTab } from './_tabs/providers'
import { ScenariosTab } from './_tabs/scenarios'
import { RateLimitsTab } from './_tabs/rate-limits'
import { SettingsTab } from './_tabs/settings'
import { PlaygroundTab } from './_tabs/playground'

function SuperAiHub() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = (searchParams.get('tab') as AiHubTabKey) || 'providers'

  function setTab(key: AiHubTabKey) {
    router.replace(`/super-ai?tab=${key}`)
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Sparkles className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">AI Yönetimi</h1>
          <p className="text-sm text-zinc-400">Süper admin AI sağlayıcıları, senaryolar, limitler, global ayarlar ve test.</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-zinc-700">
        {AI_HUB_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium ${tab === t.key ? 'border-b-2 border-amber-400 text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'providers' && <ProvidersTab />}
        {tab === 'scenarios' && <ScenariosTab />}
        {tab === 'rate-limits' && <RateLimitsTab />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'test' && <PlaygroundTab />}
      </div>
    </div>
  )
}

export default function SuperAiPage() {
  return (
    <Suspense fallback={<div className="text-zinc-500">Yükleniyor...</div>}>
      <SuperAiHub />
    </Suspense>
  )
}
