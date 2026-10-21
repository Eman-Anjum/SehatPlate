import os
import sys

from sqlalchemy.engine import make_url


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        print(f"[config] Missing required environment variable: {name}", file=sys.stderr)
        sys.exit(1)
    return value


def _read_env(name: str, default: str) -> str:
    return os.environ.get(name, default)


DATABASE_URL = _require_env("DATABASE_URL")
SESSION_SECRET = _require_env("SESSION_SECRET")
JWT_EXPIRE_MINUTES = int(_read_env("JWT_EXPIRE_MINUTES", "60"))
GROQ_API_KEY = _read_env("GROQ_API_KEY", "")
GROQ_VISION_MODEL = _read_env("GROQ_VISION_MODEL", "")
GROQ_TEXT_MODEL = _read_env("GROQ_TEXT_MODEL", "")
FRONTEND_ORIGIN = _read_env("FRONTEND_ORIGIN", "")


def resolve_database_url() -> str:
    """Return a SQLAlchemy URL with an explicit driver name we can support."""
    parsed = make_url(DATABASE_URL)
    driver = parsed.drivername.lower()

    if driver in ("postgres", "postgresql"):
        # Normalize to the psycopg2 driver we install.
        return str(parsed.set(drivername="postgresql+psycopg2"))

    if driver.startswith("sqlite"):
        raise RuntimeError(
            "Unsupported DATABASE_URL scheme: sqlite. "
            "This project requires a PostgreSQL database."
        )

    if driver.startswith("mysql"):
        raise RuntimeError(
            "Unsupported DATABASE_URL scheme: mysql. "
            "This project requires a PostgreSQL database."
        )

    raise RuntimeError(
        f"Unsupported DATABASE_URL scheme: {driver}. "
        "This project requires a PostgreSQL database."
    )
