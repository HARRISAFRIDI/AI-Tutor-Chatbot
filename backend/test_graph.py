from types import SimpleNamespace
from unittest.mock import patch

import graph
from graph import (
    quality_check,
    resolve_followup_question,
    route_after_retrieval,
    save_conversation,
)


def test_relevant_retrieval_routes_to_rag():
    assert route_after_retrieval({"retrieval_relevant": True}) == "rag_answer"


def test_irrelevant_retrieval_routes_to_general_llm():
    assert route_after_retrieval({"retrieval_relevant": False}) == "general_llm"


def test_quality_check_rejects_empty_answer():
    result = quality_check({"answer": "   "})

    assert result == {
        "quality_passed": False,
        "quality_feedback": "Answer is empty."
    }


def test_save_conversation_skips_non_uuid_demo_student():
    result = save_conversation({
        "student_id": "test-student",
        "course_id": "test-course",
        "question": "test"
    })

    assert result == {"message_saved": False}


def test_resolve_followup_question_uses_recent_history():
    def fake_invoke(self, prompt):
        return SimpleNamespace(content=(
            '{"is_followup": true, '
            '"standalone_question": "What are the types of database normalization?"}'
        ))

    with patch.object(type(graph.llm), "invoke", fake_invoke):
        result = resolve_followup_question({
            "question": "What are its types?",
            "current_question": "What are its types?",
            "conversation_history": [
                {"role": "user", "content": "What is database normalization?"},
                {"role": "assistant", "content": "Database normalization is ..."},
            ],
        })

    assert result == {
        "is_followup": True,
        "standalone_question": "What are the types of database normalization?",
    }


def test_resolve_standalone_question_without_history():
    result = resolve_followup_question({
        "question": "What is database normalization?",
        "conversation_history": [],
    })

    assert result == {
        "is_followup": False,
        "standalone_question": "What is database normalization?",
    }
