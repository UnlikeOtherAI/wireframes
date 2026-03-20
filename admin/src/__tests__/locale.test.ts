import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setLocaleCookie, getLocaleCookie } from '../utils/locale'

describe('locale utils', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    })
  })

  it('setLocaleCookie sets a cookie with the locale value', () => {
    setLocaleCookie('fr')
    expect(document.cookie).toContain('locale=fr')
  })

  it('getLocaleCookie reads locale from cookie', () => {
    document.cookie = 'locale=de'
    expect(getLocaleCookie()).toBe('de')
  })

  it('getLocaleCookie returns en when no cookie is set', () => {
    document.cookie = ''
    expect(getLocaleCookie()).toBe('en')
  })
})
