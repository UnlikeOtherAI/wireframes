import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'

function getInitialLocale(): string {
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/)
  return match ? match[1] : 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: getInitialLocale(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
