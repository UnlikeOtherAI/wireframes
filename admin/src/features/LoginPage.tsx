import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { devLogin } from '../api/auth'
import { useAuthStore } from '../stores/authStore'
import {
  adminColors,
  adminRadii,
  adminShadows,
  cardSurfaceStyle,
  pageShellStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from '../styles/adminTheme'
import { buildSsoUrl } from '../utils/sso'

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [devLoginError, setDevLoginError] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const returnUrl = searchParams.get('returnUrl')
  const devAuthEnabled = import.meta.env.VITE_DEV_AUTH_ENABLED === 'true'

  function handleSignIn() {
    const callbackUrl = new URL('/auth/callback', window.location.origin)
    if (returnUrl) {
      callbackUrl.searchParams.set('returnUrl', returnUrl)
    }
    window.location.href = buildSsoUrl(callbackUrl.toString())
  }

  async function handleDevLogin() {
    setIsSubmitting(true)
    setDevLoginError(false)

    try {
      const session = await devLogin()
      useAuthStore.getState().login(session.token, session.user)
      navigate(returnUrl || '/', { replace: true })
    } catch {
      setDevLoginError(true)
      setIsSubmitting(false)
    }
  }

  return (
    <main
      style={{
        ...pageShellStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <section
        data-testid="login-card"
        style={{
          ...cardSurfaceStyle,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          width: '100%',
          maxWidth: 420,
          padding: 20,
          boxShadow: adminShadows.card,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            display: 'grid',
            placeItems: 'center',
            borderRadius: adminRadii.card,
            background: adminColors.primaryTint,
            color: adminColors.primary,
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 20,
          }}
        >
          W
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, lineHeight: 1.2 }}>
          {t('auth.signIn')}
        </h1>
        <p style={{ margin: '0 0 20px', color: adminColors.textSecondary, fontSize: 14, lineHeight: 1.5, maxWidth: 320 }}>
          {t('auth.signInDescription')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch', width: '100%' }}>
        <button
          type="button"
          onClick={handleSignIn}
          style={primaryButtonStyle}
        >
          {t('auth.signIn')}
        </button>
        {devAuthEnabled ? (
          <button
            type="button"
            onClick={handleDevLogin}
            disabled={isSubmitting}
            style={{
              ...secondaryButtonStyle,
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? 'progress' : 'pointer',
            }}
          >
            {isSubmitting ? t('auth.devSigningIn') : t('auth.devLogin')}
          </button>
        ) : null}
        </div>
        {devLoginError ? (
          <p
            role="alert"
            style={{
              margin: '14px 0 0',
              padding: '10px 12px',
              borderRadius: adminRadii.button,
              background: adminColors.dangerBg,
              color: adminColors.dangerText,
              fontSize: 13,
            }}
          >
            {t('auth.devLoginError')}
          </p>
        ) : null}
      </section>
    </main>
  )
}
