import { useTranslation } from 'react-i18next'

export function PreviewSettingsPage() {
  const { t } = useTranslation()

  return (
    <main>
      <h1>{t('project.preview')}</h1>
    </main>
  )
}
