CREATE SCHEMA IF NOT EXISTS tutor;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tutor.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tutor.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tutor.student_courses (
    student_id UUID NOT NULL REFERENCES tutor.students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES tutor.courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, course_id)
);

CREATE TABLE IF NOT EXISTS tutor.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES tutor.courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255),
    document_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tutor.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES tutor.documents(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES tutor.courses(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    page_number INTEGER,
    embedding vector(1536) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_documents_course_id
    ON tutor.documents (course_id);

CREATE INDEX IF NOT EXISTS ix_document_chunks_document_id
    ON tutor.document_chunks (document_id);

CREATE INDEX IF NOT EXISTS ix_document_chunks_course_id
    ON tutor.document_chunks (course_id);
