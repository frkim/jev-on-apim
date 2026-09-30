"""Pydantic models for the Jev System One request contract."""

from __future__ import annotations

import re
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

MODEL_PATTERN = re.compile(r"^jev-[a-z0-9.\-]{1,40}$")
QUESTION_ID_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_\-]{0,63}$")

JsonInput = str | dict[str, Any] | list[Any]


class NoulCriteria(BaseModel):
    model_config = ConfigDict(extra="forbid")

    true: str = Field(alias="true", min_length=1)
    false: str = Field(alias="false", min_length=1)


class BaseQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    instructions: JsonInput

    @field_validator("instructions")
    @classmethod
    def validate_instructions(cls, value: JsonInput) -> JsonInput:
        if isinstance(value, str) and not value.strip():
            raise ValueError("instructions must not be empty")
        if isinstance(value, (dict, list)) and len(value) == 0:
            raise ValueError("instructions must not be empty")
        return value


class NoulQuestion(BaseQuestion):
    type: Literal["noul"]
    criteria: NoulCriteria | None = None


class ChoiceQuestion(BaseQuestion):
    type: Literal["choice"]
    criteria: dict[str, str | None]

    @field_validator("criteria")
    @classmethod
    def validate_criteria(cls, value: dict[str, str | None]) -> dict[str, str | None]:
        if not 2 <= len(value) <= 255:
            raise ValueError("choice criteria must contain 2 to 255 options")
        for key, description in value.items():
            if not key:
                raise ValueError("choice option ids must not be empty")
            if description is not None and not description.strip():
                raise ValueError("choice option descriptions must not be empty when provided")
        return value


class ScoreQuestion(BaseQuestion):
    type: Literal["score"]
    criteria: list[str]

    @field_validator("criteria")
    @classmethod
    def validate_criteria(cls, value: list[str]) -> list[str]:
        if not 2 <= len(value) <= 10:
            raise ValueError("score criteria must contain 2 to 10 ordered levels")
        if any(not item.strip() for item in value):
            raise ValueError("score criteria levels must not be empty")
        return value


Question = Annotated[NoulQuestion | ChoiceQuestion | ScoreQuestion, Field(discriminator="type")]


class JevRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str = Field(pattern=MODEL_PATTERN.pattern)
    state: JsonInput
    questions: dict[str, Question] = Field(min_length=1, max_length=32)

    @field_validator("state")
    @classmethod
    def validate_state(cls, value: JsonInput) -> JsonInput:
        if isinstance(value, str) and not value.strip():
            raise ValueError("state must not be empty")
        if isinstance(value, (dict, list)) and len(value) == 0:
            raise ValueError("state must not be empty")
        return value

    @field_validator("questions")
    @classmethod
    def validate_question_ids(cls, value: dict[str, Question]) -> dict[str, Question]:
        for key in value:
            if QUESTION_ID_PATTERN.fullmatch(key) is None:
                raise ValueError(f"invalid question id: {key}")
        return value

    def upstream_payload(self) -> dict[str, Any]:
        payload = self.model_dump(mode="json", by_alias=True)
        questions = payload["questions"]
        if isinstance(questions, dict):
            for question in questions.values():
                if isinstance(question, dict) and question.get("type") == "noul" and question.get("criteria") is None:
                    question.pop("criteria", None)
        return payload


def validation_details(exc: ValidationError) -> list[dict[str, Any]]:
    details: list[dict[str, Any]] = []
    for error in exc.errors(include_url=False, include_context=False):
        details.append(
            {
                "loc": list(error.get("loc", ())),
                "message": str(error.get("msg", "")),
                "type": str(error.get("type", "")),
            }
        )
    return details
