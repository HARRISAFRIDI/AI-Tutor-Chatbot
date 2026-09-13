import React, { useEffect, useState } from 'react'
import type {
  AdminActivityLog,
  AdminDashboard,
  AdminDocument,
  AdminEnrollment,
  AdminRagStats,
  AdminStudent,
  AdminSystemSettings,
  Course,
  Student,
} from '../types'
import {
  createAdminCourse,
  createAdminEnrollment,
  deleteAdminCourse,
  deleteAdminEnrollment,
  deleteDocument,
  getAdminActivity,
  getAdminCourses,
  getAdminDashboard,
  getAdminEnrollments,
  getAdminRagStats,
  getAdminSettings,
  getAdminStudents,
  getAllAdminDocuments,
  reindexDocument,
  replaceDocument,
  signup,
  updateAdminCourse,
  updateAdminSettings,
  updateStudent,
  uploadDocument,
} from '../api'
import { AdminLayout, type AdminTab } from './admin/AdminLayout'
import { DashboardView } from './admin/DashboardView'
import { CoursesView } from './admin/CoursesView'
import { StudentsView } from './admin/StudentsView'
import { DocumentsView } from './admin/DocumentsView'
import { EnrollmentsView } from './admin/EnrollmentsView'
import { RagView } from './admin/RagView'
import { ActivityView } from './admin/ActivityView'
import { SettingsView } from './admin/SettingsView'

interface AdminModalProps {
  currentStudent: Student
  onClose: () => void
  onCoursesUpdated: () => void
}

export const AdminModal: React.FC<AdminModalProps> = ({
  currentStudent,
  onClose,
  onCoursesUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Data states
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [students, setStudents] = useState<AdminStudent[]>([])
  const [documents, setDocuments] = useState<AdminDocument[]>([])
  const [enrollments, setEnrollments] = useState<AdminEnrollment[]>([])
  const [ragStats, setRagStats] = useState<AdminRagStats | null>(null)
  const [activity, setActivity] = useState<AdminActivityLog[]>([])
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null)

  const adminId = currentStudent.id

  const clearAlerts = () => {
    setError(null)
    setSuccess(null)
  }

  // Loader functions
  const loadDashboard = async () => {
    try {
      const data = await getAdminDashboard(adminId)
      setDashboard(data)
    } catch (err: unknown) {
      console.error('Failed to load dashboard:', err)
    }
  }

  const loadCourses = async () => {
    try {
      const list = await getAdminCourses(adminId)
      setCourses(list)
    } catch (err: unknown) {
      console.error('Failed to load courses:', err)
    }
  }

  const loadStudents = async () => {
    try {
      const list = await getAdminStudents(adminId)
      setStudents(list)
    } catch (err: unknown) {
      console.error('Failed to load students:', err)
    }
  }

  const loadAllDocuments = async () => {
    try {
      const docs = await getAllAdminDocuments(adminId)
      setDocuments(docs)
    } catch (err: unknown) {
      console.error('Failed to load documents:', err)
    }
  }

  const loadEnrollments = async () => {
    try {
      const list = await getAdminEnrollments(adminId)
      setEnrollments(list)
    } catch (err: unknown) {
      console.error('Failed to load enrollments:', err)
    }
  }

  const loadRagStats = async () => {
    try {
      const stats = await getAdminRagStats(adminId)
      setRagStats(stats)
    } catch (err: unknown) {
      console.error('Failed to load RAG stats:', err)
    }
  }

  const loadActivity = async () => {
    try {
      const res = await getAdminActivity(adminId)
      setActivity(res.activity || [])
    } catch (err: unknown) {
      console.error('Failed to load activity:', err)
    }
  }

  const loadSettings = async () => {
    try {
      const data = await getAdminSettings(adminId)
      setSettings(data)
    } catch (err: unknown) {
      console.error('Failed to load settings:', err)
    }
  }

  // Initial load
  useEffect(() => {
    loadDashboard()
    loadCourses()
    loadActivity()
  }, [])

  // Tab change triggers
  useEffect(() => {
    clearAlerts()
    if (activeTab === 'dashboard') {
      loadDashboard()
      loadCourses()
      loadActivity()
    } else if (activeTab === 'courses') {
      loadCourses()
    } else if (activeTab === 'students') {
      loadStudents()
      loadCourses()
    } else if (activeTab === 'documents') {
      loadAllDocuments()
      loadCourses()
    } else if (activeTab === 'enrollments') {
      loadEnrollments()
      loadStudents()
      loadCourses()
    } else if (activeTab === 'rag') {
      loadRagStats()
    } else if (activeTab === 'activity') {
      loadActivity()
    } else if (activeTab === 'settings') {
      loadSettings()
    }
  }, [activeTab])

  // --- Handlers for Courses ---
  const handleSaveCourse = async (
    id: string | null,
    name: string,
    code: string,
    desc: string
  ) => {
    clearAlerts()
    setLoading(true)
    try {
      if (id) {
        await updateAdminCourse(adminId, id, name, code, desc)
        setSuccess(`Course '${name}' updated successfully.`)
      } else {
        await createAdminCourse(adminId, name, code, desc)
        setSuccess(`Course '${name}' created successfully.`)
      }
      await loadCourses()
      onCoursesUpdated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save course')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCourse = async (id: string) => {
    clearAlerts()
    setLoading(true)
    try {
      await deleteAdminCourse(adminId, id)
      setSuccess('Course deleted successfully.')
      await loadCourses()
      onCoursesUpdated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete course')
    } finally {
      setLoading(false)
    }
  }

  // --- Handlers for Students ---
  const handleToggleAdmin = async (student: AdminStudent) => {
    clearAlerts()
    try {
      await updateStudent(adminId, student.id, student.name, student.email, !student.is_admin)
      setSuccess(`Admin status updated for ${student.name}.`)
      await loadStudents()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update student status')
    }
  }

  const handleAddStudent = async (name: string, email: string) => {
    clearAlerts()
    setLoading(true)
    try {
      await signup(name, email)
      setSuccess(`Student ${name} registered successfully.`)
      await loadStudents()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register student')
    } finally {
      setLoading(false)
    }
  }

  // --- Handlers for Documents ---
  const handleUploadDocument = async (courseId: string, file: File) => {
    clearAlerts()
    setLoading(true)
    try {
      const res = await uploadDocument(adminId, courseId, file)
      setSuccess(`Document uploaded and vectorized! ${res.chunks_indexed} vector chunks created.`)
      await loadAllDocuments()
      await loadDashboard()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Document upload failed')
    } finally {
      setLoading(false)
    }
  }

  const handleReindexDocument = async (docId: string) => {
    clearAlerts()
    setLoading(true)
    try {
      await reindexDocument(adminId, docId)
      setSuccess('Document re-indexed into pgvector successfully!')
      await loadAllDocuments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reindexing failed')
    } finally {
      setLoading(false)
    }
  }

  const handleReplaceDocument = async (docId: string, file: File) => {
    clearAlerts()
    setLoading(true)
    try {
      await replaceDocument(adminId, docId, file)
      setSuccess('Document file replaced and re-indexed successfully.')
      await loadAllDocuments()
      await loadDashboard()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to replace document')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    clearAlerts()
    setLoading(true)
    try {
      await deleteDocument(adminId, docId)
      setSuccess('Document purged from system and vector store.')
      await loadAllDocuments()
      await loadDashboard()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete document')
    } finally {
      setLoading(false)
    }
  }

  // --- Handlers for Enrollments ---
  const handleAddEnrollment = async (studentId: string, courseId: string) => {
    clearAlerts()
    setLoading(true)
    try {
      await createAdminEnrollment(adminId, studentId, courseId)
      setSuccess('Student assigned to course successfully.')
      await loadEnrollments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Enrollment failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEnrollment = async (studentId: string, courseId: string) => {
    clearAlerts()
    setLoading(true)
    try {
      await deleteAdminEnrollment(adminId, studentId, courseId)
      setSuccess('Enrollment removed.')
      await loadEnrollments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove enrollment')
    } finally {
      setLoading(false)
    }
  }

  // --- Handlers for Settings ---
  const handleSaveSettings = async (newSettings: Partial<AdminSystemSettings>) => {
    clearAlerts()
    setLoading(true)
    try {
      const updated = await updateAdminSettings(adminId, newSettings)
      setSettings(updated)
      setSuccess('System configuration saved successfully.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout
      currentStudent={currentStudent}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onClose={onClose}
      error={error}
      success={success}
      onClearMessages={clearAlerts}
    >
      {activeTab === 'dashboard' && (
        <DashboardView
          dashboard={dashboard}
          courses={courses}
          activity={activity}
          onNavigateTab={setActiveTab}
        />
      )}

      {activeTab === 'courses' && (
        <CoursesView
          courses={courses}
          loading={loading}
          onSaveCourse={handleSaveCourse}
          onDeleteCourse={handleDeleteCourse}
        />
      )}

      {activeTab === 'students' && (
        <StudentsView
          students={students}
          courses={courses}
          loading={loading}
          onToggleAdmin={handleToggleAdmin}
          onAddStudent={handleAddStudent}
        />
      )}

      {activeTab === 'documents' && (
        <DocumentsView
          documents={documents}
          courses={courses}
          loading={loading}
          onUploadDocument={handleUploadDocument}
          onReindexDocument={handleReindexDocument}
          onReplaceDocument={handleReplaceDocument}
          onDeleteDocument={handleDeleteDocument}
        />
      )}

      {activeTab === 'enrollments' && (
        <EnrollmentsView
          enrollments={enrollments}
          students={students}
          courses={courses}
          loading={loading}
          onAddEnrollment={handleAddEnrollment}
          onDeleteEnrollment={handleDeleteEnrollment}
        />
      )}

      {activeTab === 'rag' && <RagView ragStats={ragStats} />}

      {activeTab === 'activity' && <ActivityView activity={activity} />}

      {activeTab === 'settings' && (
        <SettingsView
          settings={settings}
          loading={loading}
          onSaveSettings={handleSaveSettings}
        />
      )}
    </AdminLayout>
  )
}
