UPDATE tutor.students
SET name = 'admin',
    email = 'admin@example.com',
    is_admin = true
WHERE id = (
    SELECT id
    FROM tutor.students
    WHERE is_admin = true
    ORDER BY created_at ASC, id ASC
    LIMIT 1
);

INSERT INTO tutor.students (name, email, is_admin)
SELECT 'admin', 'admin@example.com', true
WHERE NOT EXISTS (
    SELECT 1
    FROM tutor.students
    WHERE is_admin = true
);
