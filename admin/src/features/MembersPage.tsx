import { useTranslation } from 'react-i18next'

export function MembersPage() {
  const { t } = useTranslation()

  return (
    <main>
      <h1>{t('project.members')}</h1>
    </main>
  )
}
