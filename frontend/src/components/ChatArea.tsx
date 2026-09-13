import React, { useEffect, useRef, useState } from 'react'
import type { ChatMessage, ChatResponse, Course } from '../types'

// ─── Zero-dependency Markdown renderer ─────────────────────────────────────────
// Converts a subset of Markdown to safe HTML without any external packages.
// Handles: headings, bold, italic, inline-code, code-blocks, blockquotes,
// ordered/unordered lists, and plain paragraphs.
function parseMarkdown(text: string): string {
  // Split into blocks separated by blank lines
  const blocks = text.split(/\n{2,}/)
  const html = blocks.map((block) => {
    const lines = block.split('\n')

    // ── Fenced code block (``` … ```) ────────────────────────────────────────
    if (block.startsWith('```')) {
      const inner = block
        .replace(/^```[^\n]*\n?/, '')
        .replace(/```$/, '')
        .trimEnd()
      return `<pre><code>${escapeHtml(inner)}</code></pre>`
    }

    // ── Blockquote ────────────────────────────────────────────────────────────
    if (lines.every((l) => l.startsWith('> '))) {
      const inner = lines.map((l) => l.slice(2)).join('\n')
      return `<blockquote>${applyInline(inner)}</blockquote>`
    }

    // ── Unordered list (lines starting with - / * / +) ───────────────────────
    if (lines.every((l) => /^[-*+]\s/.test(l))) {
      const items = lines.map((l) => `<li>${applyInline(l.slice(2))}</li>`).join('')
      return `<ul>${items}</ul>`
    }

    // ── Ordered list (lines starting with 1. 2. …) ───────────────────────────
    if (lines.every((l) => /^\d+\.\s/.test(l))) {
      const items = lines.map((l) => `<li>${applyInline(l.replace(/^\d+\.\s/, ''))}</li>`).join('')
      return `<ol>${items}</ol>`
    }

    // ── Headings ──────────────────────────────────────────────────────────────
    const headingMatch = lines[0].match(/^(#{1,4})\s+(.+)/)
    if (headingMatch && lines.length === 1) {
      const level = headingMatch[1].length
      return `<h${level}>${applyInline(headingMatch[2])}</h${level}>`
    }

    // ── Horizontal rule ───────────────────────────────────────────────────────
    if (/^[-*_]{3,}$/.test(lines[0].trim()) && lines.length === 1) {
      return '<hr />'
    }

    // ── Plain paragraph ───────────────────────────────────────────────────────
    const para = lines.join('\n').trim()
    if (!para) return ''
    // If the block is a single line of inline content, wrap in <p>
    return `<p>${applyInline(para)}</p>`
  })

  return html.filter(Boolean).join('\n')
}

/** Escape HTML special characters to prevent XSS in code blocks. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Apply inline Markdown formatting (bold, italic, inline-code, links).
 * Applied to text that is NOT inside a code block.
 */
function applyInline(text: string): string {
  return (
    text
      // Inline code — must come before bold/italic to avoid double-processing
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold (**text** or __text__)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      // Italic (*text* or _text_)
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/_([^_]+)_/g, '<em>$1</em>')
      // Markdown links [label](url)
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
      )
  )
}

/** Render parsed Markdown HTML into the DOM safely via dangerouslySetInnerHTML. */
const MarkdownBody: React.FC<{ content: string }> = ({ content }) => {
  const html = parseMarkdown(content)
  return (
    <div
      className="message-body"
      // Safe because we control the Markdown parser and escapeHtml all code blocks.
      // No user-supplied raw HTML is ever inserted.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ─── Component Props ──────────────────────────────────────────────────────────
interface ChatAreaProps {
  selectedCourse: Course | null
  messages: ChatMessage[]
  lastResponseMeta: ChatResponse | null
  loading: boolean
  onSendMessage: (question: string) => void
}

// ─── ChatArea ─────────────────────────────────────────────────────────────────
export const ChatArea: React.FC<ChatAreaProps> = ({
  selectedCourse,
  messages,
  lastResponseMeta,
  loading,
  onSendMessage,
}) => {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  const handleSend = () => {
    if (!input.trim() || loading) return
    onSendMessage(input.trim())
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }

  const quickQuestions = [
    `What are the core concepts covered in ${selectedCourse?.name || 'this course'}?`,
    'Explain the main topics with simple real-world examples.',
    'What types of questions appear in exams for this course?',
    'Summarize the most important ideas from the uploaded lectures.',
  ]

  return (
    <main className="chat-container">
      {messages.length === 0 ? (
        /* ── Welcome / empty state ── */
        <div className="chat-welcome">
          <div className="welcome-hero">
            <span className="welcome-badge">{selectedCourse?.code || 'COURSE'}</span>
            <h1>{selectedCourse ? selectedCourse.name : 'Welcome to AI Tutor'}</h1>
            <p>
              {selectedCourse?.description ||
                'Ask questions, get step-by-step explanations, and query course documents with intelligent RAG retrieval.'}
            </p>
          </div>

          <div className="quick-starts">
            <span className="quick-starts-label">Try asking:</span>
            <div className="quick-chips">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="chip-btn"
                  onClick={() => onSendMessage(q)}
                  disabled={loading}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── Messages list ── */
        <div className="messages-list">
          {messages.map((msg, index) => (
            <div key={index} className={`message-row ${msg.role}`}>
              <div className="avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>

              <div className="message-content">
                <div className="message-header">
                  <span className="sender-name">{msg.role === 'user' ? 'You' : 'AI Tutor'}</span>
                  {msg.role === 'assistant' && msg.answer_source && (
                    <span className={`source-badge badge-${msg.answer_source}`}>
                      {msg.answer_source === 'rag'
                        ? '📚 Course Documents (RAG)'
                        : '💡 General AI Knowledge'}
                    </span>
                  )}
                </div>

                {/* Render user messages as plain text; AI responses as Markdown */}
                {msg.role === 'user' ? (
                  <div className="message-body">{msg.content}</div>
                ) : (
                  <MarkdownBody content={msg.content} />
                )}

                {/* Show response metadata only on the last assistant message */}
                {msg.role === 'assistant' &&
                  index === messages.length - 1 &&
                  lastResponseMeta && (
                    <div className="retrieval-metadata-panel">
                      <span className="meta-item">
                        ⏱️ Response time:{' '}
                        <strong>{lastResponseMeta.llm_call_time_seconds?.toFixed(2)}s</strong>
                      </span>
                      {lastResponseMeta.retrieved_chunks > 0 && (
                        <span className="meta-item">
                          📄 Retrieved chunks:{' '}
                          <strong>{lastResponseMeta.retrieved_chunks}</strong>
                        </span>
                      )}
                      {lastResponseMeta.retrieval_score > 0 && (
                        <span className="meta-item">
                          🎯 Relevance:{' '}
                          <strong>
                            {(lastResponseMeta.retrieval_score * 100).toFixed(0)}%
                          </strong>
                        </span>
                      )}
                    </div>
                  )}
              </div>
            </div>
          ))}

          {/* Typing indicator while loading */}
          {loading && (
            <div className="message-row assistant loading-row">
              <div className="avatar">🤖</div>
              <div className="message-content">
                <div className="typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* ── Composer ── */}
      <div className="chat-input-area">
        <div className="input-box-wrapper">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInputResize}
            onKeyDown={handleKeyDown}
            placeholder={`Ask a question about ${selectedCourse?.name || 'the course'}… (Enter to send, Shift+Enter for new line)`}
            disabled={loading}
          />
          <button
            type="button"
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            title="Send Message"
          >
            ➔
          </button>
        </div>
      </div>
    </main>
  )
}
