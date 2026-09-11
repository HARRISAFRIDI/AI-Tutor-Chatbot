ALTER TABLE tutor.students
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

UPDATE tutor.students
SET is_admin = true
WHERE id = (
    SELECT id
    FROM tutor.students
    ORDER BY created_at ASC, id ASC
    LIMIT 1
)
AND NOT EXISTS (
    SELECT 1
    FROM tutor.students
    WHERE is_admin = true
);