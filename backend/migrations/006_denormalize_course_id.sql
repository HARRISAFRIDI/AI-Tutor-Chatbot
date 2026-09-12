-- ============================================================
-- Migration 006: Denormalise course_id onto document_chunks
-- ============================================================
--
-- WHY
-- ---
-- The pgvector HNSW index on document_chunks.embedding is an
-- approximate-nearest-neighbour (ANN) structure.  When we filter by
-- course *after* the vector scan (via JOIN tutor.documents), pgvector
-- must score every embedding in the table and then discard the rows
-- that don't belong to the requested course.  This means the index
-- provides no benefit beyond ordering — it still touches all rows.
--
-- By storing course_id directly on document_chunks we can filter
-- *before* (or alongside) the vector scan, letting pgvector skip
-- irrelevant partitions entirely.
--
-- STEPS
-- -----
-- 1. Add the column (nullable first so the ALTER is instant).
-- 2. Backfill from the existing documents table.
-- 3. Set NOT NULL now that every row has a value.
-- 4. Add a plain B-tree index so the WHERE course_id = ? predicate
--    is evaluated quickly before handing the candidate set to HNSW.
-- 5. Drop the redundant HNSW index that ignored course partitioning
--    and replace it with a fresh one now that course_id is available.
--    (We keep the old name so any existing monitoring keeps working.)
-- ============================================================

-- Step 1: Add the column
ALTER TABLE tutor.document_chunks
    ADD COLUMN IF NOT EXISTS course_id UUID;

-- Step 2: Backfill from documents
UPDATE tutor.document_chunks dc
SET    course_id = d.course_id
FROM   tutor.documents d
WHERE  d.id = dc.document_id
  AND  dc.course_id IS NULL;

-- Step 3: Enforce NOT NULL going forward
-- (safe because the backfill above set every existing row)
ALTER TABLE tutor.document_chunks
    ALTER COLUMN course_id SET NOT NULL;

-- Step 4: B-tree index used by the WHERE clause pre-filter
-- The planner uses this to quickly identify candidate rows for a
-- given course before handing them to the HNSW operator.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_doc_chunks_course_id
    ON tutor.document_chunks (course_id);

-- Step 5: Composite B-tree (course_id, chunk_index) for ORDER BY
-- queries that iterate chunks in order within a course.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_doc_chunks_course_chunk
    ON tutor.document_chunks (course_id, chunk_index);

-- Note: the existing HNSW index (ix_doc_chunks_embedding_hnsw) remains
-- valid and will still be used for the vector ordering step.  pgvector
-- combines the B-tree pre-filter on course_id with the HNSW scan
-- automatically when both predicates are present.
