// ─── Centralised API layer ────────────────────────────────────────────────────
// All fetch() calls live here. Components never call fetch() directly.

import type {
  AdminActivityLog,
  AdminDashboard,
  AdminDocument,
  AdminEnrollment,
  AdminRagStats,
  AdminStudent,
  AdminSystemSettings,
  ChatMessage,
  ChatResponse,
  ChatSession,
  Course,
  Student,
} from './types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatApiError(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail))
    return detail.map((i: { msg?: string; detail?: string }) => i?.msg || i?.detail || JSON.stringify(i)).join('; ')
  if (detail && typeof detail === 'object') {
    const d = detail as { msg?: string; detail?: string }
    return d.msg || d.detail || JSON.stringify(detail)
  }
  return fallback
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, options)
  const contentType = response.headers.get('content-type') || ''
  const result = contentType.includes('application/json') ? await response.json() : {}
  if (!response.ok) throw new Error(formatApiError(result?.detail, `Request failed (${response.status})`))
  return result as T
}

async function adminFetch<T>(path: string, adminId: string, options: RequestInit = {}): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    headers: { 'X-Admin-Id': adminId, ...(options.headers as Record<string, string> || {}) },
  })
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function signup(name: string, email: string): Promise<Student> {
  return apiFetch<Student>('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email }),
  })
}

// ── Courses ──────────────────────────────────────────────────────────────────

export async function getCourses(): Promise<Course[]> {
  const result = await apiFetch<{ courses: Course[] }>('/courses')
  return result.courses
}

// ── Chat Sessions ─────────────────────────────────────────────────────────────

export async function getChatSessions(studentId: string, courseId: string): Promise<ChatSession[]> {
  const result = await apiFetch<{ sessions: ChatSession[] }>(
    `/chat-sessions?student_id=${studentId}&course_id=${courseId}`
  )
  return result.sessions
}

export async function createChatSession(studentId: string, courseId: string): Promise<ChatSession> {
  const result = await apiFetch<{ session: ChatSession }>(
    `/chat-sessions?student_id=${encodeURIComponent(studentId)}&course_id=${encodeURIComponent(courseId)}`,
    { method: 'POST' }
  )
  return result.session
}

export async function getSessionMessages(
  sessionId: string,
  studentId: string
): Promise<{ session: { id: string; course_id: string; title: string }; messages: ChatMessage[] }> {
  return apiFetch(`/chat-sessions/${sessionId}/messages?student_id=${studentId}`)
}

export async function renameSession(sessionId: string, studentId: string, title: string): Promise<void> {
  await apiFetch(`/chat-sessions/${sessionId}?student_id=${studentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export async function deleteSession(sessionId: string, studentId: string): Promise<void> {
  await apiFetch(`/chat-sessions/${sessionId}?student_id=${studentId}`, { method: 'DELETE' })
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export async function sendChat(
  studentId: string,
  courseId: string,
  courseName: string | undefined,
  sessionId: string | null,
  question: string
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: studentId, course_id: courseId, course_name: courseName, session_id: sessionId, question }),
  })
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export async function getAdminDashboard(adminId: string): Promise<AdminDashboard> {
  return adminFetch<AdminDashboard>('/admin/dashboard', adminId)
}

export async function getAdminCourses(adminId: string): Promise<Course[]> {
  const result = await adminFetch<{ courses: Course[] }>('/admin/courses', adminId)
  return result.courses
}

export async function createAdminCourse(
  adminId: string,
  name: string,
  code: string,
  description: string
): Promise<Course> {
  return adminFetch<Course>('/admin/courses', adminId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, code, description }),
  })
}

export async function updateAdminCourse(
  adminId: string,
  courseId: string,
  name: string,
  code: string,
  description: string
): Promise<Course> {
  return adminFetch<Course>(`/admin/courses/${courseId}`, adminId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, code, description }),
  })
}

export async function deleteAdminCourse(adminId: string, courseId: string): Promise<void> {
  await adminFetch(`/admin/courses/${courseId}`, adminId, { method: 'DELETE' })
}

export async function getAdminDocuments(adminId: string, courseId: string): Promise<AdminDocument[]> {
  const result = await adminFetch<{ documents: AdminDocument[] }>(
    `/admin/courses/${courseId}/documents`,
    adminId
  )
  return result.documents
}

export async function uploadDocument(adminId: string, courseId: string, file: File): Promise<{ chunks_indexed: number }> {
  const formData = new FormData()
  formData.append('file', file)
  return adminFetch(`/admin/courses/${courseId}/documents`, adminId, { method: 'POST', body: formData })
}

export async function deleteDocument(adminId: string, documentId: string): Promise<void> {
  await adminFetch(`/admin/documents/${documentId}`, adminId, { method: 'DELETE' })
}

export async function reindexDocument(adminId: string, documentId: string): Promise<void> {
  await adminFetch(`/admin/documents/${documentId}/reindex`, adminId, { method: 'POST' })
}

export async function replaceDocument(adminId: string, documentId: string, file: File): Promise<void> {
  const formData = new FormData()
  formData.append('file', file)
  await adminFetch(`/admin/documents/${documentId}`, adminId, { method: 'PUT', body: formData })
}

export async function getAdminStudents(adminId: string): Promise<AdminStudent[]> {
  const result = await adminFetch<{ students: AdminStudent[] }>('/admin/students', adminId)
  return result.students
}

export async function getStudentProgress(adminId: string, studentId: string): Promise<{ student: AdminStudent }> {
  return adminFetch(`/admin/students/${studentId}/progress`, adminId)
}

export async function updateStudent(
  adminId: string,
  studentId: string,
  name: string,
  email: string,
  is_admin: boolean
): Promise<void> {
  await adminFetch(`/admin/students/${studentId}`, adminId, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, is_admin }),
  })
}

export async function getAdminActivity(adminId: string): Promise<{ activity: AdminActivityLog[] }> {
  return adminFetch('/admin/activity', adminId)
}

export async function getAllAdminDocuments(adminId: string): Promise<AdminDocument[]> {
  const result = await adminFetch<{ documents: AdminDocument[] }>('/admin/all-documents', adminId)
  return result.documents
}

export async function getAdminEnrollments(adminId: string): Promise<AdminEnrollment[]> {
  const result = await adminFetch<{ enrollments: AdminEnrollment[] }>('/admin/enrollments', adminId)
  return result.enrollments
}

export async function createAdminEnrollment(adminId: string, studentId: string, courseId: string): Promise<void> {
  await adminFetch('/admin/enrollments', adminId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: studentId, course_id: courseId }),
  })
}

export async function deleteAdminEnrollment(adminId: string, studentId: string, courseId: string): Promise<void> {
  await adminFetch(`/admin/enrollments/${studentId}/${courseId}`, adminId, { method: 'DELETE' })
}

export async function getAdminRagStats(adminId: string): Promise<AdminRagStats> {
  return adminFetch('/admin/rag/stats', adminId)
}

export async function getAdminSettings(adminId: string): Promise<AdminSystemSettings> {
  const result = await adminFetch<{ settings: AdminSystemSettings }>('/admin/settings', adminId)
  return result.settings
}

export async function updateAdminSettings(adminId: string, settings: Partial<AdminSystemSettings>): Promise<AdminSystemSettings> {
  const result = await adminFetch<{ settings: AdminSystemSettings }>('/admin/settings', adminId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  return result.settings
}

