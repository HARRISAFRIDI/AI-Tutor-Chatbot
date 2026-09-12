-- Migration 007 — Student Memory / Profile System
-- Creates one-row-per-student profile table with 8 memory fields.

CREATE TABLE IF NOT EXISTS tutor.student_memory (
    student_id                  UUID        PRIMARY KEY
                                            REFERENCES tutor.students(id)
                                            ON DELETE CASCADE,

    favorite_topic              TEXT,
    learning_style              TEXT,
    preferred_language          TEXT,
    difficulty_level            TEXT,
    interests                   TEXT,
    strengths                   TEXT,
    weak_topics                 TEXT,
    preferred_explanation_style TEXT,

    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE tutor.student_memory IS
    'Persistent student profile remembered across chat sessions.';
