import React, { useState } from 'react'
import type { AdminStudent, Course } from '../../types'

interface StudentsViewProps {
  students: AdminStudent[]
  courses: Course[]
  loading: boolean
  onToggleAdmin: (student: AdminStudent) => Promise<void>
  onAddStudent: (name: string, email: string) => Promise<void>
}

export const StudentsView: React.FC<StudentsViewProps> = ({
  students,
  courses,
  loading,
  onToggleAdmin,
  onAddStudent,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'student'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedStudentView, setSelectedStudentView] = useState<AdminStudent | null>(null)

  // Add form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    await onAddStudent(name, email)
    setName('')
    setEmail('')
    setShowAddModal(false)
  }

  const filteredStudents = students.filter((s) => {
    const q = searchTerm.toLowerCase()
    const matchesQuery = s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    const matchesRole =
      roleFilter === 'all'
        ? true
        : roleFilter === 'admin'
        ? s.is_admin
        : !s.is_admin
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
              placeholder="Search by student name or email..."
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
            <label>Role Filter:</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'student')}
            >
              <option value="all">All Roles ({students.length})</option>
              <option value="admin">Admins Only ({students.filter((s) => s.is_admin).length})</option>
              <option value="student">Students Only ({students.filter((s) => !s.is_admin).length})</option>
            </select>
          </div>

          <span className="results-count">{filteredStudents.length} Students Listed</span>
        </div>

        <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          ➕ Add New Student
        </button>
      </div>

      {/* STUDENTS TABLE */}
      <div className="admin-card">
        <div className="card-body p-0">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Role</th>
                <th>Chat Sessions</th>
                <th>Messages</th>
                <th>Registration Date</th>
                <th>Account Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="user-cell-info">
                      <div className="avatar-circle-sm">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong>{s.name}</strong>
                      </div>
                    </div>
                  </td>
                  <td>{s.email}</td>
                  <td>
                    {s.is_admin ? (
                      <span className="badge badge-purple">Admin</span>
                    ) : (
                      <span className="badge badge-neutral">Student</span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-info">{s.conversations} sessions</span>
                  </td>
                  <td>{s.messages} msgs</td>
                  <td className="text-sm text-muted">
                    {s.last_activity
                      ? new Date(s.last_activity).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Active'}
                  </td>
                  <td>
                    <span className="status-pill online">Active</span>
                  </td>
                  <td>
                    <div className="action-buttons-group">
                      <button
                        type="button"
                        className="btn-tiny"
                        onClick={() => setSelectedStudentView(s)}
                      >
                        👁️ View Detail
                      </button>
                      <button
                        type="button"
                        className="btn-tiny"
                        onClick={() => onToggleAdmin(s)}
                      >
                        {s.is_admin ? 'Demote' : 'Promote Admin'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-table-cell">
                    <div className="empty-state-box">
                      <span>👥</span>
                      <p>No matching student records found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>➕ Register New Student</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>University Email *</label>
                  <input
                    type="email"
                    placeholder="e.g. jdoe@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW STUDENT DETAIL MODAL */}
      {selectedStudentView && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>👤 Student Profile & Activity</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setSelectedStudentView(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="info-box mb-4">
                <p>
                  <strong>Name:</strong> {selectedStudentView.name}
                </p>
                <p>
                  <strong>Email:</strong> {selectedStudentView.email}
                </p>
                <p>
                  <strong>Role:</strong> {selectedStudentView.is_admin ? 'Administrator' : 'Student'}
                </p>
                <p>
                  <strong>Total Sessions:</strong> {selectedStudentView.conversations}
                </p>
                <p>
                  <strong>Total Messages Sent:</strong> {selectedStudentView.messages}
                </p>
              </div>

              <h4>Available Academic Courses</h4>
              <ul className="courses-list-simple mt-2">
                {courses.map((c) => (
                  <li key={c.id} className="course-item-simple">
                    <span className="code-pill">{c.code || 'SYS'}</span> {c.name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedStudentView(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
