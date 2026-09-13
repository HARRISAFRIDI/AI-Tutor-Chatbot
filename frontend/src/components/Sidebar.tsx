import React, { useState } from 'react'
import type { ChatSession, Course } from '../types'

interface SidebarProps {
  courses: Course[]
  selectedCourseId: string | null
  onSelectCourse: (courseId: string) => void
  sessions: ChatSession[]
  activeSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewChat: () => void
  onRenameSession: (sessionId: string, newTitle: string) => void
  onDeleteSession: (sessionId: string) => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  courses,
  selectedCourseId,
  onSelectCourse,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSessionId(session.id)
    setEditingTitle(session.title)
  }

  const handleSaveRename = (sessionId: string) => {
    if (editingTitle.trim()) {
      onRenameSession(sessionId, editingTitle.trim())
    }
    setEditingSessionId(null)
  }

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this chat session?')) {
      onDeleteSession(sessionId)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-action">
        <button type="button" className="btn btn-primary btn-block new-chat-btn" onClick={onNewChat}>
          <span>+</span> New Chat Session
        </button>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Courses</div>
        <ul className="course-list">
          {courses.map((course) => (
            <li key={course.id}>
              <button
                type="button"
                className={`course-item ${course.id === selectedCourseId ? 'active' : ''}`}
                onClick={() => onSelectCourse(course.id)}
              >
                <span className="course-code-badge">{course.code || 'COURSE'}</span>
                <span className="course-title-text">{course.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sidebar-section flex-1">
        <div className="sidebar-section-title">Chat History</div>
        {sessions.length === 0 ? (
          <div className="empty-history-notice">No past chat sessions yet for this course.</div>
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <li key={session.id}>
                {editingSessionId === session.id ? (
                  <div className="session-edit-box">
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(session.id)}
                      autoFocus
                    />
                    <button type="button" className="btn-tiny" onClick={() => handleSaveRename(session.id)}>
                      ✓
                    </button>
                    <button type="button" className="btn-tiny" onClick={() => setEditingSessionId(null)}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <div
                    className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
                    onClick={() => onSelectSession(session.id)}
                  >
                    <span className="session-icon">💬</span>
                    <span className="session-title">{session.title || 'Untitled Chat'}</span>
                    <div className="session-actions">
                      <button
                        type="button"
                        className="session-act-btn"
                        onClick={(e) => handleStartRename(session, e)}
                        title="Rename Chat"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="session-act-btn delete-act"
                        onClick={(e) => handleDelete(session.id, e)}
                        title="Delete Chat"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="memory-info-card">
          <div className="memory-card-header">
            <span>🧠 Memory Activated</span>
          </div>
          <p className="memory-card-body">
            The tutor automatically records your preferences, favorite topics & learning style to personalize explanations.
          </p>
        </div>
      </div>
    </aside>
  )
}
