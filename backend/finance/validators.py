from django.core.exceptions import ValidationError


def validate_slower_months(value) -> None:
    """Keep persisted slower months canonical even outside the API serializer."""
    if type(value) is not list:
        raise ValidationError("Slower months must be stored as a list.")
    if any(type(month) is not int for month in value):
        raise ValidationError("Each slower month must be an integer.")
    if any(month < 1 or month > 12 for month in value):
        raise ValidationError("Each slower month must be between 1 and 12.")
    if len(value) != len(set(value)):
        raise ValidationError("Each slower month can be stored only once.")
    if value != sorted(value):
        raise ValidationError("Slower months must be stored in ascending order.")
