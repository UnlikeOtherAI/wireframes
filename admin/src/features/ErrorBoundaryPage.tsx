import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { adminColors, adminRadii, primaryButtonStyle } from '../styles/adminTheme'

export function ErrorBoundaryPage() {
  const { t } = useTranslation()
  const error = useRouteError()

  const is404 = isRouteErrorResponse(error) && error.status === 404

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={codeStyle}>{is404 ? '404' : '500'}</div>
        <h1 style={titleStyle}>
          {is404 ? t('errorPage.notFoundTitle') : t('errorPage.errorTitle')}
        </h1>
        <p style={messageStyle}>
          {is404 ? t('errorPage.notFoundMessage') : t('errorPage.errorMessage')}
        </p>
        <Link to="/" style={primaryButtonStyle}>
          {t('errorPage.backHome')}
        </Link>
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  background: adminColors.pageBg,
  padding: 24,
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  maxWidth: 420,
  padding: '48px 40px',
  background: adminColors.cardBg,
  border: `1px solid ${adminColors.border}`,
  borderRadius: adminRadii.card,
  textAlign: 'center',
}

const codeStyle: React.CSSProperties = {
  fontSize: 64,
  fontWeight: 800,
  color: adminColors.primary,
  lineHeight: 1,
}

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: adminColors.textPrimary,
  margin: 0,
}

const messageStyle: React.CSSProperties = {
  fontSize: 14,
  color: adminColors.textSecondary,
  margin: '0 0 12px',
  lineHeight: 1.5,
}
