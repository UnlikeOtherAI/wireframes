import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  './locales/*.json',
  { eager: true },
)

function buildResources(): Record<string, { translation: Record<string, unknown> }> {
  const resources: Record<string, { translation: Record<string, unknown> }> = {}
  for (const path of Object.keys(localeModules)) {
    const match = path.match(/\.\/locales\/(.+)\.json$/)
    if (match) {
      resources[match[1]] = { translation: localeModules[path].default }
    }
  }
  return resources
}

function getInitialLocale(): string {
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/)
  return match ? match[1] : 'en'
}

i18n.use(initReactI18next).init({
  resources: buildResources(),
  lng: getInitialLocale(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export { buildResources }
export default i18n
