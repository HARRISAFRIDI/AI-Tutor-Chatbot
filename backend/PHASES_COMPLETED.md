# University AI Tutor: Completed Phases

## Phase 1: Retrieval and answer orchestration

The tutor workflow is implemented in `graph.py` with LangGraph. It loads student context, understands the question, retrieves the five closest lecture chunks, evaluates the top similarity score, chooses RAG or the general LLM path, checks answer quality, and returns a final state.

The RAG path uses the configured Gemini client from `llm.py`. The missing LLM import was fixed so `python graph.py` can complete and print the final result.

## Phase 2: Database-backed document retrieval

`retrieval.py` queries the PostgreSQL `tutor.document_chunks` table using pgvector similarity and filters results by course. The current database verification returned five chunks for the normalization question with a top retrieval score of `0.6897092894797624`, which passes the `0.65` relevance threshold.

The PDF ingestion flow in `ingest.py` loads lecture PDFs, splits them into overlapping chunks, generates embeddings, and stores the document and chunk records.

## Phase 3: Conversation persistence

The migration `migrations/001_create_conversations.sql` adds:

- `tutor.conversations` for student/course conversations.
- `tutor.messages` for user and assistant messages.
- An index on `messages.conversation_id` for conversation history lookups.

The migration has been applied to the configured Supabase PostgreSQL database. The graph save step now creates a conversation and stores both the question and generated answer, including answer source and retrieval metadata. Standalone runs with the placeholder `test-student` remain non-persistent and report `message_saved: false`; API requests with valid UUIDs are persisted.

## Phase 4: Chat API

`main.py` now exposes `POST /chat`. The request accepts:

```json
{
  "student_id": "student UUID",
  "course_id": "course UUID",
  "question": "What is database normalization?"
}
```

The response includes the generated answer and the workflow metadata:

- `answer_source`
- `retrieved_chunks`
- `retrieval_score`
- `retrieval_relevant`
- `quality_passed`
- `message_saved`

FastAPI validation rejects malformed UUIDs or missing request fields before the graph runs.

## Phase 5: Verification

The following checks were completed:

- Python compilation passed for `graph.py`, `main.py`, and `schemas.py`.
- FastAPI imported successfully and registered `/chat`.
- The conversation migration ran successfully.
- The end-to-end chat request was exercised with a real student UUID and the ingested Database Systems course.
- Focused graph assertions passed directly; the environment does not currently include `pytest`, so `test_graph.py` was not run through the pytest runner.

## Phase 6: Simple frontend

The `frontend/` folder contains a lightweight browser interface served by FastAPI at `/app/`. It loads students and courses from the existing API, submits questions to `POST /chat`, displays the tutor answer, and shows retrieval, quality, and save metadata. It also includes loading and error states so a failed request is visible instead of silently doing nothing.

Open the interface at `http://127.0.0.1:8080/app/` after starting the backend, or use the platform-assigned `PORT` if the deployment environment sets one.

### Frontend error fix

The chat request initially returned `Internal Server Error` because `main.py` used the name `app` for both the LangGraph workflow and the FastAPI application. The chat route now calls the graph through the explicit `tutor_graph` name. The browser client also checks the response content type before parsing JSON, so future plain-text server errors will display a useful HTTP error instead of a JSON parsing exception.

## Phase 7: Signup and first-user admin

The frontend now shows a signup form for first-time visitors. Signup calls `POST /signup`, stores the returned student ID, name, email, and admin status in browser `localStorage`, and then opens the tutor workspace. Returning visitors skip signup and can immediately ask questions. The chat request uses the stored student ID instead of asking the user to select a student.

The migration `migrations/002_add_student_admin.sql` adds `tutor.students.is_admin`. The earliest existing student was promoted to admin during migration, and the first newly created student is automatically marked admin when no users exist. Later accounts are regular users. Existing email addresses are returned instead of duplicated.

## Phase 8: Subject-scoped retrieval

When a user selects a course, the frontend now sends both the course ID and subject name with the question. LangGraph carries the subject name into retrieval, and `retrieval.py` joins the course table and filters by both course ID and course name before searching document chunks. This prevents a question for one subject from searching PDFs belonging to another subject.

## Phase 9: Admin course and PDF management

The admin panel is visible only when the signed-in student has `is_admin = true`. The default admin is `admin` with email `admin@example.com`, established by `migrations/003_set_default_admin.sql`.

Admins can create courses through the protected `POST /admin/courses` endpoint. The legacy `POST /courses` creation route is protected by the same admin check. Admins can upload a PDF to a selected course through `POST /admin/courses/{course_id}/documents`. The upload is parsed, split into overlapping chunks, embedded, and stored in `tutor.documents` and `tutor.document_chunks` for subject-scoped retrieval.

Admin requests include the stored admin ID in the `X-Admin-Id` header. The backend verifies that ID against PostgreSQL, so hiding the panel in the browser is only a UI convenience and is not the security control.

The PDF upload route uses FastAPI multipart support; the environment includes the `python-multipart` package.

## Phase 10: Admin dashboard

The admin panel now follows the requested structure: Dashboard, Courses, Course Material, Students, and System. Dashboard metrics show course, document, chunk, student, conversation, and message counts, along with RAG/database status.

Course management includes create, view, edit, and delete. Course material management includes upload, view, replace, delete, and re-index. Uploaded PDFs are retained under `backend/uploads/` so replacement and re-indexing can use the original file.

Student management includes student listing, conversation/message progress, and editing a student name, email, or admin role. System views expose index statistics, RAG status, and recent activity logs from stored messages.

## Run the backend

From the repository root:

```powershell
Set-Location backend
.\.venv\Scripts\Activate.ps1
$env:PORT = "8080"
python -m uvicorn main:app --host 0.0.0.0 --port $env:PORT --reload
```

Then open `http://127.0.0.1:8080/docs` to try the API. To run the original graph demonstration directly:

```powershell
python graph.py
```

The API requires the Supabase PostgreSQL connection URL in `.env`, and answer generation requires a valid `GEMINI_API_KEY`.
