import React from 'react'
import type { Student } from '../../types'

export type AdminTab =
  | 'dashboard'
  | 'courses'
  | 'students'
  | 'documents'
  | 'enrollments'
  | 'rag'
  | 'activity'
  | 'settings'

interface AdminLayoutProps {
  currentStudent: Student
  activeTab: AdminTab
  onSelectTab: (tab: AdminTab) => void
  onClose: () => void
  children: React.ReactNode
  error?: string | null
  success?: string | null
  onClearMessages?: () => void
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentStudent,
  activeTab,
  onSelectTab,
  onClose,
  children,
  error,
  success,
  onClearMessages,
}) => {
  const navItems: { id: AdminTab; label: string; icon: string; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'courses', label: 'Courses', icon: '📚' },
    { id: 'students', label: 'Students', icon: '👥' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'enrollments', label: 'Enrollments', icon: '🎓' },
    { id: 'rag', label: 'RAG & AI', icon: '⚡' },
    { id: 'activity', label: 'Activity', icon: '📋' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <div className="admin-portal-wrapper">
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="brand-logo-icon">🏛️</div>
          <div className="brand-text">
            <h2>UniTutor Admin</h2>
            <span className="brand-sub">Management & Governance</span>
          </div>
        </div>

        <div className="admin-nav-section">
          <div className="nav-header">NAVIGATION</div>
          <nav className="admin-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`admin-nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => {
                  onSelectTab(item.id)
                  if (onClearMessages) onClearMessages()
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="admin-sidebar-footer">
          <div className="admin-user-badge">
            <div className="avatar-circle">
              {currentStudent.name.charAt(0).toUpperCase()}
            </div>
            <div className="admin-user-info">
              <span className="admin-name">{currentStudent.name}</span>
              <span className="admin-role">Administrator</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="admin-main">
        {/* TOP HEADER BAR */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <h1 className="portal-title">
              {navItems.find((n) => n.id === activeTab)?.label} Control Center
            </h1>
            <span className="portal-tag">University AI Tutor Administration</span>
          </div>

          <div className="topbar-right">
            <div className="status-pill online">
              <span className="status-dot"></span> System Operational
            </div>
            <button
              type="button"
              className="btn-exit-portal"
              onClick={onClose}
              title="Return to Student Tutor Mode"
            >
              ✕ Exit Admin Portal
            </button>
          </div>
        </header>

        {/* TOAST ALERTS */}
        {(error || success) && (
          <div className="admin-alerts-container">
            {error && (
              <div className="admin-toast toast-error">
                <span>⚠️ {error}</span>
                {onClearMessages && (
                  <button type="button" onClick={onClearMessages} className="toast-dismiss">
                    ✕
                  </button>
                )}
              </div>
            )}
            {success && (
              <div className="admin-toast toast-success">
                <span>✅ {success}</span>
                {onClearMessages && (
                  <button type="button" onClick={onClearMessages} className="toast-dismiss">
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW BODY */}
        <div className="admin-content-body">{children}</div>
      </main>
    </div>
  )
}
