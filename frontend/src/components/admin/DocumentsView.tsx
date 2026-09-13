import React, { useRef, useState } from 'react'
import type { AdminDocument, Course } from '../../types'

interface DocumentsViewProps {
  documents: AdminDocument[]
  courses: Course[]
  loading: boolean
  onUploadDocument: (courseId: string, file: File) => Promise<void>
  onReindexDocument: (docId: string) => Promise<void>
  onReplaceDocument: (docId: string, file: File) => Promise<void>
  onDeleteDocument: (docId: string) => Promise<void>
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  courses,
  loading,
  onUploadDocument,
  onReindexDocument,
  onReplaceDocument,
  onDeleteDocument,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all')

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadCourseId, setUploadCourseId] = useState<string>('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  // Replace file refs
  const replaceInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const handleOpenUpload = () => {
    if (courses.length > 0) {
      setUploadCourseId(courses[0].id)
    }
    setUploadFile(null)
    setShowUploadModal(true)
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadCourseId || !uploadFile) return
    await onUploadDocument(uploadCourseId, uploadFile)
    setShowUploadModal(false)
    setUploadFile(null)
  }

  const filteredDocs = documents.filter((d) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      d.title.toLowerCase().includes(q) ||
      d.file_name.toLowerCase().includes(q) ||
      (d.course_name && d.course_name.toLowerCase().includes(q))
    const matchesCourse =
      selectedCourseFilter === 'all' ? true : d.course_id === selectedCourseFilter
    return matchesSearch && matchesCourse
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
              placeholder="Search by document title or filename..."
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
            <label>Course:</label>
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
            >
              <option value="all">All Courses ({documents.length} docs)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code ? `${c.code}: ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <span className="results-count">{filteredDocs.length} Documents Listed</span>
        </div>

        <button type="button" className="btn btn-primary" onClick={handleOpenUpload}>
          📄 Upload PDF Document
        </button>
      </div>

      {/* DOCUMENTS TABLE */}
      <div className="admin-card">
        <div className="card-body p-0">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Document Title</th>
                <th>Course</th>
                <th>File Type</th>
                <th>Upload Date</th>
                <th>Vector Chunks</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div>
                      <strong>{d.title || d.file_name}</strong>
                      <div className="text-sm text-muted">{d.file_name}</div>
                    </div>
                  </td>
                  <td>
                    <span className="code-pill">
                      {d.course_code || 'General'}
                    </span>
                    <span className="text-sm text-muted ml-1">{d.course_name}</span>
                  </td>
                  <td>
                    <span className="badge badge-info">PDF</span>
                  </td>
                  <td className="text-sm text-muted">
                    {d.created_at
                      ? new Date(d.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Recently'}
                  </td>
                  <td>
                    <span className="badge badge-purple">{d.chunks} chunks</span>
                  </td>
                  <td>
                    <span className="badge badge-success">Indexed & Vectorized</span>
                  </td>
                  <td>
                    <div className="action-buttons-group">
                      <button
                        type="button"
                        className="btn-tiny"
                        onClick={() => onReindexDocument(d.id)}
                        disabled={loading}
                        title="Re-run text chunking and embedding generation"
                      >
                        🔄 Re-index
                      </button>

                      {/* Hidden File Input for Replace */}
                      <input
                        ref={(el) => {
                          replaceInputRefs.current[d.id] = el
                        }}
                        type="file"
                        accept=".pdf"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            await onReplaceDocument(d.id, file)
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-tiny"
                        onClick={() => replaceInputRefs.current[d.id]?.click()}
                        disabled={loading}
                        title="Upload replacement PDF file"
                      >
                        ✏️ Replace
                      </button>

                      <button
                        type="button"
                        className="btn-tiny danger"
                        onClick={() => setDeleteConfirmId(d.id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-table-cell">
                    <div className="empty-state-box">
                      <span>📄</span>
                      <p>No documents uploaded for this criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UPLOAD DOCUMENT MODAL */}
      {showUploadModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3>📄 Upload & Index PDF Lecture</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowUploadModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUploadSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Select Target Course *</label>
                  <select
                    value={uploadCourseId}
                    onChange={(e) => setUploadCourseId(e.target.value)}
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

                <div className="form-group">
                  <label>PDF Document File *</label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    required
                  />
                  <p className="field-hint mt-1">
                    PDF files will be extracted, chunked, and embedded into pgvector HNSW database automatically.
                  </p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!uploadFile || loading}
                >
                  {loading ? 'Processing & Vectorizing...' : 'Upload & Vectorize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="modal-backdrop">
          <div className="modal-card modal-confirm">
            <div className="modal-header danger">
              <h3>⚠️ Confirm Document Deletion</h3>
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
                Are you sure you want to delete this PDF lecture? This will purge all chunk embeddings from the pgvector database.
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
                  await onDeleteDocument(deleteConfirmId)
                  setDeleteConfirmId(null)
                }}
              >
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
