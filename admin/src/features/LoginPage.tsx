import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { buildSsoUrl } from '../utils/sso'

export function LoginPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')

  function handleSignIn() {
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (returnUrl) {
      callbackUrl.searchParams.set('returnUrl', returnUrl)
    }
    window.location.href = buildSsoUrl(callbackUrl.toString())
  }

  return (
    <main>
      <h1>{t('auth.signIn')}</h1>
      <p>{t('auth.signInDescription')}</p>
      <button
        type="button"
        onClick={handleSignIn}
        style={{ minWidth: 44, minHeight: 44 }}
      >
        {t('auth.signIn')}
      </button>
    </main>
  )
}
