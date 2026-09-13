import React, { useState } from 'react'
import type { Course } from '../../types'

interface CoursesViewProps {
  courses: Course[]
  loading: boolean
  onSaveCourse: (id: string | null, name: string, code: string, desc: string) => Promise<void>
  onDeleteCourse: (id: string) => Promise<void>
}

export const CoursesView: React.FC<CoursesViewProps> = ({
  courses,
  loading,
  onSaveCourse,
  onDeleteCourse,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')

  const handleOpenAdd = () => {
    setEditingCourse(null)
    setName('')
    setCode('')
    setDescription('')
    setShowModal(true)
  }

  const handleOpenEdit = (c: Course) => {
    setEditingCourse(c)
    setName(c.name)
    setCode(c.code || '')
    setDescription(c.description || '')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await onSaveCourse(editingCourse ? editingCourse.id : null, name, code, description)
    setShowModal(false)
  }

  const filteredCourses = courses.filter((c) => {
    const q = searchTerm.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q))
    )
  })

  return (
    <div className="admin-view-container">
      {/* SECTION TOOLBAR */}
      <div className="view-toolbar">
        <div className="search-filter-group">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by course code, title, or description..."
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
          <span className="results-count">{filteredCourses.length} Courses Found</span>
        </div>

        <button type="button" className="btn btn-primary" onClick={handleOpenAdd}>
          ➕ Add New Course
        </button>
      </div>

      {/* COURSES TABLE */}
      <div className="admin-card">
        <div className="card-body p-0">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Course Name</th>
                <th>Description</th>
                <th>Documents</th>
                <th>Chunks</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="code-pill">{c.code || 'N/A'}</span>
                  </td>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>
                    <span className="desc-truncate" title={c.description || ''}>
                      {c.description || 'No description provided'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-info">{c.documents ?? 0} docs</span>
                  </td>
                  <td>
                    <span className="badge badge-neutral">{c.chunks ?? 0} chunks</span>
                  </td>
                  <td>
                    <span className="badge badge-success">Active</span>
                  </td>
                  <td>
                    <div className="action-buttons-group">
                      <button
                        type="button"
                        className="btn-tiny"
                        onClick={() => handleOpenEdit(c)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        className="btn-tiny danger"
                        onClick={() => setDeleteConfirmId(c.id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredCourses.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-table-cell">
                    <div className="empty-state-box">
                      <span>📚</span>
                      <p>No matching courses found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT COURSE MODAL */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>{editingCourse ? '✏️ Edit Course' : '➕ Create New Course'}</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Course Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Data Structures and Algorithms"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Course Code</label>
                  <input
                    type="text"
                    placeholder="e.g. CS201"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    rows={3}
                    placeholder="Comprehensive description of the course content and learning outcomes..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading
                    ? 'Saving...'
                    : editingCourse
                    ? 'Update Course'
                    : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteConfirmId && (
        <div className="modal-backdrop">
          <div className="modal-card modal-confirm">
            <div className="modal-header danger">
              <h3>⚠️ Confirm Course Deletion</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setDeleteConfirmId(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete this course? This action will permanently
                remove all associated PDF documents, vector embeddings, and chat sessions.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  await onDeleteCourse(deleteConfirmId)
                  setDeleteConfirmId(null)
                }}
              >
                Delete Course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
