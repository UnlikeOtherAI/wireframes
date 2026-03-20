import type { CSSProperties } from 'react'

export const adminColors = {
  pageBg: '#F5F3F0',
  cardBg: '#FFFFFF',
  border: '#ECEAE6',
  borderSubtle: '#F5F3F0',
  borderMuted: '#F0EDEA',
  surfaceHover: '#FAFAF9',
  surfaceMuted: '#F6F4F2',
  textPrimary: '#1A1D1F',
  textSecondary: '#6F767E',
  textTertiary: '#9A9FA5',
  primary: '#F56522',
  primaryHover: '#E05A1D',
  primaryTint: '#FEF0EB',
  primaryTintBorder: '#FDDDD0',
  successText: '#22C55E',
  successBg: '#F0FDF4',
  dangerText: '#EF4444',
  dangerBg: '#FEF2F2',
  warningText: '#6D4C00',
  warningBg: '#FFF8E1',
  warningBorder: '#FFE082',
} as const

export const adminRadii = {
  card: 16,
  button: 10,
  input: 10,
  pill: 999,
} as const

export const adminShadows = {
  modal: '0 24px 60px rgba(0, 0, 0, 0.18)',
  card: '0 4px 12px rgba(0, 0, 0, 0.06)',
  dropdown: '0 4px 12px rgba(0, 0, 0, 0.08)',
} as const

export const pageShellStyle: CSSProperties = {
  minHeight: '100vh',
  background: adminColors.pageBg,
  color: adminColors.textPrimary,
}

export const cardSurfaceStyle: CSSProperties = {
  background: adminColors.cardBg,
  border: `1px solid ${adminColors.border}`,
  borderRadius: adminRadii.card,
}

export const primaryButtonStyle: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '12px 16px',
  border: 'none',
  borderRadius: adminRadii.button,
  background: adminColors.primary,
  color: '#FFFFFF',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

export const secondaryButtonStyle: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '12px 16px',
  border: `1px solid ${adminColors.primaryTintBorder}`,
  borderRadius: adminRadii.button,
  background: adminColors.primaryTint,
  color: adminColors.primaryHover,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

export const ghostButtonStyle: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '8px 12px',
  border: 'none',
  borderRadius: adminRadii.button,
  background: 'transparent',
  color: adminColors.textSecondary,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

export const inputStyle: CSSProperties = {
  minHeight: 40,
  padding: '10px 12px',
  border: `1px solid ${adminColors.border}`,
  borderRadius: adminRadii.input,
  background: adminColors.cardBg,
  fontSize: 14,
  color: adminColors.textPrimary,
}
