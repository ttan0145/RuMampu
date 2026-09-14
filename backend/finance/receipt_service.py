"""Receipt reading via the Groq vision API (US1.7).

A photographed receipt is sent to a Groq-hosted vision model, which returns a
structured draft (merchant, date, total, category). The user always confirms
the draft before anything is saved; the model's answer is a suggestion, never
a record. The Groq API key lives only on the server.
"""
from __future__ import annotations

import datetime
import json
import os
from decimal import Decimal, InvalidOperation
from typing import Any

from jsonschema import ValidationError as SchemaValidationError
from jsonschema import validate

DEFAULT_MODEL = "qwen/qwen3.8-27b"

ALLOWED_CATEGORY_SLUGS = ("meals", "groc", "transp", "family", "other")

RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "is_receipt": {"type": "boolean"},
        "merchant": {"type": ["string", "null"]},
        "date": {"type": ["string", "null"]},
        "total": {"type": ["number", "string", "null"]},
        "category_slug": {"type": ["string", "null"]},
    },
    "required": ["is_receipt", "merchant", "date", "total", "category_slug"],
}

PROMPT = (
    "You are reading a photo of a shopping or service receipt, most likely from "
    "Malaysia (amounts in RM). Respond with ONLY a JSON object with exactly these "
    "keys:\n"
    '  "is_receipt": boolean — false if the image is not a purchase receipt.\n'
    '  "merchant": the shop or business name as printed, or null.\n'
    '  "date": the purchase date as YYYY-MM-DD, or null if not readable.\n'
    '  "total": the final amount paid as a plain number (no currency symbol), '
    "or null if not readable. Prefer the grand total after tax and rounding.\n"
    '  "category_slug": the best fit from exactly one of "meals" (restaurants, '
    'food stalls, cafes), "groc" (groceries, supermarkets, convenience stores), '
    '"transp" (tolls, parking, fuel for private travel), "family" (items bought '
    'for family members), "other".\n'
    "If is_receipt is false, set every other field to null."
)


class ReceiptScanError(Exception):
    """A scan failure with a stable error code and HTTP status."""

    def __init__(self, code: str, message: str, status: int):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def _client():
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise ReceiptScanError(
            "receipt_scan_unconfigured",
            "Receipt reading is not configured on this server.",
            503,
        )
    from groq import Groq

    return Groq(api_key=api_key)


def scan_receipt(image_base64: str, media_type: str) -> dict[str, Any]:
    client = _client()
    model = os.getenv("GROQ_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{image_base64}",
                            },
                        },
                    ],
                }
            ],
            response_format={"type": "json_object"},
            temperature=0,
            max_completion_tokens=300,
        )
        raw = completion.choices[0].message.content or ""
        data = json.loads(raw)
        validate(data, RESULT_SCHEMA)
    except ReceiptScanError:
        raise
    except (json.JSONDecodeError, SchemaValidationError) as exc:
        raise ReceiptScanError(
            "receipt_scan_unreadable",
            "The receipt reader returned an unusable answer. Try another photo.",
            502,
        ) from exc
    except Exception as exc:  # Groq SDK errors: auth, rate limit, network
        raise ReceiptScanError(
            "receipt_scan_failed",
            "The receipt reader is unavailable right now. Try again shortly.",
            502,
        ) from exc
    return normalise_result(data)


def normalise_result(data: dict[str, Any]) -> dict[str, Any]:
    """Clamp the model's answer to values the product can safely present."""
    is_receipt = bool(data.get("is_receipt"))
    if not is_receipt:
        return {
            "is_receipt": False,
            "merchant": None,
            "date": None,
            "total": None,
            "category_slug": None,
        }

    merchant = data.get("merchant")
    merchant = str(merchant).strip()[:120] or None if merchant else None

    date = data.get("date")
    if date is not None:
        try:
            date = datetime.date.fromisoformat(str(date))
        except ValueError:
            date = None

    total = data.get("total")
    if total is not None:
        try:
            total = Decimal(str(total)).quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError):
            total = None
        else:
            if total <= 0:
                total = None

    slug = data.get("category_slug")
    if slug not in ALLOWED_CATEGORY_SLUGS:
        slug = "other"

    return {
        "is_receipt": True,
        "merchant": merchant,
        "date": date,
        "total": total,
        "category_slug": slug,
    }


# ---- Income statement reading (US1.9 real scan) -----------------------------

INCOME_RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "is_earnings": {"type": "boolean"},
        "rows": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "date": {"type": ["string", "null"]},
                    "amount": {"type": ["number", "string", "null"]},
                    "confident": {"type": ["boolean", "null"]},
                },
                "required": ["date", "amount"],
            },
        },
    },
    "required": ["is_earnings", "rows"],
}

INCOME_PROMPT_TEMPLATE = (
    "You are reading a screenshot or photo of an earnings statement, most "
    "likely from a Malaysian gig platform (e-hailing or delivery app) or a "
    "bank statement showing income credits. Amounts are in RM. Today is "
    "{today}. Respond with ONLY a JSON object with exactly these keys:\n"
    '  "is_earnings": boolean - false if the image shows no earnings or income amounts.\n'
    '  "rows": an array with one object per distinct earning, each with:\n'
    '    "date": the day the money was earned as YYYY-MM-DD. When the year or '
    "month is not printed, infer the most recent past date that matches the "
    "printed day and weekday relative to today. Use null only when no day is "
    "printed at all.\n"
    '    "amount": the earned amount as a plain number (no currency symbol).\n'
    '    "confident": false if the value was hard to read or partly guessed.\n'
    "List at most 20 rows, newest first. Only include money EARNED (trips, "
    "orders, incentives, salary credits) - never spending, fees, tips paid "
    "out, or balance totals. Never include a summary or total row. "
    "If is_earnings is false, set rows to []."
)


def scan_income(image_base64: str, media_type: str) -> dict[str, Any]:
    client = _client()
    model = os.getenv("GROQ_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": INCOME_PROMPT_TEMPLATE.format(
                                today=datetime.date.today().isoformat()
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{image_base64}",
                            },
                        },
                    ],
                }
            ],
            response_format={"type": "json_object"},
            temperature=0,
            max_completion_tokens=900,
        )
        raw = completion.choices[0].message.content or ""
        data = json.loads(raw)
        validate(data, INCOME_RESULT_SCHEMA)
    except ReceiptScanError:
        raise
    except (json.JSONDecodeError, SchemaValidationError) as exc:
        raise ReceiptScanError(
            "income_scan_unreadable",
            "The statement reader returned an unusable answer. Try another photo.",
            502,
        ) from exc
    except Exception as exc:  # Groq SDK errors: auth, rate limit, network
        raise ReceiptScanError(
            "income_scan_failed",
            "The statement reader is unavailable right now. Try again shortly.",
            502,
        ) from exc
    return normalise_income_result(data)


def normalise_income_result(data: dict[str, Any]) -> dict[str, Any]:
    """Clamp the model's rows to values the product can safely present."""
    if not data.get("is_earnings"):
        return {"is_earnings": False, "rows": []}

    rows = []
    for item in (data.get("rows") or [])[:20]:
        if not isinstance(item, dict):
            continue
        amount = item.get("amount")
        try:
            amount = Decimal(str(amount)).quantize(Decimal("0.01"))
        except (InvalidOperation, ValueError, TypeError):
            continue
        if amount <= 0:
            continue
        date = item.get("date")
        if date is not None:
            try:
                date = datetime.date.fromisoformat(str(date))
            except ValueError:
                date = None
        rows.append({
            "date": date,
            "amount": amount,
            "low_confidence": item.get("confident") is False,
        })
    return {"is_earnings": bool(rows), "rows": rows}
