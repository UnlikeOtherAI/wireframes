import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { exchangeSsoToken } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import { setLocaleCookie } from '../utils/locale'

export function AuthCallbackPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState(false)
  const calledRef = useRef(false)

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    const ssoToken = searchParams.get('token')
    const returnUrl = searchParams.get('returnUrl') || '/'

    if (!ssoToken) {
      setError(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
      return
    }

    exchangeSsoToken(ssoToken)
      .then(({ token, refreshToken, user }) => {
        useAuthStore.getState().login(token, refreshToken, user)
        if (user.locale && user.locale !== i18n.language) {
          i18n.changeLanguage(user.locale)
        }
        setLocaleCookie(user.locale || 'en')
        navigate(returnUrl, { replace: true })
      })
      .catch(() => {
        setError(true)
        setTimeout(() => navigate('/login', { replace: true }), 3000)
      })
  }, [searchParams, navigate, i18n])

  if (error) {
    return (
      <main>
        <p role="alert">{t('auth.authError')}</p>
      </main>
    )
  }

  return (
    <main>
      <p>{t('auth.signingIn')}</p>
    </main>
  )
}
