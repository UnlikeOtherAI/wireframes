import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'
import '../i18n'
import { ChatPopup } from '../features/chat/ChatPopup'
import { useAuthStore } from '../stores/authStore'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static OPEN = 1
  readyState = MockWebSocket.OPEN
  sent: string[] = []
  closeCalls = 0
  private listeners = new Map<string, Array<(event?: unknown) => void>>()

  constructor(public url: string) {
    MockWebSocket.instances.push(this)
    queueMicrotask(() => this.emit('open'))
  }

  addEventListener(type: string, listener: (event?: unknown) => void) {
    const existing = this.listeners.get(type) ?? []
    existing.push(listener)
    this.listeners.set(type, existing)
  }

  send(payload: string) {
    this.sent.push(payload)
  }

  close() {
    this.closeCalls += 1
    this.emit('close')
  }

  emit(type: string, data?: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(data)
    }
  }
}

describe('ChatPopup', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    MockWebSocket.instances = []
    localStorage.clear()
    sessionStorage.clear()
    useAuthStore.setState({
      user: { id: 'u1', email: 'test@test.com', displayName: 'Test User', locale: 'en' },
      token: 'test-token',
      isAuthenticated: true,
    })
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mockFetch() {
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/chat/sessions/session-1') && method === 'GET') {
        return new Response(JSON.stringify({
          sessionId: 'session-1',
          messages: [{ id: 'm1', role: 'assistant', content: 'Saved history' }],
        }), { status: 200 })
      }

      if (url.endsWith('/chat/sessions') && method === 'POST') {
        return new Response(JSON.stringify({ sessionId: 'session-1', messages: [] }), { status: 201 })
      }

      if (url.includes('/chat/sessions/session-1/messages') && method === 'POST') {
        return new Response(JSON.stringify({
          userMessage: { id: 'u-msg', role: 'user', content: JSON.parse(String(init?.body)).content },
          assistantMessage: { id: 'a-msg', role: 'assistant', content: 'Completed response' },
        }), { status: 200 })
      }

      if (url.includes('/build') && method === 'POST') {
        return new Response(JSON.stringify({
          pages: [],
          css: '',
          js: '',
          routeTable: {},
          indexHtml: '',
          platformIndexes: {},
        }), { status: 200 })
      }

      return new Response('Not found', { status: 404 })
    })
  }

  function renderPopup(projectId = 'project-1', onApplyDocument = vi.fn().mockResolvedValue(undefined)) {
    return render(
      <ChatPopup
        projectId={projectId}
        scope={{
          projectId,
          activePage: 'home',
          selectedNode: 'wf://page/home#hero',
          workspaceMode: 'preview',
          device: 'web',
          renderMode: 'card',
        }}
        onApplyDocument={onApplyDocument}
      />,
    )
  }

  it('opens the socket when the panel opens and closes it when the panel closes', async () => {
    mockFetch()
    renderPopup()

    expect(MockWebSocket.instances).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(MockWebSocket.instances[0].closeCalls).toBeGreaterThan(0)
  })

  it('sends the current scope with each message and triggers build from the quick action', async () => {
    const fetchSpy = mockFetch()
    renderPopup()

    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: 'Build preview' }))
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/build?platform=all'), expect.objectContaining({
        method: 'POST',
        headers: expect.any(Headers),
      }))
    })

    fireEvent.change(screen.getByLabelText('Chat message'), { target: { value: 'Update the hero' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Send' }).closest('form')!)

    await waitFor(() => {
      const messageCall = fetchSpy.mock.calls.find(([url]) => String(url).includes('/messages'))
      expect(messageCall).toBeTruthy()
      const body = JSON.parse(String((messageCall?.[1] as RequestInit).body))
      expect(body.content).toBe('Update the hero')
      expect(body.scope).toMatchObject({
        projectId: 'project-1',
        activePage: 'home',
        selectedNode: 'wf://page/home#hero',
        workspaceMode: 'preview',
        device: 'web',
        renderMode: 'card',
      })
    })
  })

  it('shows a pending diff from websocket events and applies or rejects against the mocked contract', async () => {
    const fetchSpy = mockFetch()
    const onApplyDocument = vi.fn().mockResolvedValue(undefined)
    sessionStorage.setItem('wf_chat_session:project-1', 'session-1')
    renderPopup('project-1', onApplyDocument)

    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    await waitFor(() => expect(screen.getByText('Saved history')).toBeInTheDocument())
    await waitFor(() => expect(MockWebSocket.instances[0].sent.some((entry) => entry.includes('chat.session-1'))).toBe(true))

    act(() => {
      MockWebSocket.instances[0].emit('message', {
        data: JSON.stringify({
          type: 'document.pending',
          payload: {
            documentType: 'page',
            documentId: 'home',
            oldContent: 'title: Old',
            newContent: 'title: New',
          },
        }),
      })
    })

    expect(await screen.findByTestId('chat-diff-preview')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => {
      expect(onApplyDocument).toHaveBeenCalledWith('page', 'home', 'title: New')
    })

    act(() => {
      MockWebSocket.instances[0].emit('message', {
        data: JSON.stringify({
          type: 'document.pending',
          payload: {
            documentType: 'page',
            documentId: 'home',
            oldContent: 'title: Old',
            newContent: 'title: Newer',
          },
        }),
      })
    })
    expect(await screen.findByTestId('chat-diff-preview')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))

    await waitFor(() => {
      const messageCalls = fetchSpy.mock.calls.filter(([url]) => String(url).includes('/messages'))
      expect(messageCalls).toHaveLength(1)
      const body = JSON.parse(String((messageCalls[0][1] as RequestInit).body))
      expect(body.content).toContain('discard the proposed edit')
    })
  })

  it('clears chat history when the project changes', async () => {
    mockFetch()
    sessionStorage.setItem('wf_chat_session:project-1', 'session-1')
    const view = renderPopup('project-1')

    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    expect(await screen.findByText('Saved history')).toBeInTheDocument()

    view.rerender(
      <ChatPopup
        projectId="project-2"
        scope={{ projectId: 'project-2', activePage: 'about', workspaceMode: 'tree', device: 'web', renderMode: 'card' }}
        onApplyDocument={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Saved history')).not.toBeInTheDocument()
    })
  })

  it('shows translated message fallback errors when send fails without an Error object', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.endsWith('/chat/sessions') && method === 'POST') {
        throw 'session-failed'
      }

      return new Response('Not found', { status: 404 })
    })

    renderPopup()

    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }))
    fireEvent.change(screen.getByLabelText('Chat message'), { target: { value: 'Update the hero' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Send' }).closest('form')!)

    expect(await screen.findByRole('alert')).toHaveTextContent('Message failed')
  })

  it('shows translated session fallback errors when resume fails without an Error object', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (url.includes('/chat/sessions/session-1') && method === 'GET') {
        throw 'resume-failed'
      }

      return new Response('Not found', { status: 404 })
    })

    sessionStorage.setItem('wf_chat_session:project-1', 'session-1')
    renderPopup()

    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Chat session failed')
  })
})
