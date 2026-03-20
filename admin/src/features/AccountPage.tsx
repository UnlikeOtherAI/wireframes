import { useTranslation } from 'react-i18next'

export function AccountPage() {
  const { t } = useTranslation()

  return (
    <main>
      <h1>{t('account.title')}</h1>
    </main>
  )
}
