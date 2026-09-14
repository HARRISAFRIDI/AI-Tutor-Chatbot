import json
import re
import sys
from typing import TypedDict, Literal
from time import perf_counter
from uuid import UUID

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

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
    current_question: str
    conversation_history: list[dict[str, str]]
    standalone_question: str
    is_followup: bool
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


def load_conversation_history(state: TutorState):
    student_id = state["student_id"]
    course_id = state.get("course_id")
    session_id = state.get("session_id")

    history: list[dict[str, str]] = []
    if session_id and course_id:
        db = SessionLocal()
        try:
            rows = db.execute(
                text("""
                    SELECT m.role, m.content
                    FROM tutor.messages m
                    JOIN tutor.chat_sessions cs ON cs.id = m.session_id
                    WHERE m.session_id = :session_id
                      AND cs.student_id = :student_id
                      AND cs.course_id = :course_id
                    ORDER BY m.created_at DESC
                    LIMIT 10
                """),
                {
                    "session_id": session_id,
                    "student_id": student_id,
                    "course_id": course_id,
                }
            ).mappings().all()
            history = [
                {"role": row["role"], "content": row["content"]}
                for row in reversed(rows)
            ]
        finally:
            db.close()

    print("\n========== CONVERSATION CONTEXT ==========")
    print(json.dumps(history, ensure_ascii=True, indent=2))
    return {"conversation_history": history}


def _response_text(response) -> str:
    if isinstance(response.content, str):
        return response.content.strip()
    return "\n".join(
        block.get("text", "")
        for block in response.content
        if isinstance(block, dict) and block.get("type") == "text"
    ).strip()


def _extract_history_topic(history: list[dict[str, str]]) -> str:
    for item in reversed(history):
        role = item.get("role")
        content = str(item.get("content", "")).strip()
        if not content or role != "user":
            continue

        match = re.search(r"(?:what is|what are|explain|describe|define|tell me about|how does|why is|when is|who is)\s+(.+?)(?:\?|$)", content, re.IGNORECASE)
        if match:
            topic = match.group(1).strip().rstrip(".")
            topic = re.sub(r"\s+", " ", topic)
            return topic

        if content.lower().startswith("what is "):
            topic = content[8:].strip().rstrip("?")
            return re.sub(r"\s+", " ", topic)

    return ""


def _fallback_standalone_question(current_question: str, history: list[dict[str, str]]) -> tuple[str, bool]:
    question = current_question.strip()
    if not question:
        return "", False

    if not history:
        return question, False

    topic = _extract_history_topic(history)
    if not topic:
        return question, False

    lowered = question.lower()
    replacements = {
        "it": topic,
        "its": topic,
        "this": topic,
        "that": topic,
        "these": topic,
        "those": topic,
        "they": topic,
        "them": topic,
        "above": topic,
        "previous": topic,
        "mentioned earlier": topic,
        "what about": topic,
        "how does it work": f"how does {topic} work",
        "why is this important": f"why is {topic} important",
        "explain further": f"explain further about {topic}",
        "give an example": f"give an example of {topic}",
        "what are its advantages": f"what are the advantages of {topic}",
        "what are its disadvantages": f"what are the disadvantages of {topic}",
    }

    rewritten = question
    for old, new in sorted(replacements.items(), key=lambda pair: len(pair[0]), reverse=True):
        pattern = re.compile(rf"\b{re.escape(old)}\b", re.IGNORECASE)
        if pattern.search(rewritten):
            rewritten = pattern.sub(new, rewritten)
            break

    if rewritten == question:
        if any(ref in lowered for ref in ["it", "its", "this", "that", "these", "those", "they", "them", "previous", "above", "mentioned earlier"]):
            context_pattern = re.search(r"^(what|why|how|when|who|explain|describe|define|tell me about)\b", question, re.IGNORECASE)
            if context_pattern:
                verb = context_pattern.group(1)
                if verb.lower() == "what":
                    rewritten = question.replace("what", f"what are the", 1) if "its" in lowered or "it" in lowered else question
                    if "its" in lowered:
                        rewritten = rewritten.replace("its", f"of {topic}", 1)
                    if "it" in lowered:
                        rewritten = rewritten.replace("it", f"{topic}", 1)
                elif verb.lower() == "how":
                    rewritten = f"how does {topic} work"
                elif verb.lower() == "why":
                    rewritten = f"why is {topic} important"
                elif verb.lower() in {"explain", "describe", "define", "tell me about"}:
                    rewritten = f"{verb} {topic}"
        if rewritten == question:
            if question.lower().startswith("what are its types"):
                rewritten = f"what are the types of {topic}"
            elif question.lower().startswith("what are its advantages"):
                rewritten = f"what are the advantages of {topic}"
            elif question.lower().startswith("give me an example"):
                rewritten = f"give me an example of {topic}"
            elif question.lower().startswith("explain the first type"):
                rewritten = f"explain the first type of {topic}"

    return rewritten.strip(), rewritten.strip() != question.strip()


def resolve_followup_question(state: TutorState):
    current_question = state.get("current_question", state["question"]).strip()
    history = state.get("conversation_history", [])

    if not history:
        print("\nCURRENT QUESTION:")
        print(current_question)
        print("FOLLOW-UP:")
        print(False)
        print("STANDALONE QUESTION:")
        print(current_question)
        return {
            "standalone_question": current_question,
            "is_followup": False,
        }

    history_text = json.dumps(history, ensure_ascii=True, indent=2)
    prompt = f"""
You resolve follow-up questions for a university tutor.

Use only the recent conversation below, which belongs to the current student,
course, and chat session. Decide whether the current question depends on that
conversation. If it is standalone, preserve it unchanged. If it is a
follow-up, rewrite it as one complete standalone question with all references
resolved. Do not answer the question.

Return only valid JSON with exactly these keys:
{{"is_followup": true or false, "standalone_question": "..."}}

RECENT CONVERSATION:
{history_text}

CURRENT QUESTION:
{current_question}
"""

    try:
        response = llm.invoke(prompt)
        raw_result = _response_text(response)
        if raw_result.startswith("```"):
            raw_result = raw_result.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(raw_result)
        standalone_question = str(parsed["standalone_question"]).strip()
        is_followup = bool(parsed["is_followup"])
        if not standalone_question:
            raise ValueError("Empty standalone question")
    except Exception as exc:
        print("FOLLOW-UP RESOLVER LLM ERROR:", exc)
        standalone_question, is_followup = _fallback_standalone_question(current_question, history)

    print("\nCURRENT QUESTION:")
    print(current_question)
    print("CONVERSATION CONTEXT:")
    print(history_text)
    print("FOLLOW-UP:")
    print(is_followup)
    print("STANDALONE QUESTION:")
    print(standalone_question)

    return {
        "standalone_question": standalone_question,
        "is_followup": is_followup,
    }


# ============================================================
# STEP 4 — CREATE QUERY EMBEDDING
# ============================================================

def create_query_embedding(state: TutorState):
    question = state.get("standalone_question", state["question"]).strip()

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

    question = state.get("standalone_question", state["question"]).strip()
    course_id = state["course_id"]
    course_name = state["course_name"]

    print("Question:", question)
    print("RAG QUERY:", question)
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
        print(results[0]["content"][:500].encode("ascii", "replace").decode("ascii"))
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
    print("RETRIEVAL RELEVANT:", relevant)

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

    question = state.get("standalone_question", state["question"])
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
{state.get("standalone_question", state["question"])}
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
    "load_conversation_history",
    load_conversation_history
)

builder.add_node(
    "resolve_followup_question",
    resolve_followup_question
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
    "load_conversation_history"
)

builder.add_edge(
    "load_conversation_history",
    "resolve_followup_question"
)

builder.add_edge(
    "resolve_followup_question",
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