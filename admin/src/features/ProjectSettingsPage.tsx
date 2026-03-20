import { useTranslation } from 'react-i18next'

export function ProjectSettingsPage() {
  const { t } = useTranslation()

  return (
    <main>
      <h1>{t('project.settings')}</h1>
    </main>
  )
}
