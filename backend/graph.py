from typing import TypedDict, Literal
from time import perf_counter
from uuid import UUID

from langgraph.graph import StateGraph, START, END
from sqlalchemy import text

from database import SessionLocal
from embeddings import create_embedding
from llm import llm
from memory import extract_memory_updates, format_memory_for_prompt, load_memory, save_memory
from retrieval import search_course_material


# ============================================================
# STEP 1 — DEFINE THE STATE
# ============================================================

class TutorState(TypedDict, total=False):
    student_id: str
    course_id: str | None
    course_name: str | None
    question: str
    query_embedding: list[float]

    student_context: dict
    course_context: dict

    retrieved_chunks: list[dict]
    retrieval_score: float
    retrieval_relevant: bool
    llm_call_time_seconds: float

    answer: str
    answer_source: Literal["rag", "llm"] | None

    quality_passed: bool
    quality_feedback: str

    session_id: str | None
    message_saved: bool

    error: str | None


# ============================================================
# STEP 2 — LOAD STUDENT CONTEXT
# ============================================================

def load_student_context(state: TutorState):

    print("\n========== LOAD STUDENT CONTEXT ==========")

    student_id = state["student_id"]
    question   = state["question"]

    db = SessionLocal()
    try:
        # 1. Detect if the student's message reveals profile info
        updates = extract_memory_updates(question, db)
        if updates:
            print("Memory updates detected:", updates)
            save_memory(student_id, updates, db)

        # 2. Load the (possibly freshly updated) profile
        profile = load_memory(student_id, db)
        print("Student profile loaded:", profile)
    finally:
        db.close()

    return {
        "student_context": profile
    }


# ============================================================
# STEP 3 — CREATE QUERY EMBEDDING
# ============================================================

def create_query_embedding(state: TutorState):
    question = state["question"].strip()

    print("\n========== CREATE QUERY EMBEDDING ==========")
    print("Question:", question)

    return {
        "query_embedding": create_embedding(question)
    }


# ============================================================
# STEP 4 — RETRIEVE COURSE MATERIAL
# ============================================================

def retrieve_course_material(state: TutorState):

    print("\n========== RETRIEVE COURSE MATERIAL ==========")

    question = state["question"].strip()
    course_id = state["course_id"]
    course_name = state["course_name"]

    print("Question:", question)
    print("Course ID:", course_id)
    print("Course:", course_name)

    # Always perform RAG retrieval first.
    # We do NOT decide RAG vs LLM before retrieval.
    # top_k=5: retrieve 5 chunks — enough context for the LLM while still
    # keeping the LIMIT small so pgvector can use the HNSW/IVFFlat index.

    results = search_course_material(
        question=question,
        course_id=course_id,
        query_embedding=state["query_embedding"],
        top_k=5,
        min_similarity=0.0,
    )

    print("\n========== RETRIEVAL RESULTS ==========")
    print("Chunks retrieved:", len(results))

    if results:
        print("Top similarity:", results[0]["similarity"])
        print("Top page:", results[0]["page_number"])

        print("\nTop result:")
        print("------------------------------")
        print(results[0]["content"][:500])
        print("------------------------------")

    else:
        print("No chunks found.")

    return {
        "retrieved_chunks": results
    }


# ============================================================
# STEP 5 — CHECK RELEVANCE
# ============================================================
def check_relevance(state: TutorState):
    print("\n========== CHECK RELEVANCE ==========")

    retrieved_chunks = state.get("retrieved_chunks", [])

    if not retrieved_chunks:
        print("No retrieved chunks.")
        return {
            "retrieval_score": 0.0,
            "retrieval_relevant": False
        }

    top_score = retrieved_chunks[0]["similarity"]

    threshold = 0.65

    relevant = top_score >= threshold

    print("Top similarity score:", top_score)
    print("Threshold:", threshold)
    print("Retrieval relevant:", relevant)

    if relevant:
        print("Decision: RAG")
    else:
        print("Decision: GENERAL LLM")

    return {
        "retrieval_score": top_score,
        "retrieval_relevant": relevant
    }
# ============================================================
# STEP 6 — RAG ANSWER
# ============================================================
def rag_answer(state: TutorState):
    print("\n========== RAG ANSWER ==========")

    question = state["question"]
    retrieved_chunks = state.get("retrieved_chunks", [])

    if not retrieved_chunks:
        return {
            "answer": "I could not find relevant course material.",
            "answer_source": "rag"
        }

    # Build context from ALL retrieved chunks (up to top_k=5)
    # so the LLM can synthesise a richer, more accurate answer.
    context_parts = []
    for i, chunk in enumerate(retrieved_chunks, start=1):
        context_parts.append(
            f"--- Chunk {i} | Page {chunk.get('page_number')} "
            f"| Similarity {chunk.get('similarity', 0):.4f} ---\n"
            f"{chunk['content']}"
        )
    context = "\n\n".join(context_parts)

    student_context = state.get("student_context", {})
    profile_text    = format_memory_for_prompt(student_context)
    profile_section = f"\nSTUDENT PROFILE:\n{profile_text}\n" if profile_text else ""

    prompt = f"""
You are StudentAI, a university learning assistant.

Your job is to help students understand their course
material clearly.
{profile_section}
Answer the student's question using the provided
course material.

IMPORTANT RULES:

1. Use the provided course material as the primary source.
2. Do not invent information that is not supported by
   the course material.
3. Explain the concept in simple language and tailor it
   to the student's profile if one is available.
4. Give an example when useful.
5. If the material does not contain enough information
   to answer the question, clearly say that the course
   material does not provide enough information.
6. Do not mention retrieved chunks, embeddings,
   vector databases, or internal system details.
7. If the student asks about their own profile (e.g. favourite
   topic), answer directly from the STUDENT PROFILE section.
8. Answer directly as a helpful university tutor.

COURSE MATERIAL:

{context}

STUDENT QUESTION:

{question}

Now provide the answer.
"""

    llm_started_at = perf_counter()
    response = llm.invoke(prompt)
    llm_call_time_seconds = perf_counter() - llm_started_at
    print(f"LLM call time: {llm_call_time_seconds:.3f} seconds")

    # Gemini/LangChain may return content as either
    # a normal string or a list of content blocks.
    if isinstance(response.content, str):
        answer = response.content
    else:
        answer = "\n".join(
            block.get("text", "")
            for block in response.content
            if isinstance(block, dict)
            and block.get("type") == "text"
        )

    print("\nGenerated Answer:")
    print(answer)

    return {
        "answer": answer,
        "answer_source": "rag",
        "llm_call_time_seconds": llm_call_time_seconds
    }

# ============================================================
# STEP 7 — GENERAL LLM
# ============================================================

def general_llm(state: TutorState):

    print("\n========== GENERAL LLM ==========")

    student_context = state.get("student_context", {})
    profile_text    = format_memory_for_prompt(student_context)
    profile_section = f"\nSTUDENT PROFILE:\n{profile_text}\n" if profile_text else ""

    prompt = f"""
You are StudentAI, a helpful university learning assistant.
{profile_section}
Answer the student's question clearly and accurately. The question was not
well-supported by the selected course material, so answer from your general
knowledge. Explain difficult ideas simply and tailor the explanation to the
student's profile if one is available. Use an example when useful.

If the student asks about their own profile (e.g. favourite topic, learning
style), answer directly from the STUDENT PROFILE section above.

Student question:
{state["question"]}
"""

    llm_started_at = perf_counter()
    response = llm.invoke(prompt)
    llm_call_time_seconds = perf_counter() - llm_started_at
    print(f"LLM call time: {llm_call_time_seconds:.3f} seconds")

    if isinstance(response.content, str):
        answer = response.content
    else:
        answer = "\n".join(
            block.get("text", "")
            for block in response.content
            if isinstance(block, dict)
            and block.get("type") == "text"
        )

    return {
        "answer": answer,
        "answer_source": "llm",
        "llm_call_time_seconds": llm_call_time_seconds
    }


# ============================================================
# STEP 8 — ROUTE AFTER RETRIEVAL
# ============================================================

def route_after_retrieval(
    state: TutorState
) -> Literal["rag_answer", "general_llm"]:

    if state.get("retrieval_relevant", False):
        return "rag_answer"

    return "general_llm"


# ============================================================
# STEP 9 — QUALITY CHECK
# ============================================================

def quality_check(state: TutorState):

    print("\n========== QUALITY CHECK ==========")

    answer = state.get("answer", "")

    if answer.strip():
        passed = True
        feedback = "Answer is not empty."
    else:
        passed = False
        feedback = "Answer is empty."

    return {
        "quality_passed": passed,
        "quality_feedback": feedback
    }


# ============================================================
# STEP 10 — SAVE CHAT SESSION MESSAGES
# ============================================================

def save_conversation(state: TutorState):

    print("\n========== SAVE CONVERSATION ==========")

    try:
        student_id = UUID(state["student_id"])
        course_id = UUID(state["course_id"])
    except (KeyError, TypeError, ValueError):
        return {"message_saved": False}

    db = SessionLocal()

    try:
        session_id = UUID(state["session_id"])

        db.execute(
            text("""
                INSERT INTO tutor.messages
                    (session_id, role, content, answer_source,
                     retrieval_score, retrieval_relevant)
                VALUES
                    (:session_id, 'user', :question, NULL, NULL, NULL),
                    (:session_id, 'assistant', :answer, :answer_source,
                     :retrieval_score, :retrieval_relevant)
            """),
            {
                "session_id": session_id,
                "question": state["question"],
                "answer": state.get("answer", ""),
                "answer_source": state.get("answer_source"),
                "retrieval_score": state.get("retrieval_score", 0.0),
                "retrieval_relevant": state.get("retrieval_relevant", False)
            }
        )
        db.execute(
            text("""
                UPDATE tutor.chat_sessions
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = :session_id
            """),
            {"session_id": session_id}
        )
        db.commit()
        return {
            "session_id": str(session_id),
            "message_saved": True
        }
    except Exception:
        db.rollback()
        return {"message_saved": False}
    finally:
        db.close()

    return {
        "message_saved": True
    }


# ============================================================
# STEP 11 — BUILD LANGGRAPH
# ============================================================

builder = StateGraph(TutorState)


# Add nodes

builder.add_node(
    "load_student_context",
    load_student_context
)

builder.add_node(
    "create_query_embedding",
    create_query_embedding
)

builder.add_node(
    "retrieve_course_material",
    retrieve_course_material
)

builder.add_node(
    "check_relevance",
    check_relevance
)

builder.add_node(
    "rag_answer",
    rag_answer
)

builder.add_node(
    "general_llm",
    general_llm
)

builder.add_node(
    "quality_check",
    quality_check
)

builder.add_node(
    "save_conversation",
    save_conversation
)


# ============================================================
# STEP 12 — CONNECT THE NODES
# ============================================================

builder.add_edge(
    START,
    "load_student_context"
)

builder.add_edge(
    "load_student_context",
    "create_query_embedding"
)

builder.add_edge(
    "create_query_embedding",
    "retrieve_course_material"
)

builder.add_edge(
    "retrieve_course_material",
    "check_relevance"
)


# After retrieval evaluation:
#
# Relevant      → RAG
# Not relevant  → General LLM

builder.add_conditional_edges(
    "check_relevance",
    route_after_retrieval,
    {
        "rag_answer": "rag_answer",
        "general_llm": "general_llm"
    }
)


# Both answer paths go to quality check

builder.add_edge(
    "rag_answer",
    "quality_check"
)

builder.add_edge(
    "general_llm",
    "quality_check"
)

builder.add_edge(
    "quality_check",
    "save_conversation"
)

builder.add_edge(
    "save_conversation",
    END
)


# ============================================================
# STEP 13 — COMPILE GRAPH
# ============================================================

app = builder.compile()


# ============================================================
# STEP 14 — TEST THE GRAPH
# ============================================================

if __name__ == "__main__":

    print("\n")
    print("==============================================")
    print("      UNIVERSITY AI TUTOR - LANGGRAPH")
    print("==============================================")

    # Your Database Systems course UUID
    course_id = "e425d7fa-99d3-4ace-a926-845b969c3291"

    # Test student ID
    student_id = "test-student"

    # Test question
    question = "What is database normalization?"

    # Initial state sent into LangGraph

    initial_state: TutorState = {
        "student_id": student_id,
        "course_id": course_id,
        "course_name": "Database Systems",
        "question": question
    }

    print("\n========== INITIAL STATE ==========")
    print("Student ID:", student_id)
    print("Course ID:", course_id)
    print("Question:", question)

    # Run LangGraph

    result = app.invoke(initial_state)

    # Display final result

    print("\n")
    print("==============================================")
    print("              FINAL RESULT")
    print("==============================================")

    print("\nAnswer:")
    print(result.get("answer"))

    print("\nAnswer source:")
    print(result.get("answer_source"))

    print("\nRetrieved chunks:")
    print(len(result.get("retrieved_chunks", [])))

    print("\nRetrieval score:")
    print(result.get("retrieval_score"))

    print("\nRetrieval relevant:")
    print(result.get("retrieval_relevant"))

    print("\nQuality passed:")
    print(result.get("quality_passed"))

    print("\nMessage saved:")
    print(result.get("message_saved"))

    print("\n==============================================")
    print("             GRAPH EXECUTION END")
    print("==============================================")