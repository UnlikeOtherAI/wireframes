import { useTranslation } from 'react-i18next'

export function LoginPage() {
  const { t } = useTranslation()

  return (
    <main>
      <h1>{t('auth.signIn')}</h1>
      <p>{t('auth.signInDescription')}</p>
    </main>
  )
}
