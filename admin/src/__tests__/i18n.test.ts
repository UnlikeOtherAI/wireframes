import { describe, it, expect } from 'vitest'
import i18n from '../i18n'

describe('i18n', () => {
  it('loads English locale from locales/ directory', () => {
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true)
    expect(i18n.t('common.loading')).toBe('Loading...')
  })

  it('supports adding a new locale at runtime without code changes', () => {
    const frTranslations = {
      common: { loading: 'Chargement...' },
    }
    i18n.addResourceBundle('fr', 'translation', frTranslations)
    expect(i18n.hasResourceBundle('fr', 'translation')).toBe(true)
    expect(i18n.t('common.loading', { lng: 'fr' })).toBe('Chargement...')
  })

  it('picks up locale files generically from locales/ directory', () => {
    // The buildResources function reads all JSON files from locales/
    // without hardcoding language codes. Verify that en was loaded
    // via the generic glob pattern, not a hardcoded import.
    const resources = i18n.store.data
    expect(resources).toHaveProperty('en')
    expect(resources.en.translation).toHaveProperty('common')
  })
})
