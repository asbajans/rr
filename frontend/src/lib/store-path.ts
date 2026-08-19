/**
 * Host/path helpers for the storefront.
 *
 * Storefronts are served from two places:
 *   1. The platform domain  → /stores/{siteCode}/...
 *   2. A seller's own domain → same-origin relative paths (the edge proxy in
 *      proxy.ts rewrites the custom host to /stores/{siteCode}/...)
 *
 * Use storeBase(siteCode) to build internal storefront links so navigation
 * stays on the current host (custom domain vs platform domain).
 */

export const PLATFORM_DOMAINS = ['rahatio.com.tr']

export function normalizeHost(host?: string): string {
  if (!host) return ''
  let h = host.toLowerCase()
  if (h.startsWith('www.')) h = h.slice(4)
  const port = h.indexOf(':')
  if (port > 0) h = h.slice(0, port)
  return h.replace(/\.$/, '')
}

export function isCustomDomainHost(host?: string): boolean {
  const h = normalizeHost(host || (typeof window !== 'undefined' ? window.location.host : ''))
  if (!h) return false
  if (PLATFORM_DOMAINS.some((d) => h === d || h.endsWith(`.${d}`))) return false
  if (h === 'localhost' || h.endsWith('.localhost')) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false
  return true
}

/**
 * Base path for storefront links. On a custom domain this is '' (same-origin
 * relative links keep the visitor on the custom domain). On the platform
 * domain it is `/stores/{siteCode}`.
 */
export function storeBase(siteCode: string, host?: string): string {
  return isCustomDomainHost(host) ? '' : `/stores/${siteCode}`
}