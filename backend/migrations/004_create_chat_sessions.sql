BEGIN;

CREATE TABLE IF NOT EXISTS tutor.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES tutor.students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES tutor.courses(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tutor.messages
    ADD COLUMN IF NOT EXISTS session_id UUID
    REFERENCES tutor.chat_sessions(id) ON DELETE CASCADE;

ALTER TABLE tutor.messages
    ALTER COLUMN conversation_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS ix_chat_sessions_student_course
    ON tutor.chat_sessions (student_id, course_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_messages_session_id
    ON tutor.messages (session_id, created_at);

COMMIT;