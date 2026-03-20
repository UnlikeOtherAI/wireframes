import { Link, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRightFromBracket, faGear } from '@fortawesome/free-solid-svg-icons'
import { useAuthStore } from '../stores/authStore'
import { adminColors, adminRadii } from '../styles/adminTheme'

export function AppShell() {
  const { t } = useTranslation()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const isEditor = location.pathname.startsWith('/projects/') && !location.pathname.includes('/settings') && !location.pathname.includes('/members') && !location.pathname.includes('/preview')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: adminColors.pageBg }}>
      {/* Consistent top bar */}
      <header style={topBarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/" style={logoLinkStyle}>
            <div style={logoIconStyle}>W</div>
            <span style={logoTextStyle}>Wireframes</span>
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user && (
            <span style={{ fontSize: 13, color: adminColors.textSecondary }}>{user.displayName || user.email}</span>
          )}
          <Link to="/account" aria-label={t('nav.account')} style={iconNavBtnStyle}>
            <FontAwesomeIcon icon={faGear} />
          </Link>
          <button type="button" onClick={logout} aria-label={t('nav.logout')} style={iconNavBtnStyle}>
            <FontAwesomeIcon icon={faRightFromBracket} />
          </button>
        </div>
      </header>

      {/* Content area — editor fills remaining height, other pages scroll naturally */}
      <div style={isEditor ? editorContentStyle : pageContentStyle}>
        <Outlet />
      </div>
    </div>
  )
}

const topBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 56,
  padding: '0 20px',
  background: adminColors.cardBg,
  borderBottom: `1px solid ${adminColors.border}`,
  flexShrink: 0,
}

const logoLinkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  textDecoration: 'none',
  color: adminColors.textPrimary,
}

const logoIconStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'grid',
  placeItems: 'center',
  borderRadius: adminRadii.button,
  background: adminColors.primaryTint,
  color: adminColors.primary,
  fontSize: 16,
  fontWeight: 700,
}

const logoTextStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: adminColors.textPrimary,
}

const iconNavBtnStyle: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 36,
  height: 36,
  borderRadius: adminRadii.button,
  border: `1px solid ${adminColors.border}`,
  background: adminColors.cardBg,
  color: adminColors.textSecondary,
  textDecoration: 'none',
  cursor: 'pointer',
  fontSize: 14,
  transition: 'background 150ms ease',
}

const editorContentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

const pageContentStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
}
