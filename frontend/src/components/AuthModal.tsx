import React, { useState } from 'react'
import type { Student } from '../types'
import { signup } from '../api'

interface AuthModalProps {
  onLogin: (student: Student) => void
}

export const AuthModal: React.FC<AuthModalProps> = ({ onLogin }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Please fill in both name and email.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const student = await signup(name.trim(), email.trim())
      onLogin(student)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-badge">AI Tutor Chatbot</span>
          <h2>Welcome Student</h2>
          <p>Enter your details to save your chat sessions and personalized learning progress.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="auth-name">Full Name</label>
            <input
              id="auth-name"
              type="text"
              placeholder="e.g. Alex Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="auth-email">Email Address</label>
            <input
              id="auth-email"
              type="email"
              placeholder="alex@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Connecting...' : 'Start Learning →'}
          </button>
        </form>
      </div>
    </div>
  )
}
