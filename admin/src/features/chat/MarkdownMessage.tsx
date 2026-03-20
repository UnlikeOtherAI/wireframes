import React from 'react'

interface MarkdownMessageProps {
  content: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatInline(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function renderMarkdown(content: string): string {
  const blocks = content.split(/\n{2,}/)
  return blocks.map((block) => {
    if (block.startsWith('```') && block.endsWith('```')) {
      const code = block.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '')
      return `<pre><code>${escapeHtml(code)}</code></pre>`
    }

    const lines = block.split('\n')
    if (lines.every((line) => line.startsWith('- '))) {
      return `<ul>${lines.map((line) => `<li>${formatInline(line.slice(2))}</li>`).join('')}</ul>`
    }

    return `<p>${lines.map((line) => formatInline(line)).join('<br />')}</p>`
  }).join('')
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div
      data-testid="chat-markdown-message"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      style={{
        fontSize: '13px',
        lineHeight: 1.5,
        wordBreak: 'break-word',
      }}
    />
  )
}
