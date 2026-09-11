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
    quality_passed: bool
    message_saved: bool


class ChatSessionUpdate(BaseModel):
    title: str