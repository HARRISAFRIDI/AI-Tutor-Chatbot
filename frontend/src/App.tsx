import { useEffect, useState } from 'react'
import type { ChatMessage, ChatResponse, Course, ChatSession, Student } from './types'
import {
  createChatSession,
  deleteSession,
  getChatSessions,
  getCourses,
  getSessionMessages,
  renameSession,
  sendChat,
} from './api'
import { AuthModal } from './components/AuthModal'
import { TopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { AdminModal } from './components/AdminModal'

export function App() {
  const [student, setStudent] = useState<Student | null>(() => {
    const saved = localStorage.getItem('ai_tutor_student')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return null
      }
    }
    return null
  })

  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [lastResponseMeta, setLastResponseMeta] = useState<ChatResponse | null>(null)

  const [loading, setLoading] = useState(false)
  const [showAdmin, setShowAdmin] = useState<boolean>(() => {
    const saved = localStorage.getItem('ai_tutor_student')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return Boolean(parsed?.is_admin)
      } catch {
        return false
      }
    }
    return false
  })
  const [error, setError] = useState<string | null>(null)

  // 1. Fetch initial course list
  const loadCourses = async () => {
    try {
      const list = await getCourses()
      setCourses(list)
      if (list.length > 0 && !selectedCourseId) {
        setSelectedCourseId(list[0].id)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load courses')
    }
  }

  useEffect(() => {
    loadCourses()
  }, [])

  // 2. Load sessions when student or selected course changes
  const loadSessions = async (courseId: string, studentId: string) => {
    try {
      const list = await getChatSessions(studentId, courseId)
      setSessions(list)
      if (list.length > 0) {
        setActiveSessionId(list[0].id)
      } else {
        setActiveSessionId(null)
        setMessages([])
      }
    } catch (err: unknown) {
      console.error('Failed to load chat sessions:', err)
      setSessions([])
      setActiveSessionId(null)
      setMessages([])
    }
  }

  useEffect(() => {
    if (student && selectedCourseId) {
      loadSessions(selectedCourseId, student.id)
    }
  }, [student, selectedCourseId])

  // 3. Load messages when activeSessionId changes
  const loadMessages = async (sessionId: string, studentId: string) => {
    try {
      const data = await getSessionMessages(sessionId, studentId)
      setMessages(data.messages || [])
    } catch (err: unknown) {
      console.error('Failed to load messages:', err)
      setMessages([])
    }
  }

  useEffect(() => {
    if (student && activeSessionId) {
      loadMessages(activeSessionId, student.id)
    } else if (!activeSessionId) {
      setMessages([])
    }
  }, [activeSessionId, student])

  const handleLogin = (newStudent: Student) => {
    setStudent(newStudent)
    localStorage.setItem('ai_tutor_student', JSON.stringify(newStudent))
    if (newStudent.is_admin) {
      setShowAdmin(true)
    }
  }

  const handleLogout = () => {
    setStudent(null)
    localStorage.removeItem('ai_tutor_student')
    setSessions([])
    setActiveSessionId(null)
    setMessages([])
    setShowAdmin(false)
  }

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId)
    setActiveSessionId(null)
    setMessages([])
    setLastResponseMeta(null)
  }

  const handleNewChat = async () => {
    if (!student || !selectedCourseId) return
    try {
      const newSession = await createChatSession(student.id, selectedCourseId)
      setSessions((prev) => [newSession, ...prev])
      setActiveSessionId(newSession.id)
      setMessages([])
      setLastResponseMeta(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create new chat session')
    }
  }

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId)
    setLastResponseMeta(null)
  }

  const handleRenameSession = async (sessionId: string, title: string) => {
    if (!student) return
    try {
      await renameSession(sessionId, student.id, title)
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rename chat session')
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!student) return
    try {
      await deleteSession(sessionId, student.id)
      const filtered = sessions.filter((s) => s.id !== sessionId)
      setSessions(filtered)
      if (activeSessionId === sessionId) {
        if (filtered.length > 0) {
          setActiveSessionId(filtered[0].id)
        } else {
          setActiveSessionId(null)
          setMessages([])
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete chat session')
    }
  }

  const handleSendMessage = async (question: string) => {
    if (!student || !selectedCourseId) return

    const selectedCourse = courses.find((c) => c.id === selectedCourseId)

    // Optimistically add user message to list
    const userMsg: ChatMessage = {
      role: 'user',
      content: question,
      answer_source: null,
    }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    setError(null)

    try {
      const res = await sendChat(
        student.id,
        selectedCourseId,
        selectedCourse?.name,
        activeSessionId,
        question
      )

      // Update session ID if backend created a new session for us
      if (res.session_id && res.session_id !== activeSessionId) {
        setActiveSessionId(res.session_id)
        // Refresh session list
        loadSessions(selectedCourseId, student.id)
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: res.answer,
        answer_source: res.answer_source,
      }

      setMessages((prev) => [...prev, assistantMsg])
      setLastResponseMeta(res)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
      // Remove optimistic message on error
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  if (!student) {
    return <AuthModal onLogin={handleLogin} />
  }

  if (showAdmin) {
    return (
      <AdminModal
        currentStudent={student}
        onClose={() => setShowAdmin(false)}
        onCoursesUpdated={loadCourses}
      />
    )
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || null

  return (
    <div className="app-layout">
      <TopBar
        currentStudent={student}
        courses={courses}
        selectedCourseId={selectedCourseId}
        onSelectCourse={handleSelectCourse}
        onOpenAdmin={() => setShowAdmin(true)}
        onLogout={handleLogout}
      />

      {error && (
        <div className="global-error-banner">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      <div className="main-content-layout">
        <Sidebar
          courses={courses}
          selectedCourseId={selectedCourseId}
          onSelectCourse={handleSelectCourse}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onRenameSession={handleRenameSession}
          onDeleteSession={handleDeleteSession}
        />

        <ChatArea
          selectedCourse={selectedCourse}
          messages={messages}
          lastResponseMeta={lastResponseMeta}
          loading={loading}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  )
}

export default App
