import { useTranslation } from 'react-i18next'
import type { ConflictInfo } from './useDocumentManager'

interface ConflictDialogProps {
  conflict: ConflictInfo
  onResolve: (resolution: 'local' | 'server') => void
  onDismiss: () => void
}

export function ConflictDialog({ conflict, onResolve, onDismiss }: ConflictDialogProps) {
  const { t } = useTranslation()

  return (
    <div
      role="dialog"
      aria-label={t('editor.conflictTitle')}
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '500px',
          width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: '18px' }}>
          {t('editor.conflictTitle')}
        </h2>
        <p style={{ margin: '0 0 16px', color: '#555' }}>
          {t('editor.conflictDescription', { type: conflict.documentType })}
        </p>

        {conflict.serverContent !== undefined && (
          <div style={{ marginBottom: '16px' }}>
            <details>
              <summary style={{ cursor: 'pointer', fontSize: '13px', color: '#666' }}>
                {t('editor.viewServerVersion')}
              </summary>
              <pre
                style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  background: '#f5f5f5',
                  padding: '8px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  marginTop: '8px',
                }}
              >
                {conflict.serverContent}
              </pre>
            </details>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onDismiss}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: '#fff',
              cursor: 'pointer',
              minHeight: '44px',
              minWidth: '44px',
            }}
          >
            {t('common.cancel')}
          </button>
          {conflict.serverContent !== undefined && (
            <button
              onClick={() => onResolve('server')}
              style={{
                padding: '8px 16px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: '#fff',
                cursor: 'pointer',
                minHeight: '44px',
                minWidth: '44px',
              }}
            >
              {t('editor.useServerVersion')}
            </button>
          )}
          <button
            onClick={() => onResolve('local')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              background: '#1976d2',
              color: '#fff',
              cursor: 'pointer',
              minHeight: '44px',
              minWidth: '44px',
            }}
          >
            {t('editor.useLocalVersion')}
          </button>
        </div>
      </div>
    </div>
  )
}
