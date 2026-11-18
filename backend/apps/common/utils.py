import uuid

def is_valid_uuid(val) -> bool:
    """Check if value is a valid UUID string or instance."""
    if not val:
        return False
    if isinstance(val, uuid.UUID):
        return True
    try:
        uuid.UUID(str(val).strip())
        return True
    except (ValueError, TypeError, AttributeError):
        return False
