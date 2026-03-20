import { useTranslation } from 'react-i18next'

export function ProjectEditorPage() {
  const { t } = useTranslation()

  return (
    <main>
      <h1>{t('project.editor')}</h1>
    </main>
  )
}
