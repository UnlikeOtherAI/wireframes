import { describe, it, expect } from 'vitest'
import { decodeJwtPayload, isTokenExpired } from '../utils/jwt'

function encodePayload(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.signature`
}

describe('decodeJwtPayload', () => {
  it('decodes a valid JWT payload', () => {
    const token = encodePayload({ sub: '123', exp: 9999999999 })
    const payload = decodeJwtPayload(token)
    expect(payload).toEqual({ sub: '123', exp: 9999999999 })
  })

  it('returns null for malformed token', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(decodeJwtPayload('')).toBeNull()
  })

  it('handles base64url encoding', () => {
    const payload = { sub: 'user+test/value' }
    const header = btoa(JSON.stringify({ alg: 'HS256' }))
    const body = btoa(JSON.stringify(payload))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const token = `${header}.${body}.sig`
    const decoded = decodeJwtPayload(token)
    expect(decoded).toEqual(payload)
  })
})

describe('isTokenExpired', () => {
  it('returns false for a token with future exp', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    const token = encodePayload({ exp: futureExp })
    expect(isTokenExpired(token)).toBe(false)
  })

  it('returns true for a token with past exp', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600
    const token = encodePayload({ exp: pastExp })
    expect(isTokenExpired(token)).toBe(true)
  })

  it('returns true for a token without exp claim', () => {
    const token = encodePayload({ sub: '123' })
    expect(isTokenExpired(token)).toBe(true)
  })

  it('returns true for an invalid token', () => {
    expect(isTokenExpired('invalid')).toBe(true)
  })
})
