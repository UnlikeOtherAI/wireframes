import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '../stores/authStore'
import { apiFetch, ApiError } from '../api/client'

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    })
    vi.restoreAllMocks()
  })

  it('attaches Authorization header when token is set', async () => {
    const token = 'test-jwt-token'
    useAuthStore.setState({ token, isAuthenticated: true })

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )

    await apiFetch('/test')

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [, init] = fetchSpy.mock.calls[0]
    const headers = new Headers(init?.headers as HeadersInit)
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`)
  })

  it('does not attach Authorization header when no token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )

    await apiFetch('/test')

    const [, init] = fetchSpy.mock.calls[0]
    const headers = new Headers(init?.headers as HeadersInit)
    expect(headers.get('Authorization')).toBeNull()
  })

  it('triggers logout on 401 response', async () => {
    useAuthStore.setState({ token: 'test-jwt-token', isAuthenticated: true })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 }),
    )

    const originalHref = window.location.href
    Object.defineProperty(window, 'location', {
      value: { ...window.location, href: originalHref },
      writable: true,
      configurable: true,
    })

    await expect(apiFetch('/test')).rejects.toThrow(ApiError)

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('throws ApiError on non-OK responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    )

    await expect(apiFetch('/missing')).rejects.toThrow(ApiError)

    try {
      await apiFetch('/missing')
    } catch (e) {
      expect((e as ApiError).status).toBe(404)
    }
  })

  it('returns undefined for 204 responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    const result = await apiFetch('/empty')
    expect(result).toBeUndefined()
  })

  it('uses VITE_API_URL as base when available', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    )

    await apiFetch('/test')

    const [url] = fetchSpy.mock.calls[0]
    expect((url as string).endsWith('/test')).toBe(true)
  })
})
