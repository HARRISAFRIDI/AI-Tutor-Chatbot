// ─── Shared TypeScript interfaces ─────────────────────────────────────────────

export interface Student {
  id: string
  name: string
  email: string
  is_admin: boolean
}

export interface Course {
  id: string
  name: string
  code: string | null
  description: string | null
  documents?: number
  chunks?: number
}

export interface ChatSession {
  id: string
  course_id: string
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  answer_source: 'rag' | 'llm' | null
  created_at?: string
}

export interface ChatResponse {
  session_id: string
  answer: string
  answer_source: 'rag' | 'llm' | null
  retrieved_chunks: number
  retrieval_score: number
  retrieval_relevant: boolean
  llm_call_time_seconds: number
  quality_passed: boolean
  message_saved: boolean
}

export interface AdminDashboard {
  admin: { id: string; name: string; email: string }
  stats: Record<string, number>
  rag: { database: string; index: string }
}

export interface AdminStudent {
  id: string
  name: string
  email: string
  is_admin: boolean
  conversations: number
  messages: number
  last_activity: string | null
}

export interface AdminDocument {
  id: string
  title: string
  file_name: string
  chunks: number
  created_at: string | null
  course_id?: string
  course_name?: string
  course_code?: string
  reindex_available?: boolean
}

export interface AdminEnrollment {
  student_id: string
  course_id: string
  created_at: string | null
  student_name: string
  student_email: string
  course_name: string
  course_code: string
}

export interface AdminRagStats {
  llm_model: string
  embedding_model: string
  vector_dimension: number
  database_engine: string
  similarity_metric: string
  retrieval_k: number
  total_documents: number
  total_chunks: number
  total_rag_queries: number
  rag_sourced_queries: number
  health_status: string
}

export interface AdminSystemSettings {
  system_name: string
  university_name: string
  max_upload_size_mb: number
  ai_temperature: number
  ai_max_tokens: number
  rag_similarity_threshold: number
  rag_max_chunks: number
  session_timeout_minutes: number
  allow_new_registrations: boolean
}

export interface AdminActivityLog {
  created_at: string | null
  role: string
  content: string
  student_name: string
  course_code: string
}

