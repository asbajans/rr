'use client'

import { trackWhatsappClick } from '@/lib/analytics'

const WHATSAPP_NUMBER = '15054415616'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Merhaba Rahatio, bilgi almak istiyorum.')}`

export function WhatsappButton() {
  const handleClick = () => {
    try { trackWhatsappClick('landing_fab') } catch {}
  }

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp ile destek alın"
      onClick={handleClick}
      className="group fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition-all hover:scale-105 hover:bg-[#20bd5a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* pulse ring */}
      <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-30 animate-pulse-ring pointer-events-none" />
      {/* WhatsApp icon */}
      <svg viewBox="0 0 32 32" className="relative h-7 w-7" fill="currentColor" aria-hidden="true">
        <path d="M19.11 17.39c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.62.14-.18.27-.71.88-.87 1.06-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.34-.8-.71-1.34-1.59-1.5-1.86-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.05-.22-.53-.44-.46-.62-.47h-.53c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27 0 1.34.98 2.63 1.12 2.81.14.18 1.93 2.95 4.68 4.14.65.28 1.16.45 1.55.58.65.21 1.24.18 1.71.11.52-.08 1.6-.65 1.82-1.28.22-.63.22-1.17.16-1.28-.07-.11-.25-.18-.52-.32z" />
        <path d="M26.6 5.4A13.32 13.32 0 0 0 16 1.5C8.43 1.5 2.26 7.67 2.26 15.24c0 2.41.63 4.77 1.84 6.85L2 30l8.11-2.12A13.15 13.15 0 0 0 16 29.5c7.57 0 13.74-6.17 13.74-13.74 0-3.67-1.43-7.12-4.14-9.36zm-10.6 22a11.06 11.06 0 0 1-5.64-1.54l-.4-.24-4.81 1.26 1.28-4.69-.26-.48a11.1 11.1 0 0 1-1.71-5.88C4.46 8.93 9.6 3.79 16 3.79c2.97 0 5.76 1.16 7.86 3.26a11.04 11.04 0 0 1 3.26 7.85c0 6.4-5.13 11.54-11.12 11.9z" />
      </svg>
      <span className="sr-only">WhatsApp Destek</span>
      {/* tooltip on hover - desktop only */}
      <span className="pointer-events-none absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2 hidden whitespace-nowrap rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-md group-hover:block">
        WhatsApp Destek
        <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-zinc-900" />
      </span>
    </a>
  )
}
