import React, { useState } from 'react'
import type { AdminActivityLog } from '../../types'

interface ActivityViewProps {
  activity: AdminActivityLog[]
}

export const ActivityView: React.FC<ActivityViewProps> = ({ activity }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'assistant'>('all')

  const filteredLogs = activity.filter((act) => {
    const q = searchTerm.toLowerCase()
    const matchesQuery =
      act.student_name.toLowerCase().includes(q) ||
      (act.course_code && act.course_code.toLowerCase().includes(q)) ||
      act.content.toLowerCase().includes(q)
    const matchesRole =
      roleFilter === 'all' ? true : act.role === roleFilter
    return matchesQuery && matchesRole
  })

  return (
    <div className="admin-view-container">
      {/* TOOLBAR */}
      <div className="view-toolbar">
        <div className="search-filter-group">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search audit log by student, course, or text snippet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearchTerm('')}
              >
                ✕
              </button>
            )}
          </div>

          <div className="filter-select-wrapper">
            <label>Sender Type:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'user' | 'assistant')}
            >
              <option value="all">All Senders ({activity.length})</option>
              <option value="user">Student Queries Only ({activity.filter((a) => a.role === 'user').length})</option>
              <option value="assistant">Tutor Responses Only ({activity.filter((a) => a.role === 'assistant').length})</option>
            </select>
          </div>

          <span className="results-count">{filteredLogs.length} Log Entries</span>
        </div>
      </div>

      {/* LOG AUDIT TABLE */}
      <div className="admin-card">
        <div className="card-header">
          <h3>📋 System Activity Audit Trail</h3>
          <span className="badge badge-info">Real-time DB Monitor</span>
        </div>
        <div className="card-body p-0">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Student</th>
                <th>Course</th>
                <th>Role</th>
                <th>Message Snippet</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, index) => (
                <tr key={index}>
                  <td className="text-sm text-muted">
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Recently'}
                  </td>
                  <td>
                    <strong>{log.student_name}</strong>
                  </td>
                  <td>
                    <span className="code-pill">{log.course_code || 'General'}</span>
                  </td>
                  <td>
                    {log.role === 'user' ? (
                      <span className="badge badge-info">Student</span>
                    ) : (
                      <span className="badge badge-purple">AI Assistant</span>
                    )}
                  </td>
                  <td>
                    <span className="desc-truncate text-sm" title={log.content}>
                      "{log.content}"
                    </span>
                  </td>
                  <td>
                    <span className="status-pill online">Logged</span>
                  </td>
                </tr>
              ))}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-table-cell">
                    <div className="empty-state-box">
                      <span>📋</span>
                      <p>No activity logs match your search.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
