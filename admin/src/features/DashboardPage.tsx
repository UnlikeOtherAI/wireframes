import { useTranslation } from 'react-i18next'

export function DashboardPage() {
  const { t } = useTranslation()

  return (
    <main>
      <h1>{t('dashboard.title')}</h1>
    </main>
  )
}
