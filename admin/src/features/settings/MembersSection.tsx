import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  inviteMember,
  updateMemberRole,
  removeMember,
} from '../../api/members'
import type { Member } from '../../api/members'

const sectionStyle: React.CSSProperties = {
  marginBottom: 32,
  padding: 24,
  border: '1px solid #ddd',
  borderRadius: 8,
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid #ddd',
  borderRadius: 4,
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid #ddd',
  borderRadius: 4,
  minHeight: 44,
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

const memberRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 0',
  borderBottom: '1px solid #eee',
}

const errorStyle: React.CSSProperties = {
  color: '#d93025',
  fontSize: 13,
  margin: '4px 0 0',
}

const successStyle: React.CSSProperties = {
  color: '#188038',
  fontSize: 13,
  margin: '4px 0 0',
}

interface MembersSectionProps {
  projectId: string
  members: Member[]
  currentUserId: string
  onMembersChanged: (members: Member[]) => void
}

const ROLES = ['owner', 'editor', 'viewer'] as const

function roleLabelKey(role: string): string {
  if (role === 'owner') return 'settings.owner'
  if (role === 'editor') return 'settings.editorRole'
  return 'settings.viewer'
}

export function MembersSection({ projectId, members, currentUserId, onMembersChanged }: MembersSectionProps) {
  const { t } = useTranslation()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('editor')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  async function handleInvite() {
    const email = inviteEmail.trim()
    if (!email) {
      setInviteError(t('settings.inviteEmailRequired'))
      return
    }
    setInviting(true)
    setInviteError('')
    setInviteSuccess(false)
    try {
      await inviteMember(projectId, email, inviteRole)
      setInviteEmail('')
      setInviteSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('already a member')) {
        setInviteError(t('settings.alreadyMember'))
      } else if (msg.includes('already exists')) {
        setInviteError(t('settings.alreadyInvited'))
      } else {
        setInviteError(t('settings.inviteError'))
      }
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await updateMemberRole(projectId, userId, newRole)
      onMembersChanged(
        members.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)),
      )
    } catch {
      // Role change failed, no update
    }
  }

  async function handleRemove(userId: string) {
    setRemovingId(userId)
    try {
      await removeMember(projectId, userId)
      onMembersChanged(members.filter((m) => m.userId !== userId))
      setConfirmRemoveId(null)
    } catch {
      // Remove failed
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <section style={sectionStyle} aria-label={t('settings.members')}>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>{t('settings.members')}</h2>

      <div role="list" aria-label={t('settings.members')}>
        {members.map((member) => {
          const isCurrentUser = member.userId === currentUserId
          const displayName = member.displayName || member.email

          return (
            <div key={member.userId} style={memberRowStyle} role="listitem">
              <div>
                <span style={{ fontWeight: 500 }}>{displayName}</span>
                {member.displayName && (
                  <span style={{ color: '#666', fontSize: 13, marginLeft: 8 }}>
                    {member.email}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isCurrentUser ? (
                  <span
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#f1f3f4',
                      borderRadius: 4,
                      fontSize: 13,
                    }}
                  >
                    {t(roleLabelKey(member.role))}
                  </span>
                ) : (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                    style={selectStyle}
                    aria-label={t('settings.changeRole')}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{t(roleLabelKey(r))}</option>
                    ))}
                  </select>
                )}
                {!isCurrentUser && confirmRemoveId !== member.userId && (
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveId(member.userId)}
                    style={{ ...buttonBase, backgroundColor: '#fce8e6', color: '#c5221f' }}
                    aria-label={t('settings.removeMember')}
                  >
                    {t('common.delete')}
                  </button>
                )}
                {!isCurrentUser && confirmRemoveId === member.userId && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => handleRemove(member.userId)}
                      disabled={removingId === member.userId}
                      style={{ ...buttonBase, backgroundColor: '#c5221f', color: '#fff', fontSize: 13 }}
                    >
                      {removingId === member.userId ? t('settings.removing') : t('common.confirm')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveId(null)}
                      disabled={removingId === member.userId}
                      style={{ ...buttonBase, backgroundColor: '#f1f3f4', color: '#333', fontSize: 13 }}
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 24 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>{t('settings.inviteMember')}</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input
              type="email"
              placeholder={t('settings.inviteEmail')}
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value)
                setInviteError('')
                setInviteSuccess(false)
              }}
              disabled={inviting}
              style={{ ...inputStyle, width: '100%' }}
              aria-label={t('settings.inviteEmail')}
            />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            disabled={inviting}
            style={selectStyle}
            aria-label={t('settings.inviteRole')}
          >
            <option value="editor">{t('settings.editorRole')}</option>
            <option value="viewer">{t('settings.viewer')}</option>
          </select>
          <button
            type="button"
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            style={{ ...buttonBase, backgroundColor: '#1a73e8', color: '#fff' }}
          >
            {inviting ? t('settings.inviting') : t('settings.invite')}
          </button>
        </div>
        {inviteError && <p style={errorStyle} role="alert">{inviteError}</p>}
        {inviteSuccess && <p style={successStyle} role="status">{t('settings.invited')}</p>}
      </div>
    </section>
  )
}
