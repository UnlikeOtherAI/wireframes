import i18n from '../i18n'
import { updateLocale } from '../api/auth'

export function setLocaleCookie(locale: string): void {
  document.cookie = `locale=${locale};path=/;max-age=31536000;SameSite=Lax`
}

export function getLocaleCookie(): string {
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/)
  return match ? match[1] : 'en'
}

export async function changeLocale(locale: string): Promise<void> {
  await i18n.changeLanguage(locale)
  setLocaleCookie(locale)
  await updateLocale(locale)
}
