from graph import quality_check, route_after_retrieval, save_conversation


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
