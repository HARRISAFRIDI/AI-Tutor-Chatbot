from uuid import UUID

from pydantic import BaseModel, EmailStr


class StudentCreate(BaseModel):
    name: str
    email: EmailStr


class SignupResponse(BaseModel):
    id: UUID
    name: str
    email: EmailStr
    is_admin: bool


class CourseCreate(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None


class CourseUpdate(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None


class StudentUpdate(BaseModel):
    name: str
    email: EmailStr
    is_admin: bool


class ChatRequest(BaseModel):
    student_id: UUID
    course_id: UUID
    course_name: str | None = None
    session_id: UUID | None = None
    question: str


class ChatResponse(BaseModel):
    session_id: UUID | None = None
    answer: str
    answer_source: str | None = None
    retrieved_chunks: int
    retrieval_score: float
    retrieval_relevant: bool
    llm_call_time_seconds: float
    quality_passed: bool
    message_saved: bool


class ChatSessionUpdate(BaseModel):
    title: str


class StudentMemoryUpdate(BaseModel):
    favorite_topic:              str | None = None
    learning_style:              str | None = None
    preferred_language:          str | None = None
    difficulty_level:            str | None = None
    interests:                   str | None = None
    strengths:                   str | None = None
    weak_topics:                 str | None = None
    preferred_explanation_style: str | None = None


class StudentMemoryResponse(BaseModel):
    student_id:                  str
    favorite_topic:              str | None = None
    learning_style:              str | None = None
    preferred_language:          str | None = None
    difficulty_level:            str | None = None
    interests:                   str | None = None
    strengths:                   str | None = None
    weak_topics:                 str | None = None
    preferred_explanation_style: str | None = None