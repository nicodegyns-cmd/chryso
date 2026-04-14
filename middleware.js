// middleware.js - IP blocking middleware for Next.js
import { NextResponse } from 'next/server'

// In-memory cache to avoid DB hit on every request
let blockedIpsCache = new Set()
let lastFetch = 0
const CACHE_TTL_MS = 60 * 1000 // refresh every 60 seconds

async function refreshBlockedIps(baseUrl) {
  // Try localhost:3000 first (direct, no proxy), then fall back to baseUrl
  const urls = [
    'http://localhost:3000/api/admin/blocked-ips',
    `${baseUrl}/api/admin/blocked-ips`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) continue
      const data = await res.json()
      if (Array.isArray(data)) {
        blockedIpsCache = new Set(data.map(r => r.ip_address))
        lastFetch = Date.now()
        return
      }
    } catch (_) {
      // try next URL
    }
  }
  // Fail open — don't block traffic if DB unreachable
}

export async function middleware(req) {
  const now = Date.now()

  // Skip for static files and _next internals
  const { pathname } = req.nextUrl
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/admin/blocked-ips') // avoid infinite loop
  ) {
    return NextResponse.next()
  }

  // Refresh cache if stale
  if (now - lastFetch > CACHE_TTL_MS) {
    const baseUrl = req.nextUrl.origin
    await refreshBlockedIps(baseUrl)
  }

  // Get client IP
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.ip || '')

  if (ip && blockedIpsCache.has(ip)) {
    return new NextResponse(
      '<html><body style="font-family:sans-serif;text-align:center;padding:80px"><h1>403 — Accès refusé</h1><p>Votre adresse IP a été bloquée par l\'administrateur.</p></body></html>',
      { status: 403, headers: { 'Content-Type': 'text/html' } }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
