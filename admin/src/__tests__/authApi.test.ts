import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '../stores/authStore'
import { devLogin, exchangeSsoToken, updateLocale } from '../api/auth'

describe('auth API', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'test-token', isAuthenticated: true, user: null })
    vi.restoreAllMocks()
  })

  it('exchangeSsoToken calls POST /auth/sso with token', async () => {
    const mockResponse = {
      token: 'jwt-abc',
      user: { id: '1', email: 'a@b.com', displayName: 'Alice', locale: 'en' },
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const result = await exchangeSsoToken('sso-token-123')

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect((url as string).endsWith('/auth/sso')).toBe(true)
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ token: 'sso-token-123' })
    expect(result).toEqual(mockResponse)
  })

  it('updateLocale calls PATCH /users/me/locale', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )

    await updateLocale('fr')

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect((url as string).endsWith('/users/me/locale')).toBe(true)
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(init?.body as string)).toEqual({ locale: 'fr' })
  })

  it('devLogin calls POST /auth/dev-login', async () => {
    const mockResponse = {
      token: 'jwt-dev',
      user: { id: '1', email: 'dev@wireframes.local', displayName: 'Local Developer', locale: 'en' },
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    )

    const result = await devLogin()

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0]
    expect((url as string).endsWith('/auth/dev-login')).toBe(true)
    expect(init?.method).toBe('POST')
    expect(result).toEqual(mockResponse)
  })
})
