import React, { useEffect, useState } from 'react'
import type { Course, Student } from '../types'

interface TopBarProps {
  currentStudent: Student
  courses: Course[]
  selectedCourseId: string | null
  onSelectCourse: (courseId: string) => void
  onOpenAdmin: () => void
  onLogout: () => void
}

function getStoredTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem('ai_tutor_theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    // ignore
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const TopBar: React.FC<TopBarProps> = ({
  currentStudent,
  courses,
  selectedCourseId,
  onSelectCourse,
  onOpenAdmin,
  onLogout,
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(getStoredTheme)

  // Apply theme to <html> element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('ai_tutor_theme', theme)
    } catch {
      // ignore
    }
  }, [theme])

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="logo-badge">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span className="logo-title">AI Tutor</span>
        </div>

        <div className="course-selector-wrapper">
          <label htmlFor="topbar-course-select" className="sr-only">
            Select Course
          </label>
          <select
            id="topbar-course-select"
            className="course-select"
            value={selectedCourseId || ''}
            onChange={(e) => onSelectCourse(e.target.value)}
          >
            <option value="" disabled>
              Select a Course…
            </option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code ? `${course.code}: ` : ''}
                {course.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="topbar-right">
        {/* Dark / Light mode toggle */}
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle colour theme"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <div className="user-profile-badge">
          <span className="user-avatar">
            {currentStudent.name.charAt(0).toUpperCase()}
          </span>
          <div className="user-info">
            <span className="user-name">{currentStudent.name}</span>
            <span className="user-email">{currentStudent.email}</span>
          </div>
        </div>

        {/* Only show Admin Portal button for admin users */}
        {currentStudent.is_admin && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenAdmin}
            title="Open Admin Control Center"
          >
            ⚙ Admin Portal
          </button>
        )}

        <button
          type="button"
          className="btn btn-icon btn-sm"
          onClick={onLogout}
          title="Switch Student"
        >
          🚪
        </button>
      </div>
    </header>
  )
}
