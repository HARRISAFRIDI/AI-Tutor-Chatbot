"""
memory.py — Student Memory / Profile System

Responsibilities:
  - load_memory       : Fetch the student profile from the DB.
  - save_memory       : Upsert a partial set of profile updates.
  - extract_memory_updates : Use the LLM to detect profile info in a message.
  - format_memory_for_prompt : Render the profile for LLM prompt injection.
"""

import json
import re
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from llm import llm


# ──────────────────────────────────────────────
# All recognised memory fields (keep in sync with migration 007)
# ──────────────────────────────────────────────

MEMORY_FIELDS = [
    "favorite_topic",
    "learning_style",
    "preferred_language",
    "difficulty_level",
    "interests",
    "strengths",
    "weak_topics",
    "preferred_explanation_style",
]


# ──────────────────────────────────────────────
# load_memory
# ──────────────────────────────────────────────

def load_memory(student_id: str | UUID, db: Session) -> dict:
    """
    Load the student's profile from tutor.student_memory.
    Returns a dict containing only the non-null fields.
    Returns {} if no profile row exists yet.
    """
    row = db.execute(
        text("""
            SELECT favorite_topic, learning_style, preferred_language,
                   difficulty_level, interests, strengths, weak_topics,
                   preferred_explanation_style
            FROM tutor.student_memory
            WHERE student_id = :student_id
        """),
        {"student_id": str(student_id)}
    ).mappings().first()

    if not row:
        return {}

    return {k: v for k, v in row.items() if v is not None}


# ──────────────────────────────────────────────
# save_memory
# ──────────────────────────────────────────────

def save_memory(student_id: str | UUID, updates: dict, db: Session) -> None:
    """
    Upsert partial profile updates into tutor.student_memory.
    Only the keys present in `updates` (and in MEMORY_FIELDS) are written.
    """
    if not updates:
        return

    # Filter to only known fields with non-empty string values
    clean = {
        k: v
        for k, v in updates.items()
        if k in MEMORY_FIELDS and isinstance(v, str) and v.strip()
    }

    if not clean:
        return

    # Build dynamic SET clause
    set_clause = ", ".join(f"{col} = :{col}" for col in clean)
    params = {"student_id": str(student_id), **clean}

    db.execute(
        text(f"""
            INSERT INTO tutor.student_memory (student_id, {", ".join(clean)})
            VALUES (:student_id, {", ".join(":" + col for col in clean)})
            ON CONFLICT (student_id) DO UPDATE
            SET {set_clause},
                updated_at = CURRENT_TIMESTAMP
        """),
        params
    )
    db.commit()


# ──────────────────────────────────────────────
# extract_memory_updates
# ──────────────────────────────────────────────

_EXTRACTION_PROMPT = """\
You are a student profiler. Read the student's message carefully.

If the message explicitly reveals any of the following facts about the student, \
return a JSON object containing ONLY those keys:

  favorite_topic              - Their favourite subject or topic
  learning_style              - How they prefer to learn (e.g. visual, hands-on)
  preferred_language          - Their preferred programming or spoken language
  difficulty_level            - Their self-reported skill level (e.g. beginner, advanced)
  interests                   - Topics or hobbies they mention being interested in
  strengths                   - Subjects or skills they say they are good at
  weak_topics                 - Subjects or topics they struggle with
  preferred_explanation_style - How they like explanations (e.g. step-by-step, with examples)

If the message does NOT reveal any of these facts, return exactly: {{}}

Student message:
"{message}"

Return ONLY valid JSON. No explanation, no markdown, no extra text.
"""


def extract_memory_updates(message: str, db: Session) -> dict:
    """
    Ask the LLM whether the student's message reveals any profile information.
    Returns a dict of field→value, or {} if nothing was found.
    """
    prompt = _EXTRACTION_PROMPT.format(message=message.replace('"', '\\"'))

    try:
        response = llm.invoke(prompt)
        raw = response.content if isinstance(response.content, str) else ""

        # Strip markdown code fences if present
        raw = re.sub(r"```(?:json)?", "", raw).strip()
        raw = raw.strip("`").strip()

        parsed = json.loads(raw)

        if not isinstance(parsed, dict):
            return {}

        # Keep only known fields
        return {k: v for k, v in parsed.items() if k in MEMORY_FIELDS}

    except Exception:
        # Never crash the chat pipeline over memory extraction
        return {}


# ──────────────────────────────────────────────
# format_memory_for_prompt
# ──────────────────────────────────────────────

_FIELD_LABELS = {
    "favorite_topic":              "Favourite topic",
    "learning_style":              "Learning style",
    "preferred_language":          "Preferred language",
    "difficulty_level":            "Difficulty level",
    "interests":                   "Interests",
    "strengths":                   "Strengths",
    "weak_topics":                 "Weak topics",
    "preferred_explanation_style": "Preferred explanation style",
}


def format_memory_for_prompt(memory: dict) -> str:
    """
    Render the student profile as a readable string for LLM prompts.
    Returns an empty string if the profile is empty.
    """
    if not memory:
        return ""

    lines = []
    for field, label in _FIELD_LABELS.items():
        value = memory.get(field)
        if value:
            lines.append(f"- {label}: {value}")

    return "\n".join(lines)
