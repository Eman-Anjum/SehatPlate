import datetime as dt
from typing import Optional

from sqlalchemy import ForeignKey, String, Boolean, DateTime, Text, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    totp_secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recovery_codes: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True),
        default=dt.datetime.now(dt.timezone.utc),
        nullable=False,
    )

    scans: Mapped[list["Scan"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    dish: Mapped[str] = mapped_column(String(255), nullable=False)
    condition: Mapped[str] = mapped_column(String(255), nullable=False)
    answers: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    verdict: Mapped[str] = mapped_column(String(50), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    swaps: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True),
        default=dt.datetime.now(dt.timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="scans")
