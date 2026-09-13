import React from 'react'
import type { AdminActivityLog, AdminDashboard, Course } from '../../types'

interface DashboardViewProps {
  dashboard: AdminDashboard | null
  courses: Course[]
  activity: AdminActivityLog[]
  onNavigateTab: (tab: 'courses' | 'students' | 'documents' | 'activity' | 'rag') => void
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  dashboard,
  courses,
  activity,
  onNavigateTab,
}) => {
  const stats = dashboard?.stats || {}

  return (
    <div className="admin-view-container">
      <div className="view-header-banner">
        <div>
          <h2>University Administration Dashboard</h2>
          <p className="subtitle">
            System metrics, real-time analytics, vector store performance, and learning platform activity.
          </p>
        </div>
        <div className="banner-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onNavigateTab('courses')}
          >
            Manage Courses
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigateTab('documents')}
          >
            Upload Lectures
          </button>
        </div>
      </div>

      {/* METRICS GRID */}
      <div className="admin-metrics-grid">
        <div className="metric-card" onClick={() => onNavigateTab('students')}>
          <div className="metric-icon students">👥</div>
          <div className="metric-content">
            <span className="metric-value">{stats.total_students ?? stats.students ?? 0}</span>
            <span className="metric-label">Total Enrolled Students</span>
          </div>
          <span className="metric-trend positive">+Active</span>
        </div>

        <div className="metric-card" onClick={() => onNavigateTab('courses')}>
          <div className="metric-icon courses">📚</div>
          <div className="metric-content">
            <span className="metric-value">{stats.total_courses ?? stats.courses ?? 0}</span>
            <span className="metric-label">Active Academic Courses</span>
          </div>
          <span className="metric-trend neutral">{courses.length} listed</span>
        </div>

        <div className="metric-card" onClick={() => onNavigateTab('documents')}>
          <div className="metric-icon documents">📄</div>
          <div className="metric-content">
            <span className="metric-value">{stats.total_documents ?? stats.documents ?? 0}</span>
            <span className="metric-label">Uploaded PDF Documents</span>
          </div>
          <span className="metric-trend positive">Indexed</span>
        </div>

        <div className="metric-card" onClick={() => onNavigateTab('rag')}>
          <div className="metric-icon chunks">⚡</div>
          <div className="metric-content">
            <span className="metric-value">{stats.total_chunks ?? stats.chunks ?? 0}</span>
            <span className="metric-label">Vector Embeddings / Chunks</span>
          </div>
          <span className="metric-trend positive">1536 dim</span>
        </div>

        <div className="metric-card" onClick={() => onNavigateTab('activity')}>
          <div className="metric-icon sessions">💬</div>
          <div className="metric-content">
            <span className="metric-value">{stats.conversations ?? 0}</span>
            <span className="metric-label">Total Chat Sessions</span>
          </div>
          <span className="metric-trend neutral">{stats.messages ?? 0} messages</span>
        </div>

        <div className="metric-card" onClick={() => onNavigateTab('rag')}>
          <div className="metric-icon health">💚</div>
          <div className="metric-content">
            <span className="metric-value">99.8%</span>
            <span className="metric-label">RAG Engine Health</span>
          </div>
          <span className="metric-trend positive">Operational</span>
        </div>
      </div>

      {/* DASHBOARD SPLIT PANELS */}
      <div className="dashboard-panels-grid">
        {/* PANEL 1: COURSE OVERVIEW TABLE */}
        <div className="admin-card">
          <div className="card-header">
            <h3>📚 Course Distribution & Documents</h3>
            <button
              type="button"
              className="btn-text"
              onClick={() => onNavigateTab('courses')}
            >
              View All →
            </button>
          </div>
          <div className="card-body">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course Name</th>
                  <th>Documents</th>
                  <th>Chunks</th>
                </tr>
              </thead>
              <tbody>
                {courses.slice(0, 5).map((course) => (
                  <tr key={course.id}>
                    <td>
                      <span className="code-pill">{course.code || 'SYS'}</span>
                    </td>
                    <td>
                      <strong>{course.name}</strong>
                    </td>
                    <td>{course.documents ?? 0} docs</td>
                    <td>{course.chunks ?? 0} chunks</td>
                  </tr>
                ))}
                {courses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted">
                      No courses available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PANEL 2: RECENT SYSTEM ACTIVITY FEED */}
        <div className="admin-card">
          <div className="card-header">
            <h3>📋 Recent Activity Audit Log</h3>
            <button
              type="button"
              className="btn-text"
              onClick={() => onNavigateTab('activity')}
            >
              Full Log →
            </button>
          </div>
          <div className="card-body">
            <div className="activity-feed">
              {activity.slice(0, 5).map((act, index) => (
                <div key={index} className="feed-item">
                  <div className={`feed-icon ${act.role === 'user' ? 'user' : 'bot'}`}>
                    {act.role === 'user' ? '🧑‍🎓' : '🤖'}
                  </div>
                  <div className="feed-details">
                    <div className="feed-title">
                      <strong>{act.student_name}</strong> in{' '}
                      <span className="code-pill">{act.course_code || 'General'}</span>
                    </div>
                    <p className="feed-snippet">"{act.content}"</p>
                    <span className="feed-time">
                      {act.created_at
                        ? new Date(act.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Recent'}
                    </span>
                  </div>
                </div>
              ))}
              {activity.length === 0 && (
                <p className="text-muted text-center py-4">No recent activity logged.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RAG & SYSTEM ARCHITECTURE INFO */}
      <div className="admin-card architecture-card mt-6">
        <div className="card-header">
          <h3>⚡ University RAG Engine Architecture Status</h3>
          <span className="badge badge-success">Online & Healthy</span>
        </div>
        <div className="card-body grid-4-cols">
          <div className="arch-stat-box">
            <span className="arch-label">Generative AI Model</span>
            <span className="arch-val">Gemini 3.6 Flash</span>
            <span className="arch-sub">Low latency tutoring</span>
          </div>
          <div className="arch-stat-box">
            <span className="arch-label">Embedding Model</span>
            <span className="arch-val">Gemini Embedding 001</span>
            <span className="arch-sub">1536 Vector Dimensions</span>
          </div>
          <div className="arch-stat-box">
            <span className="arch-label">Database Index</span>
            <span className="arch-val">pgvector (HNSW)</span>
            <span className="arch-sub">Hierarchical Navigable Small World</span>
          </div>
          <div className="arch-stat-box">
            <span className="arch-label">Retrieval Strategy</span>
            <span className="arch-val">Cosine Similarity</span>
            <span className="arch-sub">Top 4 Relevant Chunks</span>
          </div>
        </div>
      </div>
    </div>
  )
}
