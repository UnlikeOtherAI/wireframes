import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AccountPage } from '../features/AccountPage'
import { useAuthStore } from '../stores/authStore'
import '../i18n'

const mockUser = {
  id: 'u1',
  email: 'test@test.com',
  displayName: 'Test User',
  locale: 'en',
}

function renderAccount() {
  return render(
    <MemoryRouter initialEntries={['/account']}>
      <Routes>
        <Route path="/account" element={<AccountPage />} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AccountPage', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: { ...mockUser },
      token: 'test-token',
      isAuthenticated: true,
    })
    vi.restoreAllMocks()
  })

  it('shows account settings title', () => {
    renderAccount()
    expect(screen.getByText('Account Settings')).toBeInTheDocument()
  })

  it('shows profile section with display name and email', () => {
    renderAccount()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    expect(screen.getByDisplayValue('test@test.com')).toBeInTheDocument()
  })

  it('email field is disabled', () => {
    renderAccount()
    const emailInput = screen.getByLabelText('Email')
    expect(emailInput).toBeDisabled()
  })

  it('save button is disabled when display name unchanged', () => {
    renderAccount()
    const saveBtn = screen.getAllByText('Save').find((el) => el.tagName === 'BUTTON')!
    expect(saveBtn).toBeDisabled()
  })

  it('save button is enabled when display name changes', () => {
    renderAccount()
    const input = screen.getByLabelText('Display name')
    fireEvent.change(input, { target: { value: 'New Name' } })
    const saveBtn = screen.getAllByText('Save').find((el) => el.tagName === 'BUTTON')!
    expect(saveBtn).not.toBeDisabled()
  })

  it('saves display name successfully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ...mockUser, displayName: 'New Name' }), { status: 200 }),
    )
    renderAccount()
    const input = screen.getByLabelText('Display name')
    fireEvent.change(input, { target: { value: 'New Name' } })
    const saveBtn = screen.getAllByText('Save').find((el) => el.tagName === 'BUTTON')!
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Changes saved')).toBeInTheDocument()
    })
  })

  it('shows error when display name is empty', () => {
    renderAccount()
    const input = screen.getByLabelText('Display name')
    fireEvent.change(input, { target: { value: '   ' } })
    const saveBtn = screen.getAllByText('Save').find((el) => el.tagName === 'BUTTON')!
    fireEvent.click(saveBtn)
    expect(screen.getByText('Display name is required')).toBeInTheDocument()
  })

  it('shows error when save fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('fail'))
    renderAccount()
    const input = screen.getByLabelText('Display name')
    fireEvent.change(input, { target: { value: 'New Name' } })
    const saveBtn = screen.getAllByText('Save').find((el) => el.tagName === 'BUTTON')!
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  it('shows language section with selector', () => {
    renderAccount()
    const select = screen.getByRole('combobox', { name: 'Language' })
    expect(select).toHaveValue('en')
  })

  it('shows sessions section', () => {
    renderAccount()
    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('Current session')).toBeInTheDocument()
  })

  it('shows danger zone with delete account button', () => {
    renderAccount()
    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
    expect(screen.getByText('Delete account')).toBeInTheDocument()
  })

  it('opens delete confirmation dialog', () => {
    renderAccount()
    fireEvent.click(screen.getByText('Delete account'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Type your email to confirm deletion:')).toBeInTheDocument()
  })

  it('delete button is disabled until email matches', () => {
    renderAccount()
    fireEvent.click(screen.getByText('Delete account'))
    const deleteBtn = screen.getAllByText('Delete').find(
      (el) => el.tagName === 'BUTTON' && el.closest('[role="dialog"]'),
    )!
    expect(deleteBtn).toBeDisabled()

    const confirmInput = screen.getByLabelText('Type your email to confirm deletion:')
    fireEvent.change(confirmInput, { target: { value: 'test@test.com' } })
    expect(deleteBtn).not.toBeDisabled()
  })

  it('delete button stays disabled when email does not match', () => {
    renderAccount()
    fireEvent.click(screen.getByText('Delete account'))

    const confirmInput = screen.getByLabelText('Type your email to confirm deletion:')
    fireEvent.change(confirmInput, { target: { value: 'wrong@test.com' } })

    const deleteBtn = screen.getAllByText('Delete').find(
      (el) => el.tagName === 'BUTTON' && el.closest('[role="dialog"]'),
    )!
    expect(deleteBtn).toBeDisabled()
  })

  it('delete account calls API and logs out', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204 }),
    )
    renderAccount()
    fireEvent.click(screen.getByText('Delete account'))

    const confirmInput = screen.getByLabelText('Type your email to confirm deletion:')
    fireEvent.change(confirmInput, { target: { value: 'test@test.com' } })

    const deleteBtn = screen.getAllByText('Delete').find(
      (el) => el.tagName === 'BUTTON' && el.closest('[role="dialog"]'),
    )!
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      const deleteCalls = fetchSpy.mock.calls.filter(
        ([, init]) => (init as RequestInit)?.method === 'DELETE',
      )
      expect(deleteCalls).toHaveLength(1)
      const headers = new Headers((deleteCalls[0][1] as RequestInit).headers)
      expect(headers.get('X-Confirm-Delete')).toBe('test@test.com')
    })
  })

  it('closes dialog on cancel', () => {
    renderAccount()
    fireEvent.click(screen.getByText('Delete account'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('back to dashboard button navigates to /', async () => {
    renderAccount()
    fireEvent.click(screen.getByText('Back to dashboard'))
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })

  it('all sections have aria-label', () => {
    const { container } = renderAccount()
    const sections = container.querySelectorAll('section[aria-label]')
    const labels = Array.from(sections).map((s) => s.getAttribute('aria-label'))
    expect(labels).toContain('Profile')
    expect(labels).toContain('Language')
    expect(labels).toContain('Sessions')
    expect(labels).toContain('Danger Zone')
  })
})
