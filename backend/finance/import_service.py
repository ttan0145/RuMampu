from __future__ import annotations

import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import (
    FinancialPeriod,
    IncomeEntry,
    IncomeImportBatch,
    IncomeImportRow,
    IncomeSource,
)
from .services import create_income_entry


MAX_IMPORT_BYTES = 2 * 1024 * 1024
MAX_IMPORT_ROWS = 1000
REQUIRED_HEADERS = {"amount", "date", "source"}


def _row_errors(*, profile, amount_text: str, date_text: str, source_text: str):
    codes: list[str] = []
    messages: list[str] = []
    amount = None
    income_date = None
    source_name = " ".join(source_text.split())

    try:
        amount = Decimal(amount_text)
        if amount <= 0 or amount != amount.quantize(Decimal("0.01")) or amount >= Decimal("10000000000"):
            raise InvalidOperation
    except (InvalidOperation, ValueError):
        amount = None
        codes.append("invalid_amount")
        messages.append("Amount must be a positive number with at most two decimal places.")

    try:
        income_date = date.fromisoformat(date_text)
        if income_date >= timezone.localdate():
            codes.append("date_not_historical")
            messages.append("Date must be earlier than today.")
    except ValueError:
        income_date = None
        codes.append("invalid_date")
        messages.append("Date must be a valid YYYY-MM-DD calendar date.")

    if not source_name or len(source_name) > 120:
        source_name = ""
        codes.append("invalid_source")
        messages.append("Source is required and must be at most 120 characters.")

    if income_date and profile.financial_periods.filter(
        period_month=income_date.replace(day=1),
        record_basis=FinancialPeriod.RecordBasis.MONTHLY_TOTAL,
    ).exists():
        codes.append("monthly_total_conflict")
        messages.append("This month is already represented by a historical monthly total.")

    return amount, income_date, source_name, ",".join(codes), " ".join(messages)


@transaction.atomic
def preview_income_import(*, profile, uploaded_file) -> IncomeImportBatch:
    file_name = Path(uploaded_file.name or "").name
    if not file_name.lower().endswith(".csv"):
        raise ValidationError({"file": "Only UTF-8 CSV files are supported."})
    if uploaded_file.size > MAX_IMPORT_BYTES:
        raise ValidationError({"file": "CSV file must not exceed 2 MB."})

    try:
        content = uploaded_file.read().decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationError({"file": "CSV file must use UTF-8 encoding."}) from exc

    reader = csv.DictReader(io.StringIO(content))
    headers = {str(header).strip().lower() for header in (reader.fieldnames or [])}
    if not REQUIRED_HEADERS.issubset(headers):
        raise ValidationError({"file": "CSV headers must include amount, date and source."})

    raw_rows = list(reader)
    if not raw_rows:
        raise ValidationError({"file": "CSV file contains no data rows."})
    if len(raw_rows) > MAX_IMPORT_ROWS:
        raise ValidationError({"file": "CSV file may contain at most 1000 data rows."})

    batch = IncomeImportBatch.objects.create(profile=profile, file_name=file_name)
    for row_number, raw_row in enumerate(raw_rows, start=2):
        normalized = {str(key).strip().lower(): value for key, value in raw_row.items()}
        amount_text = str(normalized.get("amount") or "").strip()
        date_text = str(normalized.get("date") or "").strip()
        source_text = str(normalized.get("source") or "").strip()
        amount, income_date, source_name, error_code, error_message = _row_errors(
            profile=profile,
            amount_text=amount_text,
            date_text=date_text,
            source_text=source_text,
        )
        IncomeImportRow.objects.create(
            batch=batch,
            row_number=row_number,
            raw_amount=amount_text,
            raw_date=date_text,
            raw_source=source_text,
            amount=amount,
            income_date=income_date,
            source_name=source_name,
            error_code=error_code,
            error_message=error_message,
        )
    return batch


@transaction.atomic
def confirm_income_import(*, profile, batch_id: int) -> IncomeImportBatch:
    batch = profile.income_import_batches.select_for_update().filter(id=batch_id).first()
    if batch is None:
        from rest_framework.exceptions import NotFound

        raise NotFound("Income import batch was not found for this profile.")
    if batch.status == IncomeImportBatch.Status.CONFIRMED:
        return batch
    if not batch.rows.filter(error_code="").exists():
        raise ValidationError({"batch": "There are no recognised rows to import."})

    for row in batch.rows.select_for_update().filter(error_code="").order_by("row_number"):
        if profile.financial_periods.filter(
            period_month=row.income_date.replace(day=1),
            record_basis=FinancialPeriod.RecordBasis.MONTHLY_TOTAL,
        ).exists():
            row.error_code = "monthly_total_conflict"
            row.error_message = "This month is now represented by a historical monthly total."
            row.save(update_fields=["error_code", "error_message"])
            continue

        source = profile.income_sources.filter(
            name__iexact=row.source_name,
            is_active=True,
        ).first()
        if source is None:
            source = IncomeSource.objects.create(
                profile=profile,
                name=row.source_name,
                is_custom=True,
            )
        entry = create_income_entry(
            profile=profile,
            source=source,
            income_date=row.income_date,
            gross_amount=row.amount,
            entry_method=IncomeEntry.EntryMethod.IMPORT,
        )
        row.imported_entry = entry
        row.save(update_fields=["imported_entry"])

    batch.status = IncomeImportBatch.Status.CONFIRMED
    batch.confirmed_at = timezone.now()
    batch.save(update_fields=["status", "confirmed_at"])
    return batch
