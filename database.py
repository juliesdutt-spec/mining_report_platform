"""
Database Layer - SQLite with SQLAlchemy
SIH26023 - AI-Powered Geological & Mining Reporting Solution
"""
import os
from datetime import datetime

# Populates os.environ from .env before any getenv below runs.
import utils.env  # noqa: F401
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///mining_reports.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class MiningReport(Base):
    """Stores extracted data from mining reports"""
    __tablename__ = "mining_reports"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    filename = Column(String(255), nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)
    raw_text = Column(Text, nullable=True)
    
    # Extracted structured data
    report_date = Column(String(50), nullable=True)
    location = Column(String(255), nullable=True)
    mineral_type = Column(String(255), nullable=True)
    quantity_extracted = Column(String(100), nullable=True)
    extraction_method = Column(String(255), nullable=True)
    company_name = Column(String(255), nullable=True)
    mine_name = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    
    # Full structured JSON from Claude
    extracted_data = Column(JSON, nullable=True)
    
    # Processing status
    status = Column(String(50), default="pending")  # pending, processing, completed, error
    error_message = Column(Text, nullable=True)
    
    # Per-page text, so evidence can cite the page a passage came from.
    # Nullable: reports ingested before this column existed have no pages.
    page_texts = Column(JSON, nullable=True)

    # Word cloud data
    word_cloud_path = Column(String(500), nullable=True)
    topics = Column(JSON, nullable=True)


class QueryHistory(Base):
    """Stores AI query history"""
    __tablename__ = "query_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    report_ids_used = Column(JSON, nullable=True)


class ValidationResolution(Base):
    """
    An auditor's decision on a discrepancy.

    Findings themselves are recomputed from the reports on every request, so
    only the human decision is persisted, keyed by the finding's deterministic
    id (see validation_engine.detect_discrepancies).
    """
    __tablename__ = "validation_resolutions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    finding_id = Column(String(255), nullable=False, unique=True, index=True)
    status = Column(String(50), default="resolved")  # resolved, flagged
    resolution_note = Column(Text, nullable=True)
    resolved_at = Column(DateTime, default=datetime.utcnow)


def _add_missing_columns():
    """
    Add columns that exist on the models but not yet in the database.

    create_all() only creates missing tables, never new columns on existing
    ones, so a database created before a column was introduced would raise
    "no such column" at query time. SQLite supports ALTER TABLE ADD COLUMN,
    which is enough to migrate a prototype forward without dropping data.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue  # create_all() will have made it in full

            present = {col["name"] for col in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in present:
                    continue
                ddl_type = column.type.compile(engine.dialect)
                conn.execute(
                    text(f'ALTER TABLE {table.name} ADD COLUMN {column.name} {ddl_type}')
                )
                print(f"[db] added column {table.name}.{column.name}")


def init_db():
    """Initialize database tables and apply simple forward migrations."""
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


def get_db():
    """Dependency for FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
