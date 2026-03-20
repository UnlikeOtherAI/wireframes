import { describe, it, expect } from 'vitest'
import { buildSsoUrl } from '../utils/sso'

describe('buildSsoUrl', () => {
  it('builds SSO URL with callback parameter', () => {
    const url = buildSsoUrl('https://admin.example.com/auth/callback')
    const parsed = new URL(url)
    expect(parsed.origin).toBe('https://authenticator.unlikeother.ai')
    expect(parsed.pathname).toBe('/authorize')
    expect(parsed.searchParams.get('callback')).toBe(
      'https://admin.example.com/auth/callback',
    )
  })

  it('encodes callback URL with query params', () => {
    const callback = 'https://admin.example.com/auth/callback?returnUrl=%2Fprojects'
    const url = buildSsoUrl(callback)
    const parsed = new URL(url)
    expect(parsed.searchParams.get('callback')).toBe(callback)
  })
})
