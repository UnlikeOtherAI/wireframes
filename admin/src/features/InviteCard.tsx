import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { PendingInvite } from '../api/invites'
import { acceptInvite, declineInvite } from '../api/invites'

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  aspectRatio: '1',
  padding: 16,
  border: '2px dashed #4285f4',
  borderRadius: 8,
  backgroundColor: '#f8f9ff',
  minHeight: 180,
  minWidth: 180,
}

const buttonBase: React.CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '8px 16px',
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: 14,
}

function roleLabel(t: (key: string) => string, role: string): string {
  switch (role) {
    case 'owner':
      return t('dashboard.roleOwner')
    case 'editor':
      return t('dashboard.roleEditor')
    default:
      return t('dashboard.roleViewer')
  }
}

interface InviteCardProps {
  invite: PendingInvite
  onAccepted: (invite: PendingInvite) => void
  onDeclined: (invite: PendingInvite) => void
}

export function InviteCard({ invite, onAccepted, onDeclined }: InviteCardProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)

  async function handleAccept() {
    setAccepting(true)
    try {
      const project = await acceptInvite(invite.token)
      onAccepted(invite)
      navigate(`/projects/${project.id}`)
    } catch {
      setAccepting(false)
    }
  }

  async function handleDecline() {
    setDeclining(true)
    try {
      await declineInvite(invite.id)
      onDeclined(invite)
    } catch {
      setDeclining(false)
    }
  }

  const busy = accepting || declining

  return (
    <div style={cardStyle} aria-label={t('dashboard.invitedTo', { projectName: invite.projectName })}>
      <div>
        <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
          {t('dashboard.invitedTo', { projectName: invite.projectName })}
        </p>
        <p style={{ margin: '0 0 4px', fontSize: 13, color: '#555' }}>
          {t('dashboard.invitedBy', { name: invite.invitedBy })}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#555' }}>
          {t('dashboard.roleOffered', { role: roleLabel(t, invite.role) })}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={busy}
          onClick={handleAccept}
          style={{ ...buttonBase, backgroundColor: '#1a73e8', color: '#fff' }}
        >
          {accepting ? t('dashboard.accepting') : t('dashboard.accept')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleDecline}
          style={{ ...buttonBase, backgroundColor: '#f1f3f4', color: '#333' }}
        >
          {declining ? t('dashboard.declining') : t('dashboard.decline')}
        </button>
      </div>
    </div>
  )
}
