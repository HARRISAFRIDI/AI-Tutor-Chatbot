CREATE TABLE IF NOT EXISTS tutor.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES tutor.students(id),
    course_id UUID NOT NULL REFERENCES tutor.courses(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tutor.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES tutor.conversations(id),
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    answer_source VARCHAR(20),
    retrieval_score DOUBLE PRECISION,
    retrieval_relevant BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_messages_conversation_id
    ON tutor.messages (conversation_id);