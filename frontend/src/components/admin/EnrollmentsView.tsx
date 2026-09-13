import React, { useState } from 'react'
import type { AdminEnrollment, AdminStudent, Course } from '../../types'

interface EnrollmentsViewProps {
  enrollments: AdminEnrollment[]
  students: AdminStudent[]
  courses: Course[]
  loading: boolean
  onAddEnrollment: (studentId: string, courseId: string) => Promise<void>
  onDeleteEnrollment: (studentId: string, courseId: string) => Promise<void>
}

export const EnrollmentsView: React.FC<EnrollmentsViewProps> = ({
  enrollments,
  students,
  courses,
  loading,
  onAddEnrollment,
  onDeleteEnrollment,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [unenrollConfirm, setUnenrollConfirm] = useState<{ studentId: string; courseId: string; studentName: string; courseName: string } | null>(null)

  const handleOpenAssign = () => {
    if (students.length > 0) setSelectedStudentId(students[0].id)
    if (courses.length > 0) setSelectedCourseId(courses[0].id)
    setShowAssignModal(true)
  }

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudentId || !selectedCourseId) return
    await onAddEnrollment(selectedStudentId, selectedCourseId)
    setShowAssignModal(false)
  }

  const filteredEnrollments = enrollments.filter((e) => {
    const q = searchTerm.toLowerCase()
    return (
      e.student_name.toLowerCase().includes(q) ||
      e.student_email.toLowerCase().includes(q) ||
      e.course_name.toLowerCase().includes(q) ||
      (e.course_code && e.course_code.toLowerCase().includes(q))
    )
  })

  return (
    <div className="admin-view-container">
      {/* STATS OVERVIEW */}
      <div className="admin-metrics-grid grid-3-cols mb-6">
        <div className="metric-card">
          <div className="metric-icon enrollments">🎓</div>
          <div className="metric-content">
            <span className="metric-value">{enrollments.length}</span>
            <span className="metric-label">Active Course Enrollments</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon students">👥</div>
          <div className="metric-content">
            <span className="metric-value">{students.length}</span>
            <span className="metric-label">Registered Students</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon courses">📚</div>
          <div className="metric-content">
            <span className="metric-value">{courses.length}</span>
            <span className="metric-label">Academic Courses Offered</span>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="view-toolbar">
        <div className="search-filter-group">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search enrollments by student name, email, or course..."
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

          <span className="results-count">{filteredEnrollments.length} Records</span>
        </div>

        <button type="button" className="btn btn-primary" onClick={handleOpenAssign}>
          🎓 Assign Student to Course
        </button>
      </div>

      {/* ENROLLMENTS TABLE */}
      <div className="admin-card">
        <div className="card-body p-0">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Student Email</th>
                <th>Enrolled Course</th>
                <th>Enrollment Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnrollments.map((en, index) => (
                <tr key={`${en.student_id}-${en.course_id}-${index}`}>
                  <td>
                    <div className="user-cell-info">
                      <div className="avatar-circle-sm">
                        {en.student_name.charAt(0).toUpperCase()}
                      </div>
                      <strong>{en.student_name}</strong>
                    </div>
                  </td>
                  <td>{en.student_email}</td>
                  <td>
                    <span className="code-pill">{en.course_code || 'SYS'}</span>
                    <span className="ml-2"><strong>{en.course_name}</strong></span>
                  </td>
                  <td className="text-sm text-muted">
                    {en.created_at
                      ? new Date(en.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Enrolled'}
                  </td>
                  <td>
                    <span className="status-pill online">Active</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-tiny danger"
                      onClick={() =>
                        setUnenrollConfirm({
                          studentId: en.student_id,
                          courseId: en.course_id,
                          studentName: en.student_name,
                          courseName: en.course_name,
                        })
                      }
                    >
                      ❌ Remove
                    </button>
                  </td>
                </tr>
              ))}

              {filteredEnrollments.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-table-cell">
                    <div className="empty-state-box">
                      <span>🎓</span>
                      <p>No enrollment records found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ASSIGN ENROLLMENT MODAL */}
      {showAssignModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>🎓 Assign Student to Course</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowAssignModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAssignSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Select Student *</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    required
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Select Course *</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    required
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code ? `${c.code}: ` : ''}
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Assigning...' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNENROLL CONFIRMATION MODAL */}
      {unenrollConfirm && (
        <div className="modal-backdrop">
          <div className="modal-card modal-confirm">
            <div className="modal-header danger">
              <h3>⚠️ Confirm Course Removal</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setUnenrollConfirm(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to remove <strong>{unenrollConfirm.studentName}</strong> from <strong>{unenrollConfirm.courseName}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setUnenrollConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await onDeleteEnrollment(
                    unenrollConfirm.studentId,
                    unenrollConfirm.courseId
                  )
                  setUnenrollConfirm(null)
                }}
              >
                Remove Enrollment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
